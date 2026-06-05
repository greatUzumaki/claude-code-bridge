package fsapi

import (
	"net/http"
	"net/http/httptest"
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
