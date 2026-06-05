# WebTerm — Design Spec

**Date:** 2026-06-05
**Status:** Approved (design), pre-implementation

## Goal

A self-hosted web application giving its owner a **native machine terminal** and a **filesystem browser/editor** through the browser, usable from a phone. Commands typed in the web terminal execute immediately on the host machine (real PTY). Files can be browsed, viewed, edited, and projects created. Deployed to the owner's existing VPS; reached by domain (TLS/hardening is a later phase).

Single user (the owner). Not multi-tenant.

### Primary interaction model — project-centric

The UI is organized around **projects** (top-level folders under the root directory):

- **Left sidebar = project switcher.** Lists projects organized into optional collapsible **subgroups**; lets the owner switch between projects and **create new projects and groups directly from the sidebar**.
- **Right area = the terminal**, filling the rest of the screen.
- **Clicking a project opens (or focuses) a terminal whose working directory is that project's folder.** Each terminal is scoped to its project's directory (`cmd.Dir = project path`).
- Multiple projects can have live terminals at once (parallel sessions); switching projects in the sidebar switches the active terminal. Sessions persist across reconnects.
- **Selected project has a "view files" button.** Pressing it reveals that project's file tree; clicking any file opens it for viewing (and editing) in a pane on the right, closable to return to the terminal. File browsing is opt-in per project (button), not always-on — the terminal stays the dominant view.

### Subgroups (sidebar organization)

- Projects can be combined into **subgroups** purely for sidebar organization. A group is an **organizational container, not a directory** — grouping a project changes a label/assignment, it never moves the folder on disk (avoids breaking paths, git remotes, running processes).
- Arrangement (groups, which project is in which group, ordering, collapsed state) is stored in a small **`layout.json`** under `<root>/.webterm/`. Projects themselves remain folders under the root, wherever they physically are.
- **Auto-discovery:** listing projects scans the root for project folders and merges them with the saved layout. Folders not yet placed in a group appear **ungrouped** at the top level. No manual registration; the sidebar never drifts from what's on disk.
- Operations: create group, rename group, delete group (its projects fall back to ungrouped), and move a project into / out of a group with an order. Create-project can target a group.

## Non-goals (this version)

- TLS / domain / reverse proxy setup (later phase; design leaves a clean seam).
- Real authentication turned on (owner deferred; a no-op seam + safe defaults are built in).
- Multi-user / RBAC.
- File upload/download, drag-drop.
- Persisting terminal scrollback to disk across server restarts.

## Security posture (explicit)

This app is, by definition, remote code execution on the host. The owner chose to defer auth. To make deferral non-catastrophic:

1. **Default bind `127.0.0.1`** — the server is unreachable from the network until the owner deliberately sets a different bind address / fronts it with a proxy. No accidental exposure.
2. **Auth seam** — a single middleware wraps every HTTP and WS route. It is a pass-through no-op now; enabling real auth later = implement one function + set a flag, no structural change.
3. **Path jail** — every filesystem operation resolves its target and rejects anything outside a configured root directory (`--root`). Blocks path traversal; caps blast radius.
4. **Deploy note** — README/deploy docs MUST state: exposing to a public domain REQUIRES enabling auth + TLS first. The two safety rails above make this the conscious, not the default, path.

## Stack

**Backend — Go (1.22+)**
- `net/http` with the 1.22 `ServeMux` (method+pattern routing) — no router dependency.
- `github.com/coder/websocket` — WebSocket transport (context-aware, maintained). *(alt: `gorilla/websocket`)*
- `github.com/creack/pty` — spawn real shells with a PTY.
- `embed.FS` — the built frontend is embedded into the binary → single static artifact.

**Frontend — React + Vite + TypeScript**
- Tailwind CSS + shadcn/ui — polished, responsive UI.
- `@xterm/xterm` + `@xterm/addon-fit` + `@xterm/addon-web-links` — standard terminal (no custom terminal UI).
- CodeMirror 6 — file editor (lightweight, mobile-friendly). *(alt: Monaco — heavier on phone)*
- Light client state (React state; add `zustand` only if needed).

**Build/deploy:** `vite build` → output embedded via `embed.FS` → `go build` → single binary → VPS via `scp` + `systemd` unit (later: Caddy for TLS+domain).

## Architecture

Single Go binary serves three concerns behind the auth-seam middleware:

