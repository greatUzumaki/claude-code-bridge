package terminal

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"os/exec"
	"strconv"
	"sync"

	"github.com/coder/websocket"
	"github.com/creack/pty"
)

// ResolveProject maps a project id → absolute working directory.
type ResolveProject func(projectID string) (string, bool)

type WSHandler struct {
	resolve        ResolveProject
	allowedOrigins []string // empty = strict same-origin (blocks cross-site WS hijack)
}

func NewWSHandler(resolve ResolveProject, allowedOrigins []string) *WSHandler {
	return &WSHandler{resolve: resolve, allowedOrigins: allowedOrigins}
}

type ctrlMsg struct {
	Type string `json:"type"` // "resize" | "ping"
	Cols uint16 `json:"cols"`
	Rows uint16 `json:"rows"`
	T    int64  `json:"t,omitempty"` // client timestamp, echoed back in a "pong"
}

func (h *WSHandler) Handle(w http.ResponseWriter, r *http.Request) {
	c, err := websocket.Accept(w, r, &websocket.AcceptOptions{OriginPatterns: h.allowedOrigins})
	if err != nil {
		return
	}
	defer c.Close(websocket.StatusInternalError, "bye")
	// Own the connection lifetime: r.Context() may be cancelled once the HTTP
	// connection is hijacked by Accept, which would prematurely fail writes and
	// silently stop the terminal from painting. Use a dedicated context, and
	// cancel it from whichever direction ends first so both tear down together.
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Serialize all writes: the PTY→client goroutine and the control-message
	// (pong) path both write, and a coder/websocket Conn allows only one writer
	// at a time.
	var wmu sync.Mutex
	write := func(typ websocket.MessageType, data []byte) error {
		wmu.Lock()
		defer wmu.Unlock()
		return c.Write(ctx, typ, data)
	}

	q := r.URL.Query()
	dir, ok := h.resolve(q.Get("project"))
	if !ok {
		c.Close(websocket.StatusPolicyViolation, "unknown project")
		return
	}
	n, _ := strconv.Atoi(q.Get("n"))
	name := SessionName(q.Get("project"), n)
	cols := atou16(q.Get("cols"), 80)
	rows := atou16(q.Get("rows"), 24)

	if err := ensure(name, dir); err != nil {
		c.Close(websocket.StatusInternalError, "tmux ensure failed")
		return
	}

	// Thin PTY client that attaches the persistent tmux session.
	cmd := exec.Command("tmux", "-u", "attach", "-t", name)
	cmd.Env = append(os.Environ(), "TERM=xterm-256color")
	ptmx, err := pty.StartWithSize(cmd, &pty.Winsize{Cols: cols, Rows: rows})
	if err != nil {
		c.Close(websocket.StatusInternalError, "pty start failed")
		return
	}
	// On WS end: kill only the attach client → tmux detaches, session persists.
	defer func() {
		_ = ptmx.Close()
		if cmd.Process != nil {
			_ = cmd.Process.Kill()
			_, _ = cmd.Process.Wait()
		}
	}()

	hdr, _ := json.Marshal(map[string]string{"type": "session", "id": name})
	_ = write(websocket.MessageText, hdr)

	// tmux (via PTY) → client
	go func() {
		defer cancel() // when output ends, unblock the read loop below too
		buf := make([]byte, 32*1024)
		for {
			nr, er := ptmx.Read(buf)
			if nr > 0 {
				if ew := write(websocket.MessageBinary, buf[:nr]); ew != nil {
					return
				}
			}
			if er != nil {
				c.Close(websocket.StatusNormalClosure, "closed")
				return
			}
		}
	}()

	// client → tmux (binary = keystrokes, text = control JSON)
	for {
		typ, data, er := c.Read(ctx)
		if er != nil {
			return
		}
		if typ == websocket.MessageText {
			var m ctrlMsg
			if json.Unmarshal(data, &m) == nil {
				switch m.Type {
				case "resize":
					_ = pty.Setsize(ptmx, &pty.Winsize{Cols: m.Cols, Rows: m.Rows})
				case "ping":
					pong, _ := json.Marshal(map[string]any{"type": "pong", "t": m.T})
					_ = write(websocket.MessageText, pong)
				}
			}
			continue
		}
		_, _ = ptmx.Write(data)
	}
}

func atou16(s string, def uint16) uint16 {
	if v, err := strconv.Atoi(s); err == nil && v > 0 && v < 65535 {
		return uint16(v)
	}
	return def
}
