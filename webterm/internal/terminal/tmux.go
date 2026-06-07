// Package terminal bridges browser WebSockets to persistent tmux sessions.
// tmux (a host daemon) owns session lifetime, scrollback, and repaint-on-attach;
// this package only spawns a PTY running a tmux client and pipes it over WS.
package terminal

import (
	"os/exec"
	"regexp"
	"strconv"
	"strings"
)

const sessionPrefix = "wt_"

// safeSessionName is the hard allowlist for any session name whose #{session_name}
// gets interpolated into the NotifyHook shell command. SessionName already maps
// everything outside [A-Za-z0-9_] to '_', so names are shell- and URL-safe; this
// regexp enforces that invariant at the injection-sensitive call site so a future
// change to SessionName (or a raw caller) cannot reopen command injection.
var safeSessionName = regexp.MustCompile(`^wt_[A-Za-z0-9_]+$`)

// NotifyHook, when non-empty, is installed on each tmux session as an
// alert-silence and alert-bell hook. Server sets this at startup.
// It must be a complete tmux run-shell command string, e.g.:
//
//	run-shell "curl -s -m 2 'http://127.0.0.1:7070/api/notify?key=SECRET&session=#{session_name}'"
//
// tmux expands #{session_name} before executing the shell command.
var NotifyHook string

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

	// Install silence/bell notification hooks if the server has configured one.
	// monitor-silence 20 triggers alert-silence after 20 s of no output.
	// monitor-bell triggers alert-bell on a terminal BEL character.
	// The hook command is passed as a single argv element; tmux expands
	// #{session_name} internally before handing the string to the shell — so the
	// session name must be allowlist-safe (no shell/quote metacharacters).
	if NotifyHook != "" && safeSessionName.MatchString(name) {
		_ = exec.Command("tmux", "set-window-option", "-t", name, "monitor-silence", "20").Run()
		_ = exec.Command("tmux", "set-window-option", "-t", name, "monitor-bell", "on").Run()
		_ = exec.Command("tmux", "set-hook", "-t", name, "alert-silence", NotifyHook).Run()
		_ = exec.Command("tmux", "set-hook", "-t", name, "alert-bell", NotifyHook).Run()
	}

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
