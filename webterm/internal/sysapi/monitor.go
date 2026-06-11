package sysapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
	"syscall"
	"time"

	gnet "github.com/shirou/gopsutil/v4/net"
	"github.com/shirou/gopsutil/v4/process"
)

// containerRef restricts docker action targets to id/name shapes that cannot be
// mistaken for a flag (no leading dash) or used for argv injection.
var containerRef = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9_.-]*$`)

// dockerPS shells out to `docker ps` and passes the raw container objects
// through to the client. The service user must be in the `docker` group; if
// docker is missing or access is denied we return available:false (not an
// error) so the page can show a friendly message instead of breaking.
func (a *API) dockerPS(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	out, err := exec.CommandContext(ctx, "docker", "ps", "-a", "--no-trunc", "--format", "{{json .}}").Output()
	if err != nil {
		msg := "docker unavailable"
		var ee *exec.ExitError
		if errors.As(err, &ee) {
			if s := strings.TrimSpace(string(ee.Stderr)); s != "" {
				msg = s
			}
		}
		writeJSON(w, http.StatusOK, map[string]any{"available": false, "error": msg, "containers": []any{}})
		return
	}
	containers := []map[string]any{}
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		if line == "" {
			continue
		}
		var c map[string]any
		if json.Unmarshal([]byte(line), &c) == nil {
			containers = append(containers, c)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"available": true, "containers": containers})
}

type procInfo struct {
	PID   int32    `json:"pid"`
	Name  string   `json:"name"`
	User  string   `json:"user"`
	CPU   float64  `json:"cpu"`
	MemMB float64  `json:"memMB"`
	Cmd   string   `json:"cmd"`
	Ports []uint32 `json:"ports,omitempty"`
}

type listenPort struct {
	Port uint32 `json:"port"`
	PID  int32  `json:"pid"`
	Name string `json:"name"`
}

// processes returns running processes (with any listening ports attributed to
// them) plus a flat list of all listening ports. As a non-root user, sockets
// owned by other users can't be mapped to a PID — those still appear in
// `listening` (port visible, pid 0 / name empty) so nothing is hidden.
func (a *API) processes(w http.ResponseWriter, _ *http.Request) {
	portsByPID := map[int32][]uint32{}
	listening := []listenPort{}
	if conns, err := gnet.Connections("inet"); err == nil {
		for _, c := range conns {
			if c.Status != "LISTEN" {
				continue
			}
			listening = append(listening, listenPort{Port: c.Laddr.Port, PID: c.Pid})
			if c.Pid != 0 {
				portsByPID[c.Pid] = append(portsByPID[c.Pid], c.Laddr.Port)
			}
		}
	}

	procs, _ := process.Processes()
	list := make([]procInfo, 0, len(procs))
	names := map[int32]string{}
	for _, p := range procs {
		name, _ := p.Name()
		names[p.Pid] = name
		user, _ := p.Username()
		cpu, _ := p.CPUPercent()
		var memMB float64
		if mi, err := p.MemoryInfo(); err == nil && mi != nil {
			memMB = float64(mi.RSS) / (1024 * 1024)
		}
		cmd, _ := p.Cmdline()
		if r := []rune(cmd); len(r) > 240 {
			cmd = string(r[:240]) + "…"
		}
		list = append(list, procInfo{
			PID: p.Pid, Name: name, User: user, CPU: cpu, MemMB: memMB,
			Cmd: cmd, Ports: portsByPID[p.Pid],
		})
	}
	for i := range listening {
		listening[i].Name = names[listening[i].PID]
	}
	writeJSON(w, http.StatusOK, map[string]any{"processes": list, "listening": listening})
}

// dockerAction runs `docker start|stop|restart <id>`. The id is validated to a
// safe shape and the action whitelisted, so neither can inject flags/args.
func (a *API) dockerAction(w http.ResponseWriter, r *http.Request) {
	var b struct{ ID, Action string }
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		writeErr(w, http.StatusBadRequest, "bad json")
		return
	}
	if !containerRef.MatchString(b.ID) {
		writeErr(w, http.StatusBadRequest, "invalid container id")
		return
	}
	switch b.Action {
	case "start", "stop", "restart":
	default:
		writeErr(w, http.StatusBadRequest, "invalid action")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()
	out, err := exec.CommandContext(ctx, "docker", b.Action, b.ID).CombinedOutput()
	if err != nil {
		msg := strings.TrimSpace(string(out))
		if msg == "" {
			msg = err.Error()
		}
		writeErr(w, http.StatusBadGateway, msg)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// killProcess sends SIGTERM (or SIGKILL with ?signal=KILL) to a pid. Refuses pid
// <= 1 (init) and the WebTerm server's own pid. As a non-root user the kernel
// still blocks signalling processes owned by other users (returns EPERM).
func (a *API) killProcess(w http.ResponseWriter, r *http.Request) {
	pid, err := strconv.Atoi(r.URL.Query().Get("pid"))
	if err != nil || pid <= 1 {
		writeErr(w, http.StatusBadRequest, "invalid pid")
		return
	}
	if pid == os.Getpid() {
		writeErr(w, http.StatusBadRequest, "refusing to kill the WebTerm server")
		return
	}
	sig := syscall.SIGTERM
	if r.URL.Query().Get("signal") == "KILL" {
		sig = syscall.SIGKILL
	}
	if err := syscall.Kill(pid, sig); err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
