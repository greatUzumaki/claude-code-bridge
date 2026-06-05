package project

import (
	"encoding/json"
	"net/http"
)

func (s *Store) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/projects/list", func(w http.ResponseWriter, r *http.Request) {
		lay, err := s.List()
		if err != nil {
			httpErr(w, 500, err.Error())
			return
		}
		httpJSON(w, 200, lay)
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
