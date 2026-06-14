package server

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHealth(t *testing.T) {
	s := New(Config{Root: t.TempDir()})
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	rec := httptest.NewRecorder()
	s.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("got %d", rec.Code)
	}
}

func TestAuthSeamPassthrough(t *testing.T) {
	// With no token configured, the seam must allow requests through.
	s := New(Config{Root: t.TempDir()})
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	rec := httptest.NewRecorder()
	s.Handler().ServeHTTP(rec, req)
	if rec.Code == http.StatusUnauthorized {
		t.Fatal("seam must be no-op when no token set")
	}
}

func TestAuthSeamBlocksWithoutToken(t *testing.T) {
	// With a token set, a protected path must be rejected when no credential is sent.
	s := New(Config{Root: t.TempDir(), Token: "secret"})
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	rec := httptest.NewRecorder()
	s.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("protected path without token: got %d, want 401", rec.Code)
	}
}

func TestPublicAssetsBypassAuth(t *testing.T) {
	// PWA install assets must be reachable WITHOUT a credential even when auth is on,
	// or iOS/Android can't fetch the icon+manifest at "Add to Home Screen" time.
	s := New(Config{Root: t.TempDir(), Token: "secret"})
	for path := range publicAssets {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		rec := httptest.NewRecorder()
		s.Handler().ServeHTTP(rec, req)
		if rec.Code == http.StatusUnauthorized {
			t.Fatalf("public asset %s must not require auth, got 401", path)
		}
	}
}
