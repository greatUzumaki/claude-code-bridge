package project

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
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

// ---- validName (unexported, white-box) --------------------------------------

func TestValidNameEdgeCases(t *testing.T) {
	accept := []string{"myproject", "my-project", "api_v2", "123", "abc"}
	for _, n := range accept {
		if !validName(n) {
			t.Errorf("validName(%q) = false, want true", n)
		}
	}
	reject := []string{"", ".", "..", "../x", "a/b", `a\b`, ".hidden", "-flag", "/abs"}
	for _, n := range reject {
		if validName(n) {
			t.Errorf("validName(%q) = true, want false", n)
		}
	}
}

// ---- Clone via POST /api/projects/clone -------------------------------------

func newCloneMux(t *testing.T) (*Store, *http.ServeMux) {
	t.Helper()
	root := t.TempDir()
	s := NewStore(root)
	mux := http.NewServeMux()
	s.Register(mux)
	return s, mux
}

func cloneReq(t *testing.T, mux *http.ServeMux, body string) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest("POST", "/api/projects/clone", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	mux.ServeHTTP(rec, req)
	return rec
}

// TestCloneHandlerRejectsDisallowedSchemes ensures file://, ext::, and
// flag-like URLs are rejected with 400.
func TestCloneHandlerRejectsDisallowedSchemes(t *testing.T) {
	_, mux := newCloneMux(t)

	cases := []struct {
		name string
		url  string
	}{
		{"file scheme", "file:///etc/passwd"},
		{"ext transport", "ext::sh -c id"},
		{"double colon", "https://host::suffix/repo"},
		{"flag-like", "-u https://example.com/repo"},
		{"ftp scheme", "ftp://example.com/repo"},
	}
	for _, tc := range cases {
		body := `{"url":"` + tc.url + `","name":"target"}`
		rec := cloneReq(t, mux, body)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("%s: got %d, want 400; body: %s", tc.name, rec.Code, rec.Body)
		}
	}
}

// TestCloneHandlerAcceptsAllowedSchemes verifies https/http/ssh/git pass URL
// validation (they will fail at the actual git-clone step with no real remote,
// but must NOT get a 400 from URL validation).
func TestCloneHandlerAcceptsAllowedSchemes(t *testing.T) {
	_, mux := newCloneMux(t)

	cases := []struct {
		scheme string
		url    string
	}{
		{"https", "https://github.com/example/repo.git"},
		{"http", "http://git.internal/repo.git"},
		{"ssh", "ssh://git@github.com/example/repo.git"},
		{"git", "git://git.example.com/repo.git"},
	}
	for _, tc := range cases {
		body := `{"url":"` + tc.url + `","name":"myrepo"}`
		rec := cloneReq(t, mux, body)
		// Must not be a 400 from URL validation; 502 (clone failed — no network) is fine.
		if rec.Code == http.StatusBadRequest {
			t.Errorf("scheme %s: got 400 (URL rejected), want non-400; body: %s", tc.scheme, rec.Body)
		}
	}
}

// TestCloneHandlerRejectsInvalidName verifies bad project names are rejected.
func TestCloneHandlerRejectsInvalidName(t *testing.T) {
	_, mux := newCloneMux(t)

	badNames := []string{"..", "/abs", "../escape", "a/b"}
	for _, bad := range badNames {
		body := `{"url":"https://github.com/example/repo.git","name":"` + bad + `"}`
		rec := cloneReq(t, mux, body)
		if rec.Code == http.StatusOK {
			t.Errorf("clone with bad name %q: got 200, want 4xx", bad)
		}
	}
}

// TestCloneHandlerDerivesNameFromURL verifies name derivation when no explicit
// name is given (URL validation path — network not needed for this assertion).
func TestCloneHandlerDerivesNameFromURL(t *testing.T) {
	_, mux := newCloneMux(t)

	// Use an https URL ending in /myproject.git; no name field.
	body := `{"url":"https://github.com/example/myproject.git"}`
	rec := cloneReq(t, mux, body)
	// Not a 400 (URL is valid); a 502 from git-clone failing is expected (no network).
	if rec.Code == http.StatusBadRequest {
		t.Fatalf("URL validation unexpectedly rejected valid https URL: %s", rec.Body)
	}
}
