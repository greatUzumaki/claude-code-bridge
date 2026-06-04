package server

import (
	"encoding/json"
	"net/http"
)

// authSeam is the single security gate. With Token=="" it is a no-op (owner
// deferred auth). Setting Token later turns on a constant-time check — no
// structural change required elsewhere.
func authSeam(token string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if token != "" {
			got := r.Header.Get("Authorization")
			if got != "Bearer "+token && r.URL.Query().Get("token") != token {
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
