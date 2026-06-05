// Package terminal bridges browser WebSockets to persistent tmux sessions.
// tmux (a host daemon) owns session lifetime, scrollback, and repaint-on-attach;
// this package only spawns a PTY running a tmux client and pipes it over WS.
package terminal

import (
	"os/exec"
	"strconv"
	"strings"
)

const sessionPrefix = "wt_"

// Available reports whether tmux is installed on the host.
func Available() bool {
	_, err := exec.LookPath("tmux")
	return err == nil
}

// SessionName builds a deterministic, shell-safe tmux session name.
func SessionName(projectID string, n int) string {
	safe := strings.Map(func(r rune) rune {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9', r == '_':
			return r
		default:
			return '_'
		}
	}, projectID)
	if n <= 0 {
		return sessionPrefix + safe
	}
	return sessionPrefix + safe + "_" + strconv.Itoa(n)
}

// ensure creates the session (detached) rooted in dir if it does not exist,
// then makes tmux invisible + touch-friendly. Idempotent.
func ensure(name, dir string) error {
	// Check if session already exists; only create if it doesn't.
	// tmux new-session -A -d fails on some tmux versions (e.g. 3.6b on macOS)
	// when the session exists and there is no controlling terminal.
	if exec.Command("tmux", "has-session", "-t", name).Run() != nil {
		if err := exec.Command("tmux", "new-session", "-d", "-s", name, "-c", dir).Run(); err != nil {
			return err
		}
	}
	_ = exec.Command("tmux", "set-option", "-t", name, "status", "off").Run()
	_ = exec.Command("tmux", "set-option", "-t", name, "mouse", "on").Run()
	_ = exec.Command("tmux", "set-option", "-g", "history-limit", "100000").Run()
	return nil
}

// List returns active WebTerm tmux session names (wt_ prefix).
func List() ([]string, error) {
	out, err := exec.Command("tmux", "list-sessions", "-F", "#{session_name}").Output()
	if err != nil {
		return nil, nil // no server / no sessions → empty, not an error
	}
	var names []string
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		if strings.HasPrefix(line, sessionPrefix) {
			names = append(names, line)
		}
	}
	return names, nil
}

// Kill ends a session.
func Kill(name string) error {
	return exec.Command("tmux", "kill-session", "-t", name).Run()
}
