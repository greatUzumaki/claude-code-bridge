package project

import (
	"os"
	"path/filepath"
	"testing"
)

func TestDiscoverMergesUngrouped(t *testing.T) {
	root := t.TempDir()
	os.Mkdir(filepath.Join(root, "alpha"), 0o755)
	os.Mkdir(filepath.Join(root, "beta"), 0o755)
	s := NewStore(root)
	lay, err := s.List()
	if err != nil {
		t.Fatal(err)
	}
	if len(lay.Projects) != 2 {
		t.Fatalf("want 2 discovered projects, got %d", len(lay.Projects))
	}
	for _, p := range lay.Projects {
		if p.GroupID != "" {
			t.Fatalf("new projects must be ungrouped, got %q", p.GroupID)
		}
	}
}

func TestGroupCreateAndMovePersist(t *testing.T) {
	root := t.TempDir()
	os.Mkdir(filepath.Join(root, "alpha"), 0o755)
	s := NewStore(root)
	if _, err := s.List(); err != nil { // discover alpha
		t.Fatal(err)
	}
	g, err := s.CreateGroup("Work")
	if err != nil {
		t.Fatal(err)
	}
	lay, _ := s.List()
	var pid string
	for _, p := range lay.Projects {
		if p.Name == "alpha" {
			pid = p.ID
		}
	}
	if err := s.MoveProject(pid, g.ID, 0); err != nil {
		t.Fatal(err)
	}
	// reload from disk via a fresh store → must persist
	s2 := NewStore(root)
	lay2, _ := s2.List()
	found := false
	for _, p := range lay2.Projects {
		if p.Name == "alpha" && p.GroupID == g.ID {
			found = true
		}
	}
	if !found {
		t.Fatal("move did not persist to layout.json")
	}
}

func TestCreateProjectMakesFolder(t *testing.T) {
	root := t.TempDir()
	s := NewStore(root)
	if _, err := s.CreateProject("svc", "", false); err != nil {
		t.Fatal(err)
	}
	if fi, err := os.Stat(filepath.Join(root, "svc")); err != nil || !fi.IsDir() {
		t.Fatal("project folder not created")
	}
}

func TestCreateProjectRejectsBadNames(t *testing.T) {
	root := t.TempDir()
	s := NewStore(root)
	for _, bad := range []string{"", ".", "..", "../escape", "a/b", `a\b`, ".hidden", "-rf"} {
		if _, err := s.CreateProject(bad, "", false); err == nil {
			t.Fatalf("expected rejection for name %q", bad)
		}
	}
	// nothing should have been created outside (or as a dotfile inside) root
	if _, err := os.Stat(filepath.Join(filepath.Dir(root), "escape")); err == nil {
		t.Fatal("traversal created a directory outside root")
	}
}
