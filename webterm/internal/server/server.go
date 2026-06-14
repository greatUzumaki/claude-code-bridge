package server

import (
	"log"
	"net"
	"net/http"
	"path/filepath"

	"webterm/internal/fsapi"
	"webterm/internal/pathjail"
	"webterm/internal/project"
	"webterm/internal/push"
	"webterm/internal/sysapi"
	"webterm/internal/terminal"
)

type Config struct {
	Addr           string   // listen address, e.g. "127.0.0.1:7070"
	Root           string
	Token          string   // empty = auth disabled (seam no-op)
	AllowedOrigins []string // WS Origin host patterns; nil = strict same-origin
	SilenceSeconds int      // tmux monitor-silence threshold; <= 0 keeps the default
	PushSubscriber string   // VAPID contact for Web Push (bare email or https URL); empty = default
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

	// Apply the configurable silence threshold (guard: <= 0 keeps the package default).
	if cfg.SilenceSeconds > 0 {
		terminal.SilenceSeconds = cfg.SilenceSeconds
	}

	// Set up Web Push manager; failures are non-fatal.
	pushDir := filepath.Join(cfg.Root, ".webterm")
	if mgr, err := push.New(pushDir, cfg.PushSubscriber); err != nil {
		log.Printf("push: init failed (push disabled): %v", err)
	} else {
		// Build the notify hook command that tmux will invoke on silence/bell.
		// We always target 127.0.0.1 regardless of the bind address; this keeps
		// the secret off the LAN even if the server binds 0.0.0.0.
		port := "7070"
		if _, p, err := net.SplitHostPort(cfg.Addr); err == nil && p != "" {
			port = p
		}
		// POST to match the route; the hook is a local tmux run-shell curl.
		terminal.NotifyHook = `run-shell "curl -s -m 2 -X POST 'http://127.0.0.1:` + port +
			`/api/notify?key=` + mgr.NotifySecret() + `&session=#{session_name}'"`

		mgr.Register(s.mux)
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
