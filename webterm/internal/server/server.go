package server

import (
	"net/http"

	"webterm/internal/fsapi"
	"webterm/internal/pathjail"
	"webterm/internal/project"
	"webterm/internal/sysapi"
	"webterm/internal/terminal"
)

type Config struct {
	Root           string
	Token          string   // empty = auth disabled (seam no-op)
	AllowedOrigins []string // WS Origin host patterns; nil = strict same-origin
}

type Server struct {
	cfg   Config
	jail  *pathjail.Jail
	mux   *http.ServeMux
	store *project.Store
}

func New(cfg Config) *Server {
	s := &Server{
		cfg:   cfg,
		jail:  pathjail.New(cfg.Root),
		mux:   http.NewServeMux(),
		store: project.NewStore(cfg.Root),
	}
	s.routes()
	return s
}

func (s *Server) routes() {
	s.mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	fsapi.New(s.jail).Register(s.mux)
	s.store.Register(s.mux)
	sysapi.New(s.store).Register(s.mux)
	wsh := terminal.NewWSHandler(s.store.ProjectPath, s.cfg.AllowedOrigins)
	s.mux.HandleFunc("/ws/term", wsh.Handle)
	s.mux.HandleFunc("GET /api/term/list", func(w http.ResponseWriter, r *http.Request) {
		names, _ := terminal.List()
		writeJSON(w, http.StatusOK, map[string]any{"sessions": names})
	})
	s.mux.HandleFunc("POST /api/term/kill", func(w http.ResponseWriter, r *http.Request) {
		_ = terminal.Kill(r.URL.Query().Get("session"))
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	})
	s.mux.Handle("/", spaHandler())
}

// Handler returns the fully-wrapped handler (auth seam outermost).
func (s *Server) Handler() http.Handler {
	return authSeam(s.cfg.Token, s.mux)
}
