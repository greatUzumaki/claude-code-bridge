# WebTerm

[English](README.md) · [Русский](README.ru.md) · **中文**

> 自托管 Web 应用：左侧是项目侧边栏（支持子分组），右侧是经由 tmux 的**真实主机终端**，并在所选项目的目录中打开。命令直接在主机上运行；在浏览器里浏览和编辑项目文件。深色极简主题，移动端优先（PWA、屏幕按键栏、多屏、终端标签页、滑动手势）。单个内嵌前端的 Go 二进制文件——部署到 VPS = 上传文件 + systemd。主要用途：在手机上的终端里运行交互式 `claude`。

---

## 技术栈

- **后端 — Go (1.25)：** `net/http` 1.22 mux · `coder/websocket` · `creack/pty`（驱动 `tmux` 客户端）· `shirou/gopsutil`（CPU/内存/负载）· `embed.FS`。**主机需要 tmux**（`brew/apt install tmux`）。
- **前端 — React 19 + Vite + TypeScript：** Tailwind v4（`@theme` 令牌，亮/暗主题 + 强调色）· `@xterm/xterm`（+ fit/search）· CodeMirror 6 · `react-markdown` + `remark-gfm`（md 预览）· `lucide-react` · `vite-plugin-pwa`。Lint/格式化：**oxc**（`oxlint` + `oxfmt`）。

## 架构

```
浏览器 (React：全高侧边栏 + 内容区上方的头栏 + xterm + CodeMirror + 按键栏, PWA)
        │  HTTP + WebSocket
        ▼
单个 Go 二进制  (auth-seam 中间件；默认监听 127.0.0.1)
 ├── Static       → 内嵌的 React 构建产物 (embed.FS)
 ├── FS API       → list/read/write/mkdir/create/rename/delete + raw（图片）+ search   [限制在 --root 的路径监狱]
 ├── Project API  → 目录发现 + 子分组 (<root>/.webterm/layout.json) + git clone
 ├── Sys API      → git 状态（分支/dirty）· 主机资源（CPU/内存/负载）
 └── Terminal WS  → 通往每个项目持久 tmux 会话的轻量 PTY 桥（+ n 表示标签页）
```

- `--root` 下的每个顶层目录即一个项目。子分组只是 `layout.json` 中的元数据；分组**不会移动**磁盘上的目录。
- 每个项目一个 tmux 会话（`wt_<project>` / `wt_<project>_<n>`），可在 WS 断开**以及**二进制重启后存活；重连时终端会重绘。
- UI 状态（主题、强调色、触感、按键集合、置顶项目、字号）保存在 `localStorage`。活动会话圆点 + git/主机信息来自轮询轻量 JSON 端点。

## 仓库结构

```
webterm/                  # 应用（Go 后端 + 内嵌 React）
  cmd/webterm/            # main（参数、装配）
  internal/               # server, fsapi, project store, sysapi, tmux terminal, pathjail
  web/                    # React + Vite + TS（构建 → internal/server/dist，内嵌）
  deploy/                 # systemd unit + Caddyfile
  Makefile                # build/run/test/lint/fmt
scripts/setup-machine.sh  # 机器引导（git, node, python, tmux, Claude Code…）
docker-compose.yml        # 可选开发基础设施：Postgres 18 + Redis + MinIO + Jaeger
```
