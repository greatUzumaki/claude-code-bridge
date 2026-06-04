# WebTerm

> Коротко о проекте: самохостируемое веб-приложение — слева сайдбар с проектами (можно группировать в подгруппы), справа **настоящий терминал машины**, открытый в папке выбранного проекта. Команды выполняются прямо на хосте, файлы проекта можно смотреть и редактировать. Тёмная минималистичная тема, рассчитано на работу с телефона. Один Go-бинарник со встроенным фронтендом — деплой на свой VPS = закинуть файл + systemd.

A self-hosted web terminal + project file browser. Left sidebar = projects (groupable into subgroups). Right side = a real PTY shell rooted in the selected project's directory. Browse/view/edit project files. Dark, minimal, phone-friendly. Ships as a single Go binary with the frontend embedded.

---

## Stack (final)

**Backend — Go (1.25)**
- `net/http` (Go 1.22+ method-pattern mux) — no router dependency
- `github.com/coder/websocket` — terminal transport
- `github.com/creack/pty` — real shells (PTY)
- `embed.FS` — the built frontend is baked into the binary → one static artifact

**Frontend — React + Vite + TypeScript**
- Tailwind CSS — dark, minimal styling
- `@xterm/xterm` (+ fit addon) — the terminal (standard, not custom-designed)
- CodeMirror 6 (`@uiw/react-codemirror`) — file viewer/editor

**Deploy (later phase):** single binary → VPS via `scp` + `systemd`; Caddy reverse-proxy for TLS + domain.

## Architecture

```
Browser (React: sidebar + xterm + CodeMirror)
        │  HTTP + WebSocket
        ▼
Single Go binary  (auth-seam middleware wraps everything; binds 127.0.0.1 by default)
 ├── Static server     → embedded React build (embed.FS)
 ├── FS API (JSON)     → list/read/write/mkdir/create/rename/delete   [path-jailed to --root]
 ├── Project API       → discover folders + subgroups (metadata in .webterm/layout.json)
 └── Terminal (WS)     → PTY session manager; sessions live server-side,
                          ring-buffer replay on reconnect (survives phone network drops)
```

Key design choices:
- **Project-centric:** click a project → terminal with `cmd.Dir = project folder`. Multiple projects = multiple parallel live shells.
- **Reconnect survival:** PTYs live independent of the WebSocket; reconnect re-attaches to the same shell and replays recent output. This is what makes phone use viable.
- **Subgroups are metadata, never disk moves:** grouping a project changes a label in `layout.json`; the folder never moves (won't break git remotes / paths / running processes).
- **Path jail:** every filesystem call is confined to `--root`; absolute paths and `../` are rejected.

## Features

- Project sidebar with collapsible **subgroups**; create projects and groups from the sidebar.
- Per-project **terminal** (real shell, native commands run immediately).
- Multiple **parallel** terminals (one per project, switchable).
- **"View files"** on the selected project → file tree → open any file to view/edit/save.
- Dark, minimal, responsive (sidebar collapses to a drawer on phones).

## Security posture

This serves a real shell on the host — it is, by nature, remote code execution. Safeguards built in:
- **Binds `127.0.0.1` by default** — not reachable from the network until you deliberately change `--addr`.
- **Auth seam** — one middleware gates every route. Pass `--token` to require `Authorization: Bearer <token>` (or `?token=`); empty token = disabled (owner deferred auth).
- **Path jail** to `--root`.
- **WebSocket origin allowlist** (`--allowed-origins`) blocks cross-site WebSocket hijacking; empty = strict same-origin.

> ⚠️ Before exposing on a public domain you MUST: set `--token`, terminate TLS (Caddy/Cloudflare or a Tailscale VPN), set `--allowed-origins https://your.domain`, and run as a non-root user. Deferring auth is fine ONLY while bound to localhost / a private VPN.

## How it's being built

Built with a spec → plan → subagent-driven workflow:
- **Spec:** `../docs/superpowers/specs/2026-06-05-webterm-design.md` (design, decisions, security).
- **Plan:** `../docs/superpowers/plans/2026-06-05-webterm.md` (16 bite-sized TDD tasks with exact code).
- **Execution:** a fresh subagent implements each task test-first (TDD on backend logic), commits, then the work is reviewed before the next task. Backend logic is unit-tested (path jail, ring buffer, PTY sessions, WS reattach, project/group store + a real-shell echo and a WebSocket integration test); the React UI is build-and-verify plus a manual phone-viewport check.

## Status

Work in progress (greenfield, branch `webterm`):
- [x] Task 0 — module + branch scaffold
- [x] Task 1 — path jail (traversal-rejection tested)
- [ ] Tasks 2–8 — server skeleton, FS API, project/group store, terminal (ring buffer, sessions, WS), static embed
- [ ] Tasks 9–14 — React UI (scaffold, api client, terminal hook, sidebar, file tree + editor, app shell)
- [ ] Task 15 — README deploy templates (systemd, Caddy)

## Run (local, once built)

```bash
# backend deps already vendored via go.mod; build the frontend then the binary:
cd web && npm install && npm run build
cd .. && go build -o webterm ./cmd/webterm

# run, jailed to a projects directory, on localhost:
./webterm --root /path/to/your/projects        # http://127.0.0.1:7070
```

During development the Vite dev server proxies `/api` and `/ws` to the Go backend on `:7070`.
