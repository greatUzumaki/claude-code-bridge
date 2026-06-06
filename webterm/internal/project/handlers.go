package project

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"webterm/internal/terminal"
)

func (s *Store) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/projects/list", func(w http.ResponseWriter, r *http.Request) {
		lay, err := s.List()
		if err != nil {
			httpErr(w, 500, err.Error())
			return
		}
		// Mark projects active if a tmux session exists for them.
		// Active is ephemeral — never persisted into layout.json.
		sessions, _ := terminal.List()
		sessionSet := make(map[string]bool, len(sessions))
		for _, n := range sessions {
			sessionSet[n] = true
		}
		for i := range lay.Projects {
			base := terminal.SessionName(lay.Projects[i].ID, 0)
			for n := range sessionSet {
				if n == base || strings.HasPrefix(n, base+"_") {
					lay.Projects[i].Active = true
					break
				}
			}
		}
		httpJSON(w, 200, lay)
	})
	mux.HandleFunc("POST /api/projects/clone", func(w http.ResponseWriter, r *http.Request) {
		var b struct {
			URL  string `json:"url"`
			Name string `json:"name"`
		}
		if !httpDecode(w, r, &b) {
			return
		}
		if b.URL == "" {
			httpErr(w, 400, "url is required")
			return
		}
		// Derive name from URL if not provided.
		name := b.Name
		if name == "" {
			u, err := url.Parse(b.URL)
			if err != nil || u.Path == "" {
				httpErr(w, 400, "cannot derive name from url")
				return
			}
			seg := filepath.Base(u.Path)
			seg = strings.TrimSuffix(seg, ".git")
			name = seg
		}
		if !validName(name) {
			httpErr(w, 400, "invalid project name")
			return
		}
		dir := filepath.Join(s.root, name)
		abs, err := filepath.Abs(dir)
		if err != nil || !s.withinRoot(abs) {
			httpErr(w, 400, "invalid project path")
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Minute)
		defer cancel()
		cmd := exec.CommandContext(ctx, "git", "clone", b.URL, abs)
		out, err := cmd.CombinedOutput()
		if err != nil {
			var exitErr *exec.ExitError
			if errors.Is(ctx.Err(), context.DeadlineExceeded) {
				httpErr(w, 502, "git clone timed out")
				return
			}
			if errors.As(err, &exitErr) {
				msg := strings.TrimSpace(string(out))
				if msg == "" {
					msg = "git clone failed"
				}
				httpErr(w, 502, msg)
				return
			}
			httpErr(w, 500, err.Error())
			return
		}
		httpJSON(w, 200, map[string]any{"ok": true, "name": name})
	})
	mux.HandleFunc("POST /api/projects/create", func(w http.ResponseWriter, r *http.Request) {
		var b struct {
			Name, GroupID string
			GitInit       bool
		}
		if !httpDecode(w, r, &b) {
			return
		}
		p, err := s.CreateProject(b.Name, b.GroupID, b.GitInit)
		if err != nil {
			httpErr(w, 500, err.Error())
			return
		}
		httpJSON(w, 200, p)
	})
	mux.HandleFunc("POST /api/projects/move", func(w http.ResponseWriter, r *http.Request) {
		var b struct {
			ProjectID, GroupID string
			Order              int
		}
		if !httpDecode(w, r, &b) {
			return
		}
		if err := s.MoveProject(b.ProjectID, b.GroupID, b.Order); err != nil {
			httpErr(w, 500, err.Error())
			return
		}
		httpJSON(w, 200, map[string]bool{"ok": true})
	})
	mux.HandleFunc("POST /api/groups/create", func(w http.ResponseWriter, r *http.Request) {
		var b struct{ Name string }
		if !httpDecode(w, r, &b) {
			return
		}
		g, err := s.CreateGroup(b.Name)
		if err != nil {
			httpErr(w, 500, err.Error())
			return
		}
		httpJSON(w, 200, g)
	})
	mux.HandleFunc("POST /api/groups/rename", func(w http.ResponseWriter, r *http.Request) {
		var b struct{ GroupID, Name string }
		if !httpDecode(w, r, &b) {
			return
		}
		if err := s.RenameGroup(b.GroupID, b.Name); err != nil {
			httpErr(w, 500, err.Error())
			return
		}
		httpJSON(w, 200, map[string]bool{"ok": true})
	})
	mux.HandleFunc("DELETE /api/groups/delete", func(w http.ResponseWriter, r *http.Request) {
		if err := s.DeleteGroup(r.URL.Query().Get("groupId")); err != nil {
			httpErr(w, 500, err.Error())
			return
		}
		httpJSON(w, 200, map[string]bool{"ok": true})
	})
}

func httpJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}
func httpErr(w http.ResponseWriter, code int, msg string) {
	httpJSON(w, code, map[string]string{"error": msg})
}
func httpDecode(w http.ResponseWriter, r *http.Request, v any) bool {
	if err := json.NewDecoder(r.Body).Decode(v); err != nil {
		httpErr(w, 400, "bad json")
		return false
	}
	return true
}
