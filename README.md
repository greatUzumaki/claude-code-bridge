# WebTerm

> Коротко: самохостируемое веб-приложение — слева сайдбар с проектами (с подгруппами), справа **настоящий терминал машины** (через tmux), открытый в папке выбранного проекта. Команды выполняются прямо на хосте, файлы проекта смотришь и редактируешь. Тёмная минималистичная тема, заточено под телефон (PWA, экранная панель клавиш, мультискрин, вкладки). Один Go-бинарник со встроенным фронтендом — деплой на VPS = закинуть файл + systemd. Главный кейс: гонять интерактивный `claude` в терминале с телефона.

A self-hosted web terminal + project file browser. Left sidebar = projects (groupable into subgroups). Right side = a real tmux-backed shell rooted in the selected project. Browse/view/edit files. Dark, minimal, phone-first. Single Go binary with the frontend embedded.

---

## Repo layout

```
webterm/                  # the app (Go backend + embedded React frontend)
  cmd/webterm/            # main (flags, wiring)
  internal/               # server, fsapi, project store, tmux terminal, pathjail
  web/                    # React + Vite + TS frontend (builds → internal/server/dist, embedded)
  deploy/                 # systemd unit + Caddyfile template
  Makefile                # build / run / test / lint / fmt
  IDEAS.md                # roadmap & feature backlog
scripts/setup-machine.sh  # bootstrap a machine (git, node, python, tmux, Claude Code…)
docker-compose.yml        # optional dev infra: Postgres 18 + Redis + MinIO + Jaeger
.env.example              # env for docker-compose
docs/superpowers/         # design spec + implementation plan
```

## Features

**Terminal**
- tmux-backed per-project shell — survives WS drops AND a restart of the binary; repaint on reconnect.
- **Multiple terminals per project** (tabs, ＋, renamable) and **multiscreen** grid (flexible cols×rows, per-cell project, active-cell focus).
- In-terminal **search**, **font size** (persisted), **connection indicator**.
- On-screen **key bar** (Esc/Tab/Enter/Ctrl-C on top, arrows below), Ctrl-C confirm modal.

**Projects / files**
- Sidebar with collapsible **subgroups**; create project/group; **drag project → group** (desktop) + **group-settings modal** (add/remove/rename/delete, phone-friendly).
- **"View files"** → full-height file tree → open any file in a dark CodeMirror editor (view/edit/save, large-file guard).

**Mobile / app feel**
- **PWA** — installable (home screen), offline app shell, **wake-lock** (screen stays on), **safe-area** insets.
- Responsive: sidebar is a static column ≥1440px, a slide-over drawer below.

## Stack

- **Backend — Go (1.25):** `net/http` 1.22 mux · `coder/websocket` · `creack/pty` (drives a `tmux` client) · `embed.FS`. **tmux required on the host** (`brew/apt install tmux`).
- **Frontend — React 19 + Vite + TypeScript:** Tailwind v4 (`@theme` tokens) · `@xterm/xterm` (+ fit/search addons) · CodeMirror 6 · `lucide-react` · `vite-plugin-pwa`. Lint/format: **oxc** (`oxlint` + `oxfmt`).

## Architecture

```
Browser (React: sidebar + xterm + CodeMirror + key bar)  ── PWA, wake-lock, safe-area
        │  HTTP + WebSocket
        ▼
Single Go binary  (auth-seam middleware; binds 127.0.0.1 by default)
 ├── Static server   → embedded React build (embed.FS)
 ├── FS API (JSON)   → list/read/write/mkdir/create/rename/delete   [path-jailed to --root]
 ├── Project API     → discover folders + subgroups (metadata in <root>/.webterm/layout.json)
 └── Terminal (WS)   → thin PTY bridge to a persistent tmux session per project (+ n for tabs)
```

Each top-level folder under `--root` is a project. Subgroups are metadata in `layout.json` — grouping never moves folders on disk.

## Run (local)

```bash
cd webterm
make build                 # frontend → embed → go build -o webterm
make run ROOT=~/Projects   # → http://127.0.0.1:7070
# or: ./webterm --root ~/Projects --addr 127.0.0.1:7070
```
Make targets: `make build` · `make run ROOT=…` · `make test` (Go + Vitest) · `make lint` (oxlint) · `make fmt` (gofmt + oxfmt) · `make dev` · `make help`.

## Bootstrap a machine

`scripts/setup-machine.sh` installs the toolchain for working with code (git, build tools, **tmux**, Python 3, Node 24 LTS, ripgrep, jq, and **Claude Code** via the native installer). Debian/Ubuntu (apt), Fedora/RHEL (dnf), macOS (brew).

```bash
bash scripts/setup-machine.sh
# or remote:
curl -fsSL https://raw.githubusercontent.com/greatUzumaki/claude-code-bridge/main/scripts/setup-machine.sh | bash
```
Then `claude` to log in — use the interactive CLI (not `claude -p`/SDK) to stay on the cheaper subscription bucket.

## Dev infrastructure (optional)

`docker-compose.yml` brings up Postgres 18 + Redis + MinIO + Jaeger for projects you work on (ports bound to `127.0.0.1`):

```bash
cp .env.example .env       # edit secrets
docker compose up -d
```
Postgres `:5432` · Redis `:6379` · MinIO API `:9000` / console `:9001` · Jaeger UI `:16686`, OTLP `:4318`/`:4317`.

## Security posture

Serving a real shell = remote code execution. Safeguards:
- **Binds `127.0.0.1` by default** — unreachable from the network until you change `--addr`.
- **Auth seam** — `--token` requires `Authorization: Bearer <token>` or a `webterm_token` cookie, constant-time SHA-256 compare; token never in the URL. Empty = disabled (deferred).
- **Path jail** to `--root` (lexical + symlink-aware); project names traversal-validated.
- **WS origin allowlist** (`--allowed-origins`) blocks cross-site WebSocket hijacking.

> ⚠️ Before exposing on a public domain: set `--token`, terminate TLS (Caddy/Cloudflare or a Tailscale VPN), set `--allowed-origins https://your.domain`, run as a non-root user. See `webterm/deploy/`.

## Roadmap

See **`webterm/IDEAS.md`** for the backlog and proposed features. Design docs: `docs/superpowers/specs/` and `docs/superpowers/plans/`.
