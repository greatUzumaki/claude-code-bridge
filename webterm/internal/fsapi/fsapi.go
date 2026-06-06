package fsapi

import (
	"encoding/json"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"webterm/internal/pathjail"
)

const maxRead = 2 << 20 // 2 MiB cap for editor reads

// searchSkipDirs are directory names excluded from recursive search.
var searchSkipDirs = map[string]bool{
	".git":         true,
	"node_modules": true,
	".webterm":     true,
}

const searchCap = 300

type API struct{ jail *pathjail.Jail }

func New(j *pathjail.Jail) *API { return &API{jail: j} }

func (a *API) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/fs/list", a.list)
	mux.HandleFunc("GET /api/fs/read", a.read)
	mux.HandleFunc("GET /api/fs/raw", a.raw)
	mux.HandleFunc("GET /api/fs/search", a.search)
	mux.HandleFunc("PUT /api/fs/write", a.write)
	mux.HandleFunc("POST /api/fs/mkdir", a.mkdir)
	mux.HandleFunc("POST /api/fs/create", a.create)
	mux.HandleFunc("POST /api/fs/rename", a.rename)
	mux.HandleFunc("DELETE /api/fs/delete", a.del)
}

type entry struct {
	Name  string `json:"name"`
	Dir   bool   `json:"dir"`
	Size  int64  `json:"size"`
	MTime int64  `json:"mtime"`
}

func (a *API) resolve(w http.ResponseWriter, p string) (string, bool) {
	abs, err := a.jail.Resolve(p)
	if err != nil {
		jsonErr(w, http.StatusBadRequest, "invalid path")
		return "", false
	}
	return abs, true
}

func (a *API) list(w http.ResponseWriter, r *http.Request) {
	abs, ok := a.resolve(w, r.URL.Query().Get("path"))
	if !ok {
		return
	}
	des, err := os.ReadDir(abs)
	if err != nil {
		jsonErr(w, http.StatusNotFound, err.Error())
		return
	}
	out := make([]entry, 0, len(des))
	for _, d := range des {
		fi, e := d.Info()
		if e != nil {
			continue
		}
		out = append(out, entry{d.Name(), d.IsDir(), fi.Size(), fi.ModTime().Unix()})
	}
	writeJSON(w, http.StatusOK, map[string]any{"entries": out})
}

func (a *API) read(w http.ResponseWriter, r *http.Request) {
	abs, ok := a.resolve(w, r.URL.Query().Get("path"))
	if !ok {
		return
	}
	fi, err := os.Stat(abs)
	if err != nil {
		jsonErr(w, http.StatusNotFound, err.Error())
		return
	}
	if fi.Size() > maxRead {
		writeJSON(w, http.StatusOK, map[string]any{"tooLarge": true, "size": fi.Size()})
		return
	}
	b, err := os.ReadFile(abs)
	if err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"content": string(b), "size": fi.Size()})
}

func (a *API) raw(w http.ResponseWriter, r *http.Request) {
	abs, ok := a.resolve(w, r.URL.Query().Get("path"))
	if !ok {
		return
	}
	fi, err := os.Stat(abs)
	if err != nil || fi.IsDir() {
		jsonErr(w, http.StatusNotFound, "not found")
		return
	}
	http.ServeFile(w, r, abs)
}

func (a *API) search(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	if q == "" {
		writeJSON(w, http.StatusOK, map[string]any{"matches": []string{}})
		return
	}
	abs, ok := a.resolve(w, r.URL.Query().Get("path"))
	if !ok {
		return
	}
	qLower := strings.ToLower(q)
	var matches []string
	_ = filepath.WalkDir(abs, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if d.IsDir() && searchSkipDirs[d.Name()] {
			return filepath.SkipDir
		}
		if !d.IsDir() && strings.Contains(strings.ToLower(d.Name()), qLower) {
			rel, rerr := filepath.Rel(abs, path)
			if rerr == nil {
				matches = append(matches, rel)
			}
		}
		if len(matches) >= searchCap {
			return filepath.SkipAll
		}
		return nil
	})
	if matches == nil {
		matches = []string{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"matches": matches})
}

type pathBody struct {
	Path    string `json:"path"`
	Content string `json:"content"`
	From    string `json:"from"`
	To      string `json:"to"`
}

func (a *API) write(w http.ResponseWriter, r *http.Request) {
	var b pathBody
	if !decode(w, r, &b) {
		return
	}
	abs, ok := a.resolve(w, b.Path)
	if !ok {
		return
	}
	if err := os.WriteFile(abs, []byte(b.Content), 0o644); err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *API) create(w http.ResponseWriter, r *http.Request) {
	var b pathBody
	if !decode(w, r, &b) {
		return
	}
	abs, ok := a.resolve(w, b.Path)
	if !ok {
		return
	}
	if err := os.MkdirAll(filepath.Dir(abs), 0o755); err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := os.WriteFile(abs, []byte(b.Content), 0o644); err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *API) mkdir(w http.ResponseWriter, r *http.Request) {
	var b pathBody
	if !decode(w, r, &b) {
		return
	}
	abs, ok := a.resolve(w, b.Path)
	if !ok {
		return
	}
	if err := os.MkdirAll(abs, 0o755); err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *API) rename(w http.ResponseWriter, r *http.Request) {
	var b pathBody
	if !decode(w, r, &b) {
		return
	}
	from, ok := a.resolve(w, b.From)
	if !ok {
		return
	}
	to, ok := a.resolve(w, b.To)
	if !ok {
		return
	}
	if err := os.Rename(from, to); err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *API) del(w http.ResponseWriter, r *http.Request) {
	abs, ok := a.resolve(w, r.URL.Query().Get("path"))
	if !ok {
		return
	}
	if abs == a.jail.Root() {
		jsonErr(w, http.StatusBadRequest, "refusing to delete root")
		return
	}
	if err := os.RemoveAll(abs); err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// local json helpers (kept package-private to avoid server import cycle)
func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}
func jsonErr(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]string{"error": msg})
}
func decode(w http.ResponseWriter, r *http.Request, v any) bool {
	if err := json.NewDecoder(r.Body).Decode(v); err != nil {
		jsonErr(w, http.StatusBadRequest, "bad json")
		return false
	}
	return true
}
