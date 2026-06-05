# WebTerm

> Коротко о проекте: самохостируемое веб-приложение — слева сайдбар с проектами (можно группировать в подгруппы), справа **настоящий терминал машины** (через tmux), открытый в папке выбранного проекта. Команды выполняются прямо на хосте, файлы проекта можно смотреть и редактировать. Тёмная минималистичная тема, адаптив под телефон с экранной панелью клавиш (Esc, стрелки, Enter, Ctrl-C). Один Go-бинарник со встроенным фронтендом — деплой на VPS = закинуть файл + systemd.

A self-hosted web terminal + project file browser. Left sidebar = projects (groupable into subgroups). Right side = a real tmux-backed shell rooted in the selected project's directory. Browse/view/edit project files. Dark, minimal, phone-friendly. Ships as a single Go binary with the frontend embedded.

---

## Stack

**Backend — Go (1.25)**
- `net/http` (Go 1.22+ method-pattern mux) — no router dependency
- `github.com/coder/websocket` — terminal transport
- `github.com/creack/pty` — PTY that drives a `tmux` client
- **tmux** (host daemon) — owns terminal session lifetime, scrollback, repaint-on-attach
- `embed.FS` — the built frontend is baked into the binary → one static artifact

**Frontend — React 19 + Vite + TypeScript**
- Tailwind v4 — dark, minimal styling
- `@xterm/xterm` (+ fit addon) — the terminal (standard, not custom-designed)
- CodeMirror 6 (`@uiw/react-codemirror`) — file viewer/editor
- `lucide-react` — icons
- **oxc** (`oxlint` + `oxfmt`) — lint + format

**Requirement:** `tmux` must be installed on the host (`brew install tmux` / `apt install tmux`).

## Architecture

```
Browser (React: sidebar + xterm + CodeMirror + on-screen key bar)
        │  HTTP + WebSocket
        ▼
Single Go binary  (auth-seam middleware wraps everything; binds 127.0.0.1 by default)
 ├── Static server   → embedded React build (embed.FS)
 ├── FS API (JSON)   → list/read/write/mkdir/create/rename/delete   [path-jailed to --root]
 ├── Project API     → discover folders + subgroups (metadata in <root>/.webterm/layout.json)
 └── Terminal (WS)   → thin PTY bridge to a persistent tmux session per project
                       (tmux survives WS drops AND a restart of this binary)
```

Key design choices:
- **Project-centric:** click a project → a tmux session with cwd = the project folder. Multiple projects = multiple parallel live shells.
- **tmux persistence:** the shell lives in tmux, not in the web process. WS disconnect detaches (session keeps running); reconnect re-attaches and tmux repaints the full screen. This is what makes phone use viable across network drops — and lets you keep an interactive `claude` session running.
- **Subgroups are metadata, never disk moves:** grouping a project changes a label in `layout.json`; the folder never moves (won't break git remotes / paths / running processes).
- **Path jail:** every filesystem call is confined to `--root`; absolute paths, `../`, and symlinks that escape root are rejected.

## Features

- Project sidebar with collapsible **subgroups**; create projects and groups from the sidebar.
- Per-project **tmux terminal** (real shell, native commands run immediately, survives reconnect).
- Multiple **parallel** terminals (one per project, switchable).
- **"View files"** on the selected project → full-height file tree → open any file to view/edit/save (CodeMirror).
- **Mobile-first:** responsive layout — sidebar drawer + top bar on phones, columns on desktop. **44px tap targets**, clear lucide icons.
- **On-screen key bar** (keyboard-toggle button on the terminal): Esc · ↑ ↓ ← → · Enter · Ctrl-C — for typing control keys from a phone.

## Security posture

This serves a real shell on the host — it is, by nature, remote code execution. Safeguards built in:
- **Binds `127.0.0.1` by default** — not reachable from the network until you deliberately change `--addr`.
- **Auth seam** — one middleware gates every route. With `--token` set it requires `Authorization: Bearer <token>` or a `webterm_token` cookie, compared in **constant time** (SHA-256); the token is never accepted in the URL. Empty token = disabled (owner deferred auth).
- **Path jail** to `--root` (lexical + symlink-aware).
- **WebSocket origin allowlist** (`--allowed-origins`) blocks cross-site WebSocket hijacking; empty = strict same-origin.

> ⚠️ Before exposing on a public domain you MUST: set `--token`, terminate TLS (Caddy/Cloudflare or a Tailscale VPN), set `--allowed-origins https://your.domain`, and run as a non-root user. Deferring auth is fine ONLY while bound to localhost / a private VPN.

## Run (local)

```bash
# build the frontend (embeds into the binary) then the binary:
make build                      # = cd web && npm install && npm run build ; go build -o webterm ./cmd/webterm

# run, jailed to a projects directory, on localhost:
make run ROOT=~/Projects        # → http://127.0.0.1:7070
# or directly:
./webterm --root ~/Projects --addr 127.0.0.1:7070
```

Each top-level folder under `--root` becomes a project in the sidebar (auto-discovered). During development the Vite dev server proxies `/api` and `/ws` to the Go backend (`make dev` prints the two commands).

### Make targets
`make build` · `make run ROOT=…` · `make test` (Go + Vitest) · `make lint` (oxlint) · `make fmt` (gofmt + oxfmt) · `make dev` · `make help`

## Dev infrastructure (optional)

`../docker-compose.yml` brings up Postgres 18 + Redis + MinIO + Jaeger for projects you work on (ports bound to `127.0.0.1`):

```bash
cp ../.env.example ../.env      # edit secrets
docker compose -f ../docker-compose.yml up -d
```
Postgres `:5432` · Redis `:6379` · MinIO API `:9000` / console `:9001` · Jaeger UI `:16686`, OTLP `:4318`/`:4317`.

## Deploy

Templates in `deploy/`: `webterm.service` (systemd) + `Caddyfile.example` (TLS reverse proxy). Build the binary, copy it + the embedded frontend, set `--token` / `--allowed-origins`, front it with Caddy or a Tailscale VPN.

## Project docs

- **Spec:** `../docs/superpowers/specs/2026-06-05-webterm-design.md`
- **Plan:** `../docs/superpowers/plans/2026-06-05-webterm.md`

Built with a spec → plan → subagent-driven-development workflow. Backend logic is unit-tested (path jail incl. symlink escape, tmux session helper, project/group store, a tmux-gated WebSocket integration test proving reconnect persistence); the React UI is build-and-verify.
