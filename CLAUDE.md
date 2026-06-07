# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

WebTerm: a self-hosted web app that exposes a **real machine terminal** (tmux-backed PTY) plus a project file browser/editor over HTTP+WebSocket. Ships as a **single Go binary with the React frontend embedded** (`embed.FS`). Backend Go 1.25 / `net/http` 1.22 mux; frontend React 19 + Vite + TS + Tailwind v4. The app lives under `webterm/`; the repo root holds optional dev infra (`docker-compose.yml`) and docs.

## Commands

Run all from `webterm/` (the Makefile lives there).

| Task | Command |
|------|---------|
| Build everything (frontend → embed → binary) | `make build` |
| Build only frontend into embed dir | `make web` |
| Build only Go binary | `make go` |
| Run (jailed to `ROOT`, default `~/projects`) | `make run` or `ROOT=/path ADDR=127.0.0.1:7070 make run` |
| Dev backend | `go run ./cmd/webterm --root ~/projects` |
| Dev frontend (proxies `/api` + `/ws` to :7070) | `cd web && npm run dev` |
| All tests (Go + vitest) | `make test` |
| Lint frontend (oxlint) | `make lint` |
| Format (gofmt + oxfmt) | `make fmt` |
| Typecheck + vet (`go vet` + `tsc`/`vite build`) | `make vet` |

**Single test:**
- Go: `go test ./internal/fsapi/ -run TestTraversalBlocked` (add `-v`)
- Vitest: `cd web && npx vitest run src/lib/grouping.test.ts` or `npx vitest run -t "buildTree"`
- E2E (Playwright): `cd web && npm run e2e` (or `npm run e2e:ui`)

The frontend builds into `internal/server/dist/` (gitignored except `.gitkeep`) and is embedded — **a stale `dist` means the binary serves an old UI; run `make web` after frontend changes** before testing the built binary. `make vet` runs `tsc`/`vite build`, so it doubles as the typecheck gate.

## Architecture

```
Browser (React + xterm + CodeMirror, PWA)
        │  HTTP + WebSocket
        ▼
Single Go binary  (authSeam middleware outermost; binds 127.0.0.1 by default)
 ├── Static       → embedded React build           internal/server/static.go
 ├── FS API       → list/read/write/.../raw/search internal/fsapi/      [pathjail]
 ├── Project API  → folder discovery + subgroups   internal/project/    (layout.json)
 ├── Sys API      → git status · host stats        internal/sysapi/
 ├── Push         → Web Push (silence/bell notify)  internal/push/
 └── Terminal WS  → PTY bridge to tmux session     internal/terminal/
```

**Backend wiring.** `server.New(cfg)` builds the mux, then each subsystem registers itself via a `Register(mux *http.ServeMux)` method (`fsapi.New(jail).Register`, `store.Register`, etc.). Routes use Go 1.22 method+pattern syntax: `mux.HandleFunc("GET /api/projects/list", ...)`. `Server.Handler()` wraps the whole mux in `authSeam` — **auth is the single outermost gate; do not add per-route auth checks.** Follow this shape when adding a subsystem: new package under `internal/`, expose `Register`, wire it in `server.routes()`.

**tmux model.** One detached tmux session per project (`wt_<projectID>` / `wt_<projectID>_<n>` for tabs), created/named via `terminal.SessionName`. Sessions survive WS drops **and** restarts of the binary; the WS handler (`terminal/ws.go`) is a thin PTY↔WebSocket bridge over a `tmux attach` client, and the terminal repaints on reconnect. Project "active" state is derived live from existing sessions — **never persisted** into `layout.json`.

**Frontend data flow.** All server state goes through one path: `lib/api.ts` (thin typed `fetch` wrappers) → React Query hooks in `lib/queries.ts` → components. Components do **not** call `fetch` directly. Polling cadence is set per-hook via `refetchInterval` (projects 5s, host 4s, git 15s). UI prefs (theme, accent, haptics, key set, pinned projects, font size) live in `localStorage` via `lib/settings.tsx`, not the server.

## Conventions (follow these — they encode real invariants here)

### Security seams — never weaken
- **All filesystem access goes through `pathjail.Jail.Resolve`** (`internal/pathjail`). It rejects absolute paths and `..`, then enforces containment **lexically and through symlinks**. Never `os.Open`/`filepath.Join` a user-supplied path directly in a handler — resolve through the jail. Any new FS endpoint needs a traversal negative test (see `TestTraversalBlocked`).
- **Auth token is compared in constant time over SHA-256 digests and is never read from the URL query** (leaks via logs/Referer/proxies). Token comes from `Authorization: Bearer` or the `webterm_token` cookie only. `token==""` = auth disabled (owner/localhost). Don't add query-param auth or non-constant-time comparisons.
- **WebSocket origin is checked** via `OriginPatterns`; empty = strict same-origin (blocks cross-site WS hijack). Don't default origins open.
- Default bind is `127.0.0.1`. Anything that would expose the server publicly without auth+TLS is a regression.

### Go
- Reply with the JSON helpers (`writeJSON`/`writeErr` in `server`, `httpJSON`/`httpErr`/`httpDecode` in `project`) — don't hand-roll `w.Write` for API responses. Errors return `{"error": "..."}`.
- Comments explain **why**, especially for security decisions (see `middleware.go`, `pathjail.go`) — match that density; don't narrate the obvious.
- Non-fatal subsystems degrade, not crash: push init failure logs and disables push rather than aborting startup. Keep that posture for optional features.

### Frontend
- Add a new endpoint as: `api.ts` wrapper (use the `j<T>` helper that throws on `!r.ok`) → a `use*` hook in `queries.ts`. **`encodeURIComponent` every query-string value** (existing wrappers all do).
- Use `import type { ... }` for type-only imports — `verbatimModuleSyntax` is on and will error otherwise. `noUnusedLocals`/`noUnusedParameters` are on — no dead code survives `tsc`.
- Editor/file content must not auto-refetch (`refetchOnWindowFocus: false` on `useFile`) — a background refetch would clobber unsaved edits. Preserve this when touching editor data.

### Tests
- Treat tests as part of the change, not a follow-up. Go handlers are tested with `httptest` + `t.TempDir()` (no real FS/network; see `fsapi_test.go`, `server_test.go`); pure frontend logic lives in `lib/*.ts` with a colocated `*.test.ts` (vitest + jsdom). Security-relevant paths get explicit negative tests (traversal rejected, auth rejected, origin rejected).
- oxlint runs `correctness` as **error** — lint must pass clean, no disable comments to dodge it.

## Spec workflow (optional)

`openspec/` + the `/opsx-*` commands (in `.cursor/commands/`, mirrored as Claude skills) provide an OpenSpec artifact-driven change workflow. It is scaffolded but lightly used; reach for it for larger multi-step changes, not small fixes.
