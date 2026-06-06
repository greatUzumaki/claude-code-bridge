#!/usr/bin/env bash
#
# Dev-machine bootstrap for working with code from a terminal.
# Installs: git, build tools, tmux, Python 3 (+pip/venv), Node.js LTS (+npm),
#           ripgrep, jq, and Claude Code (native installer — standalone, no Node).
# Supports: Debian/Ubuntu (apt), Fedora/RHEL (dnf), macOS (Homebrew).
# Idempotent — safe to re-run. Run as root, or as a user with sudo.
#
#   curl -fsSL <raw-url>/scripts/setup-machine.sh | bash
#   # or: bash scripts/setup-machine.sh
#
set -euo pipefail

NODE_MAJOR=24

log()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[warn]\033[0m %s\n' "$*" >&2; }
have() { command -v "$1" >/dev/null 2>&1; }

# Use sudo for system installs unless already root.
SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  if have sudo; then SUDO="sudo"; else warn "not root and no sudo found — system installs may fail"; fi
fi

node_ok() {
  have node || return 1
  local major
  major="$(node -v | sed 's/v\([0-9]*\).*/\1/')"
  [ "${major:-0}" -ge 18 ]
}

detect_pm() {
  if have apt-get; then echo apt
  elif have dnf; then echo dnf
  elif [ "$(uname -s)" = "Darwin" ]; then echo brew
  else echo unknown
  fi
}

install_apt() {
  export DEBIAN_FRONTEND=noninteractive
  $SUDO apt-get update -y
  $SUDO apt-get install -y --no-install-recommends \
    ca-certificates curl gnupg git build-essential tmux \
    python3 python3-pip python3-venv ripgrep jq
  if ! node_ok; then
    log "Installing Node.js ${NODE_MAJOR}.x (NodeSource)"
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | $SUDO -E bash -
    $SUDO apt-get install -y nodejs
  fi
}

install_dnf() {
  $SUDO dnf install -y \
    ca-certificates curl git tmux gcc gcc-c++ make \
    python3 python3-pip ripgrep jq
  if ! node_ok; then
    log "Installing Node.js ${NODE_MAJOR}.x (NodeSource)"
    curl -fsSL "https://rpm.nodesource.com/setup_${NODE_MAJOR}.x" | $SUDO bash -
    $SUDO dnf install -y nodejs
  fi
}

install_brew() {
  if ! have brew; then
    log "Installing Homebrew"
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    eval "$(/opt/homebrew/bin/brew shellenv 2>/dev/null || /usr/local/bin/brew shellenv)"
  fi
  brew install git tmux python node ripgrep jq
}

PM="$(detect_pm)"
log "Platform: $(uname -s) / package manager: ${PM}"
case "$PM" in
  apt)  install_apt ;;
  dnf)  install_dnf ;;
  brew) install_brew ;;
  *)    warn "Unsupported platform — install git, node ${NODE_MAJOR}+, python3, tmux manually"; ;;
esac

# Claude Code — native installer: a standalone binary in ~/.local/bin, no Node,
# self-updating. This is the recommended method. Runs as the CURRENT user
# (never sudo — it installs into the user's home).
export PATH="$HOME/.local/bin:$PATH"
if have claude; then
  log "Claude Code already installed: $(claude --version 2>/dev/null || echo present)"
else
  log "Installing Claude Code (native installer)"
  curl -fsSL https://claude.ai/install.sh | bash
fi

echo
log "Installed versions:"
for t in git node npm python3 tmux rg jq claude; do
  if have "$t"; then printf '  %-8s %s\n' "$t" "$("$t" --version 2>&1 | head -1)"
  else printf '  %-8s \033[1;33mmissing\033[0m\n' "$t"; fi
done

echo
log "Done."
echo "  • If 'claude' isn't found in a new shell, add ~/.local/bin to PATH:"
echo "      echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> ~/.bashrc && source ~/.bashrc"
echo "  • Run 'claude' to log in. Use a Pro/Max plan for the cheap interactive bucket"
echo "    (interactive CLI — not 'claude -p'/SDK, which draws the Agent-SDK credit pool)."
echo "  • tmux is installed — required by WebTerm's terminal."
