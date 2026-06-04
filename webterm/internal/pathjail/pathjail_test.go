package pathjail

import (
	"path/filepath"
	"testing"
)

func TestResolveWithin(t *testing.T) {
	root := t.TempDir()
	j := New(root)
	got, err := j.Resolve("a/b.txt")
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if got != filepath.Join(root, "a", "b.txt") {
		t.Fatalf("got %q", got)
	}
}

func TestResolveRejectsTraversal(t *testing.T) {
	j := New(t.TempDir())
	for _, p := range []string{"../etc/passwd", "a/../../x", "/etc/passwd", "a/../../"} {
		if _, err := j.Resolve(p); err == nil {
			t.Fatalf("expected rejection for %q", p)
		}
	}
}

func TestResolveRootItself(t *testing.T) {
	root := t.TempDir()
	j := New(root)
	got, err := j.Resolve("")
	if err != nil || got != root {
		t.Fatalf("root resolve got=%q err=%v", got, err)
	}
}
