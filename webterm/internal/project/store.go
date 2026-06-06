// Package project manages the sidebar layout: discovering project folders under
// root and tracking optional subgroups in <root>/.webterm/layout.json.
// Grouping is metadata only — it never moves folders on disk.
package project

import (
	"encoding/json"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"sync"
)

// validName rejects project names that could escape root or inject into argv:
// empty, ".", "..", anything with a path separator, and leading "." or "-".
func validName(name string) bool {
	if name == "" || name == "." || name == ".." {
		return false
	}
	if strings.ContainsAny(name, `/\`) {
		return false
	}
	if strings.HasPrefix(name, ".") || strings.HasPrefix(name, "-") {
		return false
	}
	return true
}

// withinRoot reports whether abs is s.root or a descendant of it.
func (s *Store) withinRoot(abs string) bool {
	return abs == s.root || strings.HasPrefix(abs, s.root+string(os.PathSeparator))
}

type Group struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Order     int    `json:"order"`
	Collapsed bool   `json:"collapsed"`
}

type Project struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Path    string `json:"path"` // relative to root
	GroupID string `json:"groupId"`
	Order   int    `json:"order"`
	Active  bool   `json:"active,omitempty"` // set by handler; never persisted
}

type Layout struct {
	Groups   []Group   `json:"groups"`
	Projects []Project `json:"projects"`
}

type Store struct {
	root string
	mu   sync.Mutex
}

func NewStore(root string) *Store {
	abs, _ := filepath.Abs(root)
	return &Store{root: abs}
}

func (s *Store) layoutPath() string { return filepath.Join(s.root, ".webterm", "layout.json") }

func (s *Store) load() Layout {
	var l Layout
	b, err := os.ReadFile(s.layoutPath())
	if err == nil {
		_ = json.Unmarshal(b, &l)
	}
	return l
}

func (s *Store) save(l Layout) error {
	dir := filepath.Join(s.root, ".webterm")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	b, _ := json.MarshalIndent(l, "", "  ")
	// Write-then-rename so a concurrent reader never sees a half-written file.
	tmp := filepath.Join(dir, "layout.json.tmp")
	if err := os.WriteFile(tmp, b, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, s.layoutPath())
}

// List discovers folders under root and reconciles them with saved layout:
// new folders appear ungrouped; entries whose folders vanished are dropped.
func (s *Store) List() (Layout, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	lay := s.load()

	des, err := os.ReadDir(s.root)
	if err != nil {
		return lay, err
	}
	onDisk := map[string]bool{}
	for _, d := range des {
		if d.IsDir() && d.Name() != ".webterm" {
			onDisk[d.Name()] = true
		}
	}
	// keep known projects that still exist
	known := map[string]bool{}
	kept := lay.Projects[:0]
	for _, p := range lay.Projects {
		if onDisk[p.Path] {
			kept = append(kept, p)
			known[p.Path] = true
		}
	}
	lay.Projects = kept
	// add new folders as ungrouped
	names := make([]string, 0, len(onDisk))
	for n := range onDisk {
		names = append(names, n)
	}
	sort.Strings(names)
	for _, n := range names {
		if !known[n] {
			lay.Projects = append(lay.Projects, Project{
				ID: "p_" + n, Name: n, Path: n, Order: len(lay.Projects),
			})
		}
	}
	// Emit empty arrays (not JSON null) so the frontend can always iterate.
	if lay.Groups == nil {
		lay.Groups = []Group{}
	}
	if lay.Projects == nil {
		lay.Projects = []Project{}
	}
	_ = s.save(lay)
	return lay, nil
}

func (s *Store) CreateGroup(name string) (Group, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	lay := s.load()
	g := Group{ID: "g_" + name, Name: name, Order: len(lay.Groups)}
	lay.Groups = append(lay.Groups, g)
	return g, s.save(lay)
}

func (s *Store) RenameGroup(id, name string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	lay := s.load()
	for i := range lay.Groups {
		if lay.Groups[i].ID == id {
			lay.Groups[i].Name = name
		}
	}
	return s.save(lay)
}

func (s *Store) DeleteGroup(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	lay := s.load()
	groups := lay.Groups[:0]
	for _, g := range lay.Groups {
		if g.ID != id {
			groups = append(groups, g)
		}
	}
	lay.Groups = groups
	for i := range lay.Projects { // orphaned projects → ungrouped
		if lay.Projects[i].GroupID == id {
			lay.Projects[i].GroupID = ""
		}
	}
	return s.save(lay)
}

func (s *Store) MoveProject(id, groupID string, order int) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	lay := s.load()
	for i := range lay.Projects {
		if lay.Projects[i].ID == id {
			lay.Projects[i].GroupID = groupID
			lay.Projects[i].Order = order
		}
	}
	return s.save(lay)
}

func (s *Store) CreateProject(name, groupID string, gitInit bool) (Project, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !validName(name) {
		return Project{}, errors.New("invalid project name")
	}
	dir := filepath.Join(s.root, name)
	if abs, err := filepath.Abs(dir); err != nil || !s.withinRoot(abs) {
		return Project{}, errors.New("invalid project path")
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return Project{}, err
	}
	if gitInit {
		_ = exec.Command("git", "-C", dir, "init").Run()
	}
	lay := s.load()
	p := Project{ID: "p_" + name, Name: name, Path: name, GroupID: groupID, Order: len(lay.Projects)}
	lay.Projects = append(lay.Projects, p)
	return p, s.save(lay)
}

// ProjectPath returns the absolute path for a project id (for terminal cwd).
func (s *Store) ProjectPath(id string) (string, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	lay := s.load()
	for _, p := range lay.Projects {
		if p.ID == id {
			abs := filepath.Join(s.root, p.Path)
			cleaned, err := filepath.Abs(abs)
			if err != nil || !s.withinRoot(cleaned) {
				return "", false
			}
			return cleaned, true
		}
	}
	return "", false
}
