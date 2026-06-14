package server

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/json"
	"log"
	"net/http"
	"strings"
)

// authSeam is the single security gate. With token=="" it is a no-op (owner
// deferred auth). When a token is set it requires either an
// "Authorization: Bearer <token>" header or a "webterm_token" cookie, compared
// in constant time over SHA-256 digests (constant length, no early-exit leak).
//
// The token is deliberately NOT accepted in the URL query — query strings leak
// via access logs, proxies, and Referer headers. Browser WebSockets cannot set
// headers, so when auth is enabled the frontend obtains an HttpOnly+Secure
// cookie via a /login exchange (implemented with the auth phase); the WS
// handshake then carries that cookie automatically.
// publicAssets are served WITHOUT auth by design. PWA install fetches — the iOS
// home-screen icon, the web manifest, favicons — are issued by the OS/browser
// outside the app's auth session (iOS fetches the touch icon anonymously, so a 401
// makes it fall back to a generic letter glyph; the same 401 blanks notification
// icons). These are non-sensitive branding/metadata, and a public manifest+icons is
// standard PWA practice. Everything else stays behind the gate. App code (sw.js,
// index.html, /assets/*) is intentionally NOT here — it loads in-session.
var publicAssets = map[string]bool{
	"/favicon.ico":                true,
	"/favicon-16x16.png":          true,
	"/favicon-32x32.png":          true,
	"/apple-touch-icon.png":       true,
	"/android-chrome-192x192.png": true,
	"/android-chrome-512x512.png": true,
	"/manifest.webmanifest":       true,
	"/robots.txt":                 true,
}

func authSeam(token string, next http.Handler) http.Handler {
	var want [32]byte
	if token != "" {
		want = sha256.Sum256([]byte(token))
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if token != "" && !publicAssets[r.URL.Path] {
			presented := ""
			if h := r.Header.Get("Authorization"); strings.HasPrefix(h, "Bearer ") {
				presented = strings.TrimPrefix(h, "Bearer ")
			} else if c, err := r.Cookie("webterm_token"); err == nil {
				presented = c.Value
			}
			got := sha256.Sum256([]byte(presented))
			if subtle.ConstantTimeCompare(got[:], want[:]) != 1 {
				// Log the rejected request (no credential material) so unexplained 401s are
				// traceable. Behind Caddy a valid Bearer is always injected, so an authSeam
				// 401 almost always means a request that bypassed the proxy — e.g. a process
				// inside the box hitting 127.0.0.1:7070 directly (xff empty + loopback remote).
				log.Printf("auth: 401 %s %s remote=%s xff=%q ua=%q",
					r.Method, r.URL.Path, r.RemoteAddr, r.Header.Get("X-Forwarded-For"), r.UserAgent())
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]string{"error": msg})
}
