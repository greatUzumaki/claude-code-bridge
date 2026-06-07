package terminal

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os/exec"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"
)

const wsMarker = "persist_marker_42"

func TestWSEchoAndPersist(t *testing.T) {
	if _, err := exec.LookPath("tmux"); err != nil {
		t.Skip("tmux not installed")
	}
	// Run against an ISOLATED tmux server (private socket dir) so the test never
	// contends with — or is slowed by — the developer's real sessions on the
	// default server. All exec("tmux", …) in this process inherit TMUX_TMPDIR.
	t.Setenv("TMUX_TMPDIR", t.TempDir())
	defer func() { _ = exec.Command("tmux", "kill-server").Run() }()
	dir := t.TempDir()
	h := NewWSHandler(func(string) (string, bool) { return dir, true }, nil)
	srv := httptest.NewServer(http.HandlerFunc(h.Handle))
	defer srv.Close()
	defer Kill(SessionName("p_wsx", 0))

	dial := func() (*websocket.Conn, context.Context, context.CancelFunc) {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		url := "ws" + strings.TrimPrefix(srv.URL, "http") + "/ws/term?project=p_wsx&cols=80&rows=24"
		c, _, err := websocket.Dial(ctx, url, nil)
		if err != nil {
			t.Fatal(err)
		}
		c.SetReadLimit(1 << 20)
		return c, ctx, cancel
	}

	// 1) connect, wait for the shell prompt (so input isn't typed before the PTY
	//    is ready), run a command, and see it echoed + its output.
	c, ctx, cancel := dial()
	waitForOutput(t, c, ctx)
	// Send twice with a small gap: idempotent, and guards against the first line
	// being dropped if the shell rc hadn't finished. Then require two marker
	// occurrences (the echoed input + the command's output).
	mustWrite(t, c, ctx, "echo "+wsMarker+"\n")
	time.Sleep(250 * time.Millisecond)
	mustWrite(t, c, ctx, "echo "+wsMarker+"\n")
	if !readMarker(c, ctx, wsMarker, 2, 12*time.Second) {
		t.Fatalf("never saw %q (x2) after sending command", wsMarker)
	}
	c.Close(websocket.StatusNormalClosure, "")
	cancel()
	time.Sleep(300 * time.Millisecond) // let the PTY client detach cleanly

	// 2) reconnect → tmux repaint must still show the marker (session persisted)
	c2, ctx2, cancel2 := dial()
	defer cancel2()
	defer c2.Close(websocket.StatusNormalClosure, "")
	if !readMarker(c2, ctx2, wsMarker, 1, 10*time.Second) {
		t.Fatalf("never saw %q after reconnect (session did not persist)", wsMarker)
	}
}

func mustWrite(t *testing.T, c *websocket.Conn, ctx context.Context, s string) {
	t.Helper()
	if err := c.Write(ctx, websocket.MessageBinary, []byte(s)); err != nil {
		t.Fatalf("write: %v", err)
	}
}

// waitForOutput blocks (single context, no mid-read cancellation — cancelling a
// coder/websocket Read closes the connection) until the first bytes arrive, then
// lets the shell rc settle.
func waitForOutput(t *testing.T, c *websocket.Conn, base context.Context) {
	t.Helper()
	ctx, cancel := context.WithTimeout(base, 15*time.Second)
	defer cancel()
	for {
		_, data, err := c.Read(ctx)
		if err != nil {
			t.Fatalf("no initial shell output: %v", err)
		}
		if len(data) > 0 {
			time.Sleep(400 * time.Millisecond)
			return
		}
	}
}

// readMarker reads with ONE timeout context (blocking reads, never cancelled
// mid-stream) until want appears >= n times, or the timeout elapses.
func readMarker(c *websocket.Conn, base context.Context, want string, n int, timeout time.Duration) bool {
	ctx, cancel := context.WithTimeout(base, timeout)
	defer cancel()
	var acc strings.Builder
	for {
		_, data, err := c.Read(ctx)
		if err != nil {
			return false // deadline reached or connection closed
		}
		acc.Write(data)
		if strings.Count(acc.String(), want) >= n {
			return true
		}
	}
}
