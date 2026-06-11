package project

import (
	"os"
	"path/filepath"
	"testing"
)

// Happy path: deleting a project removes its folder and its layout entry.
func TestDeleteProjectRemovesFolder(t *testing.T) {
	root := t.TempDir()
	s := NewStore(root)
	p, err := s.CreateProject("demo", "", false)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	dir := filepath.Join(root, "demo")
	if _, err := os.Stat(dir); err != nil {
		t.Fatalf("project dir should exist: %v", err)
	}
	if err := s.DeleteProject(p.ID); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if _, err := os.Stat(dir); !os.IsNotExist(err) {
		t.Fatalf("project dir should be removed, stat err = %v", err)
	}
	lay, _ := s.List()
	for _, pr := range lay.Projects {
		if pr.ID == p.ID {
			t.Fatal("deleted project still present in layout")
		}
	}
}

// Security: a layout entry whose Path escapes root must not delete anything
// outside root. Mirrors fsapi's TestTraversalBlocked for the destructive path.
func TestDeleteProjectTraversalBlocked(t *testing.T) {
	root := t.TempDir()
	outside := filepath.Join(filepath.Dir(root), "outside-"+filepath.Base(root))
	if err := os.MkdirAll(outside, 0o755); err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(outside)
	canary := filepath.Join(outside, "keep.txt")
	if err := os.WriteFile(canary, []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}

	s := NewStore(root)
	if err := os.MkdirAll(filepath.Join(root, ".webterm"), 0o755); err != nil {
		t.Fatal(err)
	}
	// Hand-crafted layout with a traversal Path (can't be created via the API).
	bad := Layout{Projects: []Project{{
		ID:   "p_evil",
		Name: "evil",
		Path: "../outside-" + filepath.Base(root),
	}}}
	if err := s.save(bad); err != nil {
		t.Fatal(err)
	}
	if err := s.DeleteProject("p_evil"); err == nil {
		t.Fatal("DeleteProject must refuse a path outside root")
	}
	if _, err := os.Stat(canary); err != nil {
		t.Fatalf("traversal escaped the jail and deleted outside root: %v", err)
	}
}

// Security: a project dir that is a symlink resolving outside root must be
// refused (the guard re-checks containment after EvalSymlinks).
func TestDeleteProjectSymlinkEscapeBlocked(t *testing.T) {
	root := t.TempDir()
	outside := filepath.Join(filepath.Dir(root), "sym-outside-"+filepath.Base(root))
	if err := os.MkdirAll(outside, 0o755); err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(outside)
	canary := filepath.Join(outside, "keep.txt")
	if err := os.WriteFile(canary, []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outside, filepath.Join(root, "evil")); err != nil {
		t.Skipf("symlink unsupported: %v", err)
	}
	s := NewStore(root)
	if err := os.MkdirAll(filepath.Join(root, ".webterm"), 0o755); err != nil {
		t.Fatal(err)
	}
	bad := Layout{Projects: []Project{{ID: "p_evil", Name: "evil", Path: "evil"}}}
	if err := s.save(bad); err != nil {
		t.Fatal(err)
	}
	if err := s.DeleteProject("p_evil"); err == nil {
		t.Fatal("DeleteProject must refuse a symlink resolving outside root")
	}
	if _, err := os.Stat(canary); err != nil {
		t.Fatalf("symlink escape deleted a file outside root: %v", err)
	}
}

// Security: a project whose Path resolves to root itself must be refused.
func TestDeleteProjectRefusesRoot(t *testing.T) {
	root := t.TempDir()
	s := NewStore(root)
	if err := os.MkdirAll(filepath.Join(root, ".webterm"), 0o755); err != nil {
		t.Fatal(err)
	}
	bad := Layout{Projects: []Project{{ID: "p_root", Name: "root", Path: "."}}}
	if err := s.save(bad); err != nil {
		t.Fatal(err)
	}
	if err := s.DeleteProject("p_root"); err == nil {
		t.Fatal("DeleteProject must refuse a path that resolves to root")
	}
	if _, err := os.Stat(root); err != nil {
		t.Fatalf("root dir should still exist: %v", err)
	}
}
