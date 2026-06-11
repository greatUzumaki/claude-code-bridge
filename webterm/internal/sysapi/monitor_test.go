package sysapi

import (
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"strings"
	"testing"

	"webterm/internal/project"
)

func newTestAPI(t *testing.T) *API {
	t.Helper()
	return New(project.NewStore(t.TempDir()))
}

// dockerAction must reject ids that could be flags or shell/argv injection, and
// any action outside the start/stop/restart whitelist, with 400 (never running
// docker for those).
func TestDockerActionRejectsBadInput(t *testing.T) {
	a := newTestAPI(t)
	cases := []struct{ name, body string }{
		{"empty id", `{"id":"","action":"stop"}`},
		{"flag-like id", `{"id":"-rf","action":"stop"}`},
		{"injection id", `{"id":"a b; rm -rf /","action":"stop"}`},
		{"slash id", `{"id":"a/b","action":"stop"}`},
		{"bad action", `{"id":"web","action":"rm"}`},
		{"empty action", `{"id":"web","action":""}`},
		{"bad json", `not json`},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/api/docker/action", strings.NewReader(c.body))
			w := httptest.NewRecorder()
			a.dockerAction(w, req)
			if w.Code != http.StatusBadRequest {
				t.Fatalf("want 400, got %d (%s)", w.Code, strings.TrimSpace(w.Body.String()))
			}
		})
	}
}

// containerRef accepts real id/name shapes and rejects dangerous ones.
func TestContainerRef(t *testing.T) {
	ok := []string{"webterm", "claude-bridge-dev-redis-1", "a1b2c3d4e5f6", "App_1.2"}
	bad := []string{"", "-rf", "a;b", "a b", "a/b", "../x", "a|b", "$(x)"}
	for _, s := range ok {
		if !containerRef.MatchString(s) {
			t.Errorf("expected %q to be accepted", s)
		}
	}
	for _, s := range bad {
		if containerRef.MatchString(s) {
			t.Errorf("expected %q to be rejected", s)
		}
	}
}

// killProcess must refuse pid <= 1 (init), the server's own pid, and
// non-numeric input — all 400 before any signal is sent.
func TestKillProcessRejectsBadInput(t *testing.T) {
	a := newTestAPI(t)
	cases := []struct{ name, pid string }{
		{"pid 0", "0"},
		{"pid 1 (init)", "1"},
		{"negative", "-5"},
		{"non-numeric", "abc"},
		{"empty", ""},
		{"own pid", strconv.Itoa(os.Getpid())},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/api/sys/kill?pid="+c.pid, nil)
			w := httptest.NewRecorder()
			a.killProcess(w, req)
			if w.Code != http.StatusBadRequest {
				t.Fatalf("want 400, got %d (%s)", w.Code, strings.TrimSpace(w.Body.String()))
			}
		})
	}
}