```
Browser (React + xterm.js + CodeMirror)
        │  HTTPS later / HTTP now (localhost)
        ▼
Go binary
 ├── Static server      → embedded React build (embed.FS)
 ├── FS service (JSON)  → list/read/write/mkdir/create/rename/delete, project create   [path-jailed]
 └── Terminal service   → WS; thin PTY bridge to persistent tmux sessions
```

### Terminal service (the core) — tmux-backed

The session/persistence layer is delegated to **tmux** (a separate daemon on the host). The Go server is only a thin bridge: a PTY running a `tmux` client, piped over the WebSocket. tmux owns persistence, scrollback, reflow, and screen-repaint-on-attach — giving a true native terminal that survives both WebSocket drops AND restarts of the Go web server. (Requires `tmux` installed on the host: `apt install tmux`.)

- **Persistent sessions:** each WebTerm terminal maps to a deterministic tmux session name `wt_<projectId>` (or `wt_<projectId>_<n>` for additional terminals in the same project). The real shell (and anything long-running inside it, e.g. an interactive `claude` session) lives in tmux, not in the Go process.
- **Project-scoped:** the tmux session is created with its working directory set to the project's folder (`tmux new-session -A -s wt_<id> -c <projectDir>`), so the terminal opens **inside that project's directory**.
- **Create / attach (same command):** WS connect to `/ws/term?project=<id>` → server spawns a PTY running `tmux -u new-session -A -s wt_<id> -c <dir>` (`-A` = attach if it exists, else create). On (re)attach tmux **repaints the full current screen** — no hand-rolled replay buffer needed.
- **Detach, don't kill, on disconnect:** when the WebSocket closes, the server kills only the thin PTY (the tmux client). tmux detaches and the session keeps running. Reconnect spawns a fresh PTY that re-attaches the same tmux session. This is what makes phone use viable across network drops.
- **Looks like a normal terminal:** tmux is made invisible — `status off` (no status bar), large `history-limit`, and a minimal config so the user sees only their shell, not tmux chrome.
- **I/O:** PTY stdout → WebSocket; WebSocket binary frames → PTY stdin (keystrokes); text control frames → `resize {cols,rows}` applied to the PTY winsize (tmux follows the attached client size).
- **Multiple parallel terminals:** distinct tmux session names coexist; the UI activates one per selected project. `GET /api/term/list` runs `tmux list-sessions` (filtered to `wt_` prefix); `POST /api/term/kill` runs `tmux kill-session`. "Held until you close it" = the tmux session persists until explicitly killed.
- **Why not a hand-rolled PTY+ring-buffer manager:** tmux is battle-tested, repaints perfectly on reattach, survives a web-server restart, and is less code. The trade-off (a `tmux` dependency) is trivial on a VPS.

### FS service

All paths resolved against `--root`; reject if the cleaned absolute path escapes root.

| Method | Route | Body / Query | Action |
|---|---|---|---|
| GET | `/api/fs/list` | `?path=` | list dir entries (name, type, size, mtime) |
| GET | `/api/fs/read` | `?path=` | file contents (+ detect binary; cap size) |
| PUT | `/api/fs/write` | `{path, content}` | overwrite/save file |
| POST | `/api/fs/mkdir` | `{path}` | create directory |
| POST | `/api/fs/create` | `{path, content?}` | create new file |
| POST | `/api/fs/rename` | `{from, to}` | rename/move |
| DELETE | `/api/fs/delete` | `?path=` | delete file/dir |
| GET | `/api/projects/list` | — | discover project folders under root, merge with `layout.json` → groups + projects (with order, live-session flag) |
| POST | `/api/projects/create` | `{name, groupId?, gitInit?}` | mkdir project under root; optional `git init`; optional group assignment |
| POST | `/api/projects/move` | `{projectId, groupId\|null, order}` | reassign a project's group / order (metadata only — no disk move) |
| POST | `/api/groups/create` | `{name}` | create a sidebar subgroup |
| POST | `/api/groups/rename` | `{groupId, name}` | rename a subgroup |
| DELETE | `/api/groups/delete` | `?groupId=` | delete a subgroup; its projects fall back to ungrouped |

**Layout state** lives in `<root>/.webterm/layout.json`:

```json
{
  "groups":   [ { "id": "g1", "name": "Work",  "order": 0, "collapsed": false } ],
  "projects": [ { "id": "p1", "name": "api", "path": "api", "groupId": "g1", "order": 0 } ]
}
```

The `path` is relative to root. On `list`, the server scans root for folders, reconciles with this file (adds new folders as ungrouped, drops entries whose folders vanished), and returns the merged tree. Writes are serialized (single-user, mutex-guarded).

