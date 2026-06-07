// Package sysapi exposes system-level read-only endpoints: git status for all
// projects and host CPU/memory/load statistics.
package sysapi

import (
	"context"
	"encoding/json"
	"net/http"
	"os/exec"
	"strings"
	"sync"
	"time"

	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/load"
	"github.com/shirou/gopsutil/v4/mem"

	"webterm/internal/project"
)

// API holds a reference to the project store for listing projects.
type API struct{ store *project.Store }

// New creates a sysapi.API.
func New(store *project.Store) *API { return &API{store: store} }

// Register wires the two endpoints into mux.
func (a *API) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/git/status", a.gitStatus)
	mux.HandleFunc("GET /api/host/stats", a.hostStats)
}

// gitProjectStatus holds the per-project git info returned to the client.
type gitProjectStatus struct {
	IsRepo bool   `json:"isRepo"`
	Branch string `json:"branch,omitempty"`
	Dirty  bool   `json:"dirty,omitempty"`
}

func (a *API) gitStatus(w http.ResponseWriter, r *http.Request) {
	lay, err := a.store.List()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}

	type result struct {
		id     string
		status gitProjectStatus
	}

	const gitConcurrency = 6
	sem := make(chan struct{}, gitConcurrency)

	results := make([]result, len(lay.Projects))
	var wg sync.WaitGroup
	for i, p := range lay.Projects {
		wg.Add(1)
		go func(idx int, proj project.Project) {
			defer wg.Done()
			res := result{id: proj.ID}
			dir, ok := a.store.ProjectPath(proj.ID)
			if !ok {
				results[idx] = res
				return
			}
			sem <- struct{}{}
			defer func() { <-sem }()
			ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
			defer cancel()

			// Get branch.
			branchOut, branchErr := exec.CommandContext(ctx, "git", "-C", dir, "rev-parse", "--abbrev-ref", "HEAD").Output()
			if branchErr != nil {
				// Not a git repo.
				results[idx] = res
				return
			}
			branch := strings.TrimSpace(string(branchOut))

			// Get porcelain status.
			porcelainOut, _ := exec.CommandContext(ctx, "git", "-C", dir, "status", "--porcelain").Output()
			dirty := len(strings.TrimSpace(string(porcelainOut))) > 0

			res.status = gitProjectStatus{IsRepo: true, Branch: branch, Dirty: dirty}
			results[idx] = res
		}(i, p)
	}
	wg.Wait()

	statuses := make(map[string]gitProjectStatus, len(results))
	for _, r := range results {
		statuses[r.id] = r.status
	}
	writeJSON(w, http.StatusOK, map[string]any{"statuses": statuses})
}

func (a *API) hostStats(w http.ResponseWriter, _ *http.Request) {
	// CPU percent — non-blocking (interval=0 gives instantaneous reading).
	cpuPcts, _ := cpu.Percent(0, false)
	cpuPct := 0.0
	if len(cpuPcts) > 0 {
		cpuPct = cpuPcts[0]
	}

	// Memory.
	vmStat, _ := mem.VirtualMemory()
	var memUsedMB, memTotalMB, memPercent float64
	if vmStat != nil {
		memUsedMB = float64(vmStat.Used) / (1024 * 1024)
		memTotalMB = float64(vmStat.Total) / (1024 * 1024)
		memPercent = vmStat.UsedPercent
	}

	// Load average — guard against platforms that don't support it.
	load1 := 0.0
	if avg, err := load.Avg(); err == nil && avg != nil {
		load1 = avg.Load1
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"cpuPercent":  cpuPct,
		"memUsedMB":   memUsedMB,
		"memTotalMB":  memTotalMB,
		"memPercent":  memPercent,
		"load1":       load1,
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
