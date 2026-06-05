package server

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/json"
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
func authSeam(token string, next http.Handler) http.Handler {
	var want [32]byte
	if token != "" {
		want = sha256.Sum256([]byte(token))
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if token != "" {
			presented := ""
			if h := r.Header.Get("Authorization"); strings.HasPrefix(h, "Bearer ") {
				presented = strings.TrimPrefix(h, "Bearer ")
			} else if c, err := r.Cookie("webterm_token"); err == nil {
				presented = c.Value
			}
			got := sha256.Sum256([]byte(presented))
			if subtle.ConstantTimeCompare(got[:], want[:]) != 1 {
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
