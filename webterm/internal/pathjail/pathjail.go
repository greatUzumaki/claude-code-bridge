// Package pathjail confines user-supplied relative paths to a root directory.
package pathjail

import (
	"errors"
	"path/filepath"
	"strings"
)

var ErrEscape = errors.New("path escapes root")

type Jail struct{ root string }

func New(root string) *Jail {
	abs, _ := filepath.Abs(root)
	return &Jail{root: filepath.Clean(abs)}
}

func (j *Jail) Root() string { return j.root }

// Resolve maps a relative path to an absolute path inside root, or errors.
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
	// Final safety check: ensure the resolved path is within root.
	if abs != j.root && !strings.HasPrefix(abs, j.root+string(filepath.Separator)) {
		return "", ErrEscape
	}
	return abs, nil
}
