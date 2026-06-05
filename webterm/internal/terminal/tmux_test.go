package terminal

import (
	"os/exec"
	"testing"
)

func TestSessionNameSanitizes(t *testing.T) {
	if got := SessionName("p_api", 0); got != "wt_p_api" {
		t.Fatalf("got %q", got)
	}
	if got := SessionName("weird/id..x", 0); got != "wt_weird_id__x" {
		t.Fatalf("got %q", got)
	}
	if got := SessionName("p_api", 2); got != "wt_p_api_2" {
		t.Fatalf("got %q", got)
	}
}

func TestEnsureListKillRoundTrip(t *testing.T) {
	if _, err := exec.LookPath("tmux"); err != nil {
		t.Skip("tmux not installed")
	}
	name := SessionName("test_roundtrip", 0)
	_ = Kill(name) // clean slate
	if err := ensure(name, t.TempDir()); err != nil {
		t.Fatalf("ensure: %v", err)
	}
	names, _ := List()
	found := false
	for _, n := range names {
		if n == name {
			found = true
		}
	}
	if !found {
		t.Fatalf("session %q not in List() = %v", name, names)
	}
	if err := Kill(name); err != nil {
		t.Fatalf("kill: %v", err)
	}
}
