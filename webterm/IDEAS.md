# WebTerm — Ideas & Roadmap

Living backlog. **📱** = value when used from a phone (1–3). **⚙️** = effort (low/med/high). **⭐** = top picks.

---

## ✅ Done

- Project sidebar with subgroups; create project/group (custom modal); **drag project → group** (desktop) + **group-settings modal** (add/remove/rename/delete, phone-friendly).
- tmux-backed per-project terminal; survives WS drops & server restart; reconnect repaint.
- **Multiscreen** grid with flexible cols×rows; per-cell project; active-cell focus.
- **Per-project terminal tabs** (＋), switch instantly, **rename tab**.
- On-screen key bar (two rows: Esc/Tab/Enter/Ctrl-C + arrows), Ctrl-C confirm modal, evenly distributed keys.
- Terminal **search**, **font size** (persisted), **connection indicator**.
- **PWA** (installable, offline shell), **wake-lock**, **safe-area** insets.
- Sidebar collapses to drawer < 1440px. File tree (full height) + CodeMirror editor (too-large guard).
- Dark/minimal, unified Tailwind `@theme` tokens. Go single binary, path-jailed, auth seam, oxc lint/format.

---

## 🎯 Backlog (agreed, not yet built)

| Idea | 📱 | ⚙️ | Notes |
|---|---|---|---|
| ⭐ Command snippets / quick-run buttons | 📱📱📱 | med | Per-project + global; tap → insert/run (`claude`, `git status`, `npm run dev`). localStorage first, server-side later. |
| Ctrl-mode (sticky) | 📱📱📱 | low | Toggle "Ctrl"; next letter = Ctrl+letter. Covers Ctrl-A…Z one button. |
| Copy terminal output | 📱📱 | low-med | Selection → clipboard; "copy last output". |
| File upload / download | 📱📱 | med-high | Share files phone ↔ machine; new Go endpoints. |
| Login screen (passcode/token) | 📱📱 | med | Before exposing on a domain; backend seam exists, needs UI + cookie. |

---

## 💡 Proposed — new ideas

### Automation / Claude
| Idea | 📱 | ⚙️ | Notes |
|---|---|---|---|
| ⭐ Notify when command/claude finishes or waits | 📱📱📱 | med | xterm BEL (`\x07`) + activity/silence → Notification + vibrate. Web Push (app closed) = high. |
| ⭐ Per-project startup command | 📱📱 | med | Auto-run on first terminal open (`claude`, `nvm use`, `source .venv`). |
| One-tap "run claude" | 📱 | low | Button sends `claude\n` to active terminal. |
| Output pattern watch → notify | 📱📱 | med | Regex on output ("error", "build complete", "?") → ping. |

### Input (phone ergonomics)
| Idea | 📱 | ⚙️ | Notes |
|---|---|---|---|
| ⭐ Voice input (Web Speech) | 📱📱📱 | med | Dictate prompt/command → insert. iOS Safari support partial — verify. |
| Configurable key bar | 📱📱 | med | User picks which keys appear. |
| Swipe gestures | 📱📱 | med | Swipe = switch tabs / send arrows; two-finger scroll. |
| Command palette (Cmd-K) | 📱📱 | med | Fuzzy search projects / actions / snippets. |
| Bottom-sheet snippets drawer | 📱📱 | med | Quick swipe-up panel of commands. |

### Output / interaction
| Idea | 📱 | ⚙️ | Notes |
|---|---|---|---|
| ⭐ Tap file path / URL in output | 📱📱 | med | Path → open in editor (resolve vs project); URL → browser (links addon). |
| Tap-to-copy line / long-press select | 📱📱 | low-med | Easier copy on touch. |
| Clear / scroll-to-top buttons | 📱 | low | Plus existing scroll-to-bottom. |
| Bell sound/visual toggle | 📱 | low | Visual flash vs audible. |

### Sessions / continuity
| Idea | 📱 | ⚙️ | Notes |
|---|---|---|---|
| ⭐ Session manager | 📱📱 | med | List all live tmux sessions (per project), attach/kill, "what's running where". |
| ⭐ Active-session dots on projects | 📱📱 | med | Sidebar dot for projects with live sessions (`term/list`). |
| Resume last project/tab on open | 📱📱 | low | Persist last context (localStorage). |
| Broadcast input (multiscreen) | 📱 | med | Type once → all panes (tmux synchronize-panes vibe). |
| Save/restore named multiscreen layouts | 📱 | med | Recall a grid + project assignment. |
| Confirm-close terminal with running process | 📱 | low | Avoid accidental detach loss perception. |

### Files
| Idea | 📱 | ⚙️ | Notes |
|---|---|---|---|
| Image preview / markdown render in viewer | 📱📱 | med | Currently text only. |
| File search by name (fuzzy) | 📱📱 | med | Within a project. |
| Editor tabs (multi-file) | 📱 | med | Open several files. |
| New terminal at folder / file actions in tree | 📱 | low-med | "Open terminal here", rename/delete/download. |
| Create project from git clone URL | 📱📱 | med | Paste repo → clone into root. |
| Diff/preview before save | 📱 | med | Show changes before writing. |

### Native / PWA
| Idea | 📱 | ⚙️ | Notes |
|---|---|---|---|
| Web Push (task done, app closed) | 📱📱 | high | SW push subscription + server send. Pairs with notifications. |
| App shortcuts (manifest) | 📱 | low | Long-press icon → jump to project. |
| Share target | 📱 | med | Share text/URL/file from other apps into WebTerm. |
| PWA update toast | 📱 | low | "New version — reload". |
| Haptic feedback on keys | 📱 | low | `navigator.vibrate` (Android). |

### Dev tooling
| Idea | 📱 | ⚙️ | Notes |
|---|---|---|---|
| Git branch + dirty indicator per project | 📱📱 | med | Sidebar shows branch/✱; needs a git-status endpoint. |
| Host resource monitor (CPU/mem/load) | 📱 | med | Mini glance widget; read host stats. |
| Per-project env vars editor | 📱 | med | Manage env injected into the shell. |
| Remote host (SSH) targets | 📱 | high | A "project" that is a remote machine over ssh. |

### Settings / UX
| Idea | 📱 | ⚙️ | Notes |
|---|---|---|---|
| Settings screen | 📱📱 | med | Consolidate: default font, theme, haptics, wake-lock, startup behavior, bell. |
| Light theme / accent color / font family | 📱 | med | Currently single dark theme. |
| Pinned/favorite + recent projects | 📱📱 | low-med | Quick access at top. |
| Reorder projects/groups (persist order) | 📱 | med | Drag reorder. |
| Collapse/expand all groups | 📱 | low | One tap. |
| Export/import config (projects/groups/snippets) JSON | 📱 | low-med | Portable setup. |

### Security
| Idea | 📱 | ⚙️ | Notes |
|---|---|---|---|
| Biometric / passcode lock (PWA) | 📱📱 | med | WebAuthn / passcode unlock; pairs with login screen. |
| Idle auto-lock | 📱 | low | Lock after inactivity. |
| Command audit log | 📱 | med | Record what ran. |
| Read-only mode toggle | 📱 | low | View without sending input. |

---

## Notes
- Anything touching the host (file up/down, git status, resource monitor, SSH, startup-command persistence) needs new Go endpoints — keep them path-jailed and behind the auth seam.
- Notifications/voice/wake-lock vary by browser; verify on iOS Safari (most restrictive) before relying on them.
- Before public-domain exposure: login screen + TLS + `--allowed-origins` + non-root (see README security section).