Read caps very large/binary files (return metadata + a "too large / binary" flag instead of streaming megabytes into the editor).

### Frontend UI

**Aesthetic: dark + minimal.** Single dark theme (no theme switcher). Minimalism is a hard constraint: few colors (one neutral dark base + one subtle accent), no gradients/shadows/chrome clutter, generous spacing, no decorative elements. Only what's needed: project list, terminal, occasional file editor. The terminal is the hero; UI furniture stays out of the way.

- **Layout:** left = **project sidebar** (narrow, collapsible); right = **terminal**, filling the remaining area. Clicking a project activates its terminal (cwd = project). Projects with live sessions show a subtle "active" dot.
- **Sidebar:** projects grouped under optional **collapsible subgroups**, ungrouped projects at top. Quiet affordances to **＋ new project** and **＋ new group**. Reassigning a project to a group (move) available via a minimal menu/drag. Minimal iconography, no clutter.
- **Selected project:** shows a **"view files"** button. Toggling it reveals the project's file tree (lazy-loaded on expand); clicking a file opens it in the right-side viewer/editor. Other quiet per-project actions: new file/folder, rename, delete, open second terminal.
- **Terminal pane (the main view):** xterm + fit addon; fills the right area; sends resize on layout change; reconnect logic re-attaches to the project's session id and consumes the replay. Optional small control to open a second terminal for the same project.
- **Editor/viewer pane:** opening a file slides a CodeMirror 6 pane over/beside the terminal; closable to return to the terminal. Dark editor theme matching the app; language detection by extension; view + save (PUT write) with a minimal dirty indicator.
- **Responsive (phone):** sidebar becomes a slide-over drawer (hidden by default); terminal fills the screen. Keep touch targets adequate but visually minimal. Dark by default everywhere.

## Project layout

```
webterm/
├── cmd/webterm/main.go          # flags (--root, --addr default 127.0.0.1:7070, --shell), wire-up
├── internal/
│   ├── server/        # http mux, middleware (auth seam), static embed
│   ├── terminal/      # tmux-backed: pty bridge, session naming, list/kill, ws handler
│   ├── fsapi/         # filesystem handlers + path jail
│   └── project/       # project + group discovery, layout.json, create/move
├── web/               # React+Vite+TS frontend (built → embedded)
│   ├── src/{components,panes,lib,...}
│   └── dist/          # build output embedded via embed.FS
├── deploy/            # systemd unit + Caddyfile template (later phase)
└── README.md          # run + the security/deploy warning
```

## Build sequence (high level)

1. Backend skeleton: flags, mux, static-embed placeholder, auth-seam middleware, localhost bind, health check.
2. Terminal service (tmux-backed): tmux session helper (new-A/list/kill, deterministic names, status-off config) + PTY bridge + WS + resize; verify create/detach/reattach + repaint.
3. FS service: path jail + all fs endpoints.
4. Project + group service: discover folders, `layout.json` reconcile, projects/groups CRUD + move, project create (+gitInit).
5. Frontend scaffold: Vite+React+TS+Tailwind+shadcn; dark+minimal layout shell (project sidebar | terminal area).
6. Project sidebar: grouped/collapsible project list, new-project + new-group, move-to-group; click project → xterm wired to WS attaching the project's tmux session; parallel project sessions; reconnect re-attaches (tmux repaints).
7. "View files" + editor/viewer pane: per-project file tree toggle, open file to view, edit/save, create/rename/delete.
8. Embed frontend build into binary; end-to-end run on localhost.
9. (Later phase) Deploy assets: systemd unit, Caddyfile, README hardening steps.

## Testing approach

- **Go:** unit-test the path jail (traversal attempts must fail), the tmux command builder (correct `new-session -A -s wt_<id> -c <dir>` / list / kill args), and the project/group store (discover/reconcile/move persist). Integration-test FS endpoints against a temp root.
- **Terminal:** integration test gated on `tmux` being installed (skip if absent) — open WS, send `echo hi`, assert echoed output; close WS and reconnect, assert the tmux session still exists and repaints (output still present).
- **Frontend:** component-level checks for the panes; manual phone-viewport check (responsive drawer/tabs) before declaring done.

## Open questions (none blocking)

- Editor: CodeMirror 6 chosen; switch to Monaco only if richer IntelliSense is wanted (heavier on mobile).
- Project templates beyond bare folder + `git init` deferred until requested.
