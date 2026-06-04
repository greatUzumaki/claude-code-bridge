package server

import (
	"net/http"

	"webterm/internal/pathjail"
)

type Config struct {
	Root  string
	Token string // empty = auth disabled (seam no-op)
}

type Server struct {
	cfg  Config
	jail *pathjail.Jail
	mux  *http.ServeMux
}

func New(cfg Config) *Server {
	s := &Server{cfg: cfg, jail: pathjail.New(cfg.Root), mux: http.NewServeMux()}
	s.routes()
	return s
}

func (s *Server) routes() {
	s.mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	// fs, project, terminal, static routes added in later tasks.
}

// Handler returns the fully-wrapped handler (auth seam outermost).
func (s *Server) Handler() http.Handler {
	return authSeam(s.cfg.Token, s.mux)
}
