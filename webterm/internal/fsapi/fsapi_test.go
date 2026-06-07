package fsapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"webterm/internal/pathjail"
)

func newAPI(t *testing.T) (*API, string) {
	root := t.TempDir()
	return New(pathjail.New(root)), root
}

func TestCreateReadWriteList(t *testing.T) {
	api, _ := newAPI(t)
	mux := http.NewServeMux()
	api.Register(mux)

	// create
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest("POST", "/api/fs/create",
		strings.NewReader(`{"path":"hello.txt","content":"hi"}`)))
	if rec.Code != http.StatusOK {
		t.Fatalf("create %d: %s", rec.Code, rec.Body)
	}
	// read
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest("GET", "/api/fs/read?path=hello.txt", nil))
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "hi") {
		t.Fatalf("read %d: %s", rec.Code, rec.Body)
	}
	// list
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest("GET", "/api/fs/list?path=", nil))
	if !strings.Contains(rec.Body.String(), "hello.txt") {
		t.Fatalf("list missing file: %s", rec.Body)
	}
}

func TestTraversalBlocked(t *testing.T) {
	api, _ := newAPI(t)
	mux := http.NewServeMux()
	api.Register(mux)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest("GET", "/api/fs/read?path=../../etc/passwd", nil))
	if rec.Code == http.StatusOK {
		t.Fatal("traversal must be rejected")
	}
}

// ---- /api/fs/raw ------------------------------------------------------------

func TestRawServesTextFile(t *testing.T) {
	api, root := newAPI(t)
	mux := http.NewServeMux()
	api.Register(mux)

	// Write a plain text file into the jail root.
	if err := os.WriteFile(filepath.Join(root, "hello.txt"), []byte("world"), 0644); err != nil {
		t.Fatal(err)
	}

	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest("GET", "/api/fs/raw?path=hello.txt", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("raw text: status %d, want 200; body: %s", rec.Code, rec.Body)
	}
	ct := rec.Header().Get("Content-Type")
	if !strings.Contains(ct, "text") {
		t.Errorf("Content-Type %q does not contain 'text'", ct)
	}
}

func TestRawServesPNGFile(t *testing.T) {
	api, root := newAPI(t)
	mux := http.NewServeMux()
	api.Register(mux)

	// Minimal 1-byte "PNG" file — http.ServeFile detects by extension.
	if err := os.WriteFile(filepath.Join(root, "img.png"), []byte("\x89PNG"), 0644); err != nil {
		t.Fatal(err)
	}

	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest("GET", "/api/fs/raw?path=img.png", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("raw png: status %d, want 200", rec.Code)
	}
	ct := rec.Header().Get("Content-Type")
	if !strings.Contains(ct, "image") && !strings.Contains(ct, "png") {
		t.Errorf("Content-Type %q does not look like image/png", ct)
	}
}

func TestRawOutsideRootRejected(t *testing.T) {
	api, _ := newAPI(t)
	mux := http.NewServeMux()
	api.Register(mux)

	rec := httptest.NewRecorder()
	// Path-traversal attempt — pathjail must reject this.
	mux.ServeHTTP(rec, httptest.NewRequest("GET", "/api/fs/raw?path=../../etc/passwd", nil))
	if rec.Code == http.StatusOK {
		t.Fatal("expected non-200 for out-of-jail path, got 200")
	}
}

// ---- /api/fs/search ---------------------------------------------------------

func buildSearchTree(t *testing.T, root string) {
	t.Helper()
	// A matching file at the top level.
	if err := os.WriteFile(filepath.Join(root, "target_file.go"), []byte("package main"), 0644); err != nil {
		t.Fatal(err)
	}
	// A matching file inside a normal sub-dir.
	sub := filepath.Join(root, "src")
	if err := os.MkdirAll(sub, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(sub, "target_helper.go"), []byte("package src"), 0644); err != nil {
		t.Fatal(err)
	}
	// A matching file inside node_modules — must be skipped.
	nm := filepath.Join(root, "node_modules")
	if err := os.MkdirAll(nm, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(nm, "target_node.go"), []byte("// should be skipped"), 0644); err != nil {
		t.Fatal(err)
	}
	// A matching file inside .git — must be skipped.
	git := filepath.Join(root, ".git")
	if err := os.MkdirAll(git, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(git, "target_git.go"), []byte("// should be skipped"), 0644); err != nil {
		t.Fatal(err)
	}
}

func TestSearchFindsMatchAndSkipsDirs(t *testing.T) {
	api, root := newAPI(t)
	mux := http.NewServeMux()
	api.Register(mux)
	buildSearchTree(t, root)

	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest("GET", "/api/fs/search?path=&q=target", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("search status %d, want 200; body: %s", rec.Code, rec.Body)
	}

	var resp struct {
		Matches []string `json:"matches"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}

	// Must have found at least the top-level file and the src/ sub-file.
	found := map[string]bool{}
	for _, m := range resp.Matches {
		found[m] = true
	}

	if !found["target_file.go"] {
		t.Errorf("expected target_file.go in matches; got %v", resp.Matches)
	}
	if !found[filepath.Join("src", "target_helper.go")] {
		t.Errorf("expected src/target_helper.go in matches; got %v", resp.Matches)
	}

	// Must NOT have found files inside skipped directories.
	for _, m := range resp.Matches {
		if strings.HasPrefix(m, "node_modules") {
			t.Errorf("node_modules must be skipped, but got match: %q", m)
		}
		if strings.HasPrefix(m, ".git") {
			t.Errorf(".git must be skipped, but got match: %q", m)
		}
	}
}

func TestSearchEmptyQueryReturnsNoMatches(t *testing.T) {
	api, root := newAPI(t)
	mux := http.NewServeMux()
	api.Register(mux)

	if err := os.WriteFile(filepath.Join(root, "any.txt"), []byte("hi"), 0644); err != nil {
		t.Fatal(err)
	}

	rec := httptest.NewRecorder()
	// q="" → server returns empty matches slice immediately.
	mux.ServeHTTP(rec, httptest.NewRequest("GET", "/api/fs/search?path=&q=", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("empty-q search status %d, want 200", rec.Code)
	}

	var resp struct {
		Matches []string `json:"matches"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(resp.Matches) != 0 {
		t.Errorf("empty q must return no matches, got %v", resp.Matches)
	}
}
