# WebTerm

**English** · [Русский](README.ru.md) · [中文](README.zh.md)

> Self-hosted web app: left sidebar = projects (with subgroups), right = a **real machine terminal** via tmux, opened in the selected project's folder. Commands run on the host; browse and edit project files in the browser. Dark minimal theme, phone-first (PWA, on-screen key bar, multiscreen, terminal tabs, swipes). Single Go binary with the frontend embedded — deploying to a VPS = drop the file + systemd. Main use case: run interactive `claude` in a terminal from a phone.

---

## Stack

- **Backend — Go (1.25):** `net/http` 1.22 mux · `coder/websocket` · `creack/pty` (drives a `tmux` client) · `shirou/gopsutil` (CPU/mem/load) · `embed.FS`. **tmux required on the host** (`brew/apt install tmux`).
- **Frontend — React 19 + Vite + TypeScript:** Tailwind v4 (`@theme` tokens, light/dark + accent) · `@xterm/xterm` (+ fit/search) · CodeMirror 6 · `react-markdown` + `remark-gfm` (md preview) · `lucide-react` · `vite-plugin-pwa`. Lint/format: **oxc** (`oxlint` + `oxfmt`).

## Architecture

```
Browser (React: full-height sidebar + header over content + xterm + CodeMirror + key bar, PWA)
        │  HTTP + WebSocket
        ▼
Single Go binary  (auth-seam middleware; binds 127.0.0.1 by default)
 ├── Static       → embedded React build (embed.FS)
 ├── FS API       → list/read/write/mkdir/create/rename/delete + raw (images) + search   [path-jailed to --root]
 ├── Project API  → folder discovery + subgroups (<root>/.webterm/layout.json) + git clone
 ├── Sys API      → git status (branch/dirty) · host stats (CPU/mem/load)
 └── Terminal WS  → thin PTY bridge to a persistent tmux session per project (+ n for tabs)
```

- Each top-level folder under `--root` is a project. Subgroups are metadata in `layout.json`; grouping **never moves** folders on disk.
- A tmux session per project (`wt_<project>` / `wt_<project>_<n>`) survives WS drops **and** a restart of the binary; the terminal repaints on reconnect.
- UI state (theme, accent, haptics, key set, pinned projects, font size) lives in `localStorage`. Active-session dots + git/host info come from polling lightweight JSON endpoints.

## Repo structure

```
webterm/                  # the app (Go backend + embedded React)
  cmd/webterm/            # main (flags, wiring)
  internal/               # server, fsapi, project store, sysapi, tmux terminal, pathjail
  web/                    # React + Vite + TS (builds → internal/server/dist, embedded)
  deploy/                 # systemd unit + Caddyfile
  Makefile                # build/run/test/lint/fmt
scripts/setup-machine.sh  # bootstrap a machine (git, node, python, tmux, Claude Code…)
docker-compose.yml        # optional dev infra: Postgres 18 + Redis + MinIO + Jaeger
```
