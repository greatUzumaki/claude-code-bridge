package pathjail

import (
	"os"
	"path/filepath"
	"testing"
)

func TestResolveWithin(t *testing.T) {
	j := New(t.TempDir())
	got, err := j.Resolve("a/b.txt")
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	// Compare against the jail's (canonicalized) root, not the raw TempDir,
	// since New resolves symlinks (e.g. /var -> /private/var on macOS).
	if want := filepath.Join(j.Root(), "a", "b.txt"); got != want {
		t.Fatalf("got %q want %q", got, want)
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
	j := New(t.TempDir())
	got, err := j.Resolve("")
	if err != nil || got != j.Root() {
		t.Fatalf("root resolve got=%q err=%v", got, err)
	}
}

func TestResolveRejectsSymlinkEscape(t *testing.T) {
	root := t.TempDir()
	outside := t.TempDir() // a directory outside root
	if err := os.Symlink(outside, filepath.Join(root, "link")); err != nil {
		t.Skipf("symlink unsupported: %v", err)
	}
	j := New(root)
	// Both the symlink itself and a path through it must be rejected, because
	// they resolve outside the jail.
	for _, p := range []string{"link", "link/secret.txt"} {
		if _, err := j.Resolve(p); err == nil {
			t.Fatalf("expected rejection for symlink-escaping path %q", p)
		}
	}
	// A real (non-escaping) subdir still resolves fine.
	if err := os.Mkdir(filepath.Join(root, "real"), 0o755); err != nil {
		t.Fatal(err)
	}
	if _, err := j.Resolve("real/file.txt"); err != nil {
		t.Fatalf("legit path wrongly rejected: %v", err)
	}
}
