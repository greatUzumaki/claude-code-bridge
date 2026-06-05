// Package pathjail confines user-supplied relative paths to a root directory.
package pathjail

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
)

var ErrEscape = errors.New("path escapes root")

type Jail struct{ root string }

func New(root string) *Jail {
	abs, _ := filepath.Abs(root)
	// Canonicalize the root through any symlinks so symlink-aware containment
	// checks below compare resolved paths against a resolved root.
	if resolved, err := filepath.EvalSymlinks(abs); err == nil {
		abs = resolved
	}
	return &Jail{root: filepath.Clean(abs)}
}

func (j *Jail) Root() string { return j.root }

// Resolve maps a relative path to an absolute path inside root, or errors.
// Rejects absolute paths and ".." components, then enforces containment both
// lexically AND through symlinks: a symlink under root whose target escapes
// root is rejected (prevents a planted/cloned symlink from letting fs ops read
// or write outside the jail).
func (j *Jail) Resolve(rel string) (string, error) {
	// Reject absolute paths outright — caller must supply relative paths only.
	if filepath.IsAbs(rel) {
		return "", ErrEscape
	}
	// Reject any path containing ".." components.
	if rel != "" && (strings.Contains(rel, "../") || strings.HasSuffix(rel, "..") || rel == "..") {
		return "", ErrEscape
	}
	// Join and clean with root.
	var abs string
	if rel == "" {
		abs = j.root
	} else {
		abs = filepath.Clean(filepath.Join(j.root, rel))
	}
	// Lexical containment (defense in depth).
	if !j.contains(abs) {
		return "", ErrEscape
	}
	// Symlink-aware containment: resolve the path, or its parent if the leaf
	// does not exist yet (create/write/mkdir), and require the target in root.
	check := abs
	if _, err := os.Lstat(abs); err != nil {
		check = filepath.Dir(abs)
	}
	if resolved, err := filepath.EvalSymlinks(check); err == nil && !j.contains(resolved) {
		return "", ErrEscape
	}
	return abs, nil
}

// contains reports whether abs is the root or a descendant of it.
func (j *Jail) contains(abs string) bool {
	return abs == j.root || strings.HasPrefix(abs, j.root+string(filepath.Separator))
}
