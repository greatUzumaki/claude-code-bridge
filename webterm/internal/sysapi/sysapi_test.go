package sysapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"testing"

	"webterm/internal/project"
)

// makeGitRepo initialises a real git repo in dir with one commit on "main".
func makeGitRepo(t *testing.T, dir string) {
	t.Helper()
	run := func(args ...string) {
		t.Helper()
		cmd := exec.Command("git", args...)
		cmd.Dir = dir
		// Provide minimal git identity so commit doesn't fail.
		cmd.Env = append(os.Environ(),
			"GIT_AUTHOR_NAME=Test",
			"GIT_AUTHOR_EMAIL=test@example.com",
			"GIT_COMMITTER_NAME=Test",
			"GIT_COMMITTER_EMAIL=test@example.com",
		)
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git %v: %v\n%s", args, err, out)
		}
	}
	run("init", "-b", "main")
	// Write a file and commit.
	if err := os.WriteFile(filepath.Join(dir, "README.md"), []byte("hello"), 0644); err != nil {
		t.Fatal(err)
	}
	run("add", ".")
	run("commit", "--allow-empty-message", "-m", "init")
}

// buildStore creates a project.Store rooted at root and discovers projects.
// It returns the store after the first List() so layout.json is written.
func buildStore(t *testing.T, root string) *project.Store {
	t.Helper()
	s := project.NewStore(root)
	if _, err := s.List(); err != nil {
		t.Fatalf("store.List: %v", err)
	}
	return s
}

func TestGitStatusRepoVsNonRepo(t *testing.T) {
	root := t.TempDir()

	// Create two sub-folders under root.
	repoDir := filepath.Join(root, "myrepo")
	plainDir := filepath.Join(root, "plain")
	if err := os.MkdirAll(repoDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(plainDir, 0755); err != nil {
		t.Fatal(err)
	}

	makeGitRepo(t, repoDir)

	store := buildStore(t, root)
	api := New(store)
	mux := http.NewServeMux()
	api.Register(mux)

	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest("GET", "/api/git/status", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d, want 200; body: %s", rec.Code, rec.Body)
	}

	var resp struct {
		Statuses map[string]struct {
			IsRepo bool   `json:"isRepo"`
			Branch string `json:"branch"`
		} `json:"statuses"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}

	// "myrepo" project id is "p_myrepo", "plain" is "p_plain"
	repoStatus, ok := resp.Statuses["p_myrepo"]
	if !ok {
		t.Fatalf("p_myrepo not in statuses: %v", resp.Statuses)
	}
	if !repoStatus.IsRepo {
		t.Error("p_myrepo: isRepo should be true")
	}
	if repoStatus.Branch == "" {
		t.Error("p_myrepo: branch should be non-empty")
	}

	plainStatus, ok := resp.Statuses["p_plain"]
	if !ok {
		t.Fatalf("p_plain not in statuses: %v", resp.Statuses)
	}
	if plainStatus.IsRepo {
		t.Error("p_plain: isRepo should be false")
	}
}

func TestHostStats(t *testing.T) {
	store := project.NewStore(t.TempDir())
	api := New(store)
	mux := http.NewServeMux()
	api.Register(mux)

	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest("GET", "/api/host/stats", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d, want 200; body: %s", rec.Code, rec.Body)
	}

	var body map[string]float64
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}

	// Fields must be present (key exists in map).
	for _, field := range []string{"cpuPercent", "memUsedMB", "memTotalMB", "memPercent", "load1"} {
		if _, ok := body[field]; !ok {
			t.Errorf("field %q missing from response", field)
		}
	}

	if body["memTotalMB"] <= 0 {
		t.Errorf("memTotalMB should be > 0, got %v", body["memTotalMB"])
	}
	if body["cpuPercent"] < 0 {
		t.Errorf("cpuPercent should be >= 0, got %v", body["cpuPercent"])
	}
}
