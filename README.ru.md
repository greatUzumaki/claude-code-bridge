# WebTerm

[English](README.md) · **Русский** · [中文](README.zh.md)

> Самохостируемое веб-приложение: слева сайдбар с проектами (с подгруппами), справа **настоящий терминал машины** через tmux, открытый в папке выбранного проекта. Команды идут прямо на хосте; файлы проекта смотришь и редактируешь в браузере. Тёмная минималистичная тема, заточено под телефон (PWA, экранная панель клавиш, мультискрин, вкладки терминалов, свайпы). Один Go-бинарник со встроенным фронтендом — деплой на VPS = закинуть файл + systemd. Главный кейс: гонять интерактивный `claude` в терминале с телефона.

---

## Стек

- **Бэкенд — Go (1.25):** `net/http` 1.22 mux · `coder/websocket` · `creack/pty` (драйвит клиент `tmux`) · `shirou/gopsutil` (CPU/mem/load) · `embed.FS`. **На хосте нужен tmux** (`brew/apt install tmux`).
- **Фронтенд — React 19 + Vite + TypeScript:** Tailwind v4 (`@theme`-токены, светлая/тёмная тема + акцент) · `@xterm/xterm` (+ fit/search) · CodeMirror 6 · `react-markdown` + `remark-gfm` (превью md) · `lucide-react` · `vite-plugin-pwa`. Линт/формат: **oxc** (`oxlint` + `oxfmt`).

## Архитектура

```
Браузер (React: сайдбар во всю высоту + шапка над контентом + xterm + CodeMirror + key bar, PWA)
        │  HTTP + WebSocket
        ▼
Один Go-бинарник  (auth-seam middleware; по умолчанию слушает 127.0.0.1)
 ├── Static       → встроенный билд React (embed.FS)
 ├── FS API       → list/read/write/mkdir/create/rename/delete + raw (картинки) + search   [path-jail к --root]
 ├── Project API  → дискавери папок + подгруппы (<root>/.webterm/layout.json) + git clone
 ├── Sys API      → git-статус (ветка/dirty) · ресурсы хоста (CPU/mem/load)
 └── Terminal WS  → тонкий PTY-мост к постоянной tmux-сессии на проект (+ n для вкладок)
```

- Каждая папка верхнего уровня под `--root` = проект. Подгруппы — метаданные в `layout.json`; группировка **не двигает** папки на диске.
- tmux-сессия на проект (`wt_<project>` / `wt_<project>_<n>`) переживает обрыв WS **и** рестарт бинарника; терминал перерисовывается на reconnect.
- Состояние UI (тема, акцент, haptic, набор клавиш, pinned-проекты, размер шрифта) — в `localStorage`. Точки активных сессий + git/ресурсы — поллинг лёгких JSON-эндпоинтов.

## Структура репо

```
webterm/                  # приложение (Go-бэкенд + встроенный React)
  cmd/webterm/            # main (флаги, wiring)
  internal/               # server, fsapi, project store, sysapi, tmux terminal, pathjail
  web/                    # React + Vite + TS (билд → internal/server/dist, embed)
  deploy/                 # systemd unit + Caddyfile
  Makefile                # build/run/test/lint/fmt
scripts/setup-machine.sh  # бутстрап машины (git, node, python, tmux, Claude Code…)
docker-compose.yml        # опц. дев-инфра: Postgres 18 + Redis + MinIO + Jaeger
```
