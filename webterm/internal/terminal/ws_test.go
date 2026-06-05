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

func TestWSEchoAndPersist(t *testing.T) {
	if _, err := exec.LookPath("tmux"); err != nil {
		t.Skip("tmux not installed")
	}
	dir := t.TempDir()
	h := NewWSHandler(func(string) (string, bool) { return dir, true }, nil)
	srv := httptest.NewServer(http.HandlerFunc(h.Handle))
	defer srv.Close()
	defer Kill(SessionName("p_wsx", 0))

	dial := func() (*websocket.Conn, context.Context, context.CancelFunc) {
		ctx, cancel := context.WithTimeout(context.Background(), 6*time.Second)
		url := "ws" + strings.TrimPrefix(srv.URL, "http") + "/ws/term?project=p_wsx&cols=80&rows=24"
		c, _, err := websocket.Dial(ctx, url, nil)
		if err != nil {
			t.Fatal(err)
		}
		return c, ctx, cancel
	}

	// 1) connect, run a command; wait for the output line (after the echo of the cmd)
	c, ctx, cancel := dial()
	c.Write(ctx, websocket.MessageBinary, []byte("echo persist_marker_42\n"))
	// Wait for two occurrences: the echoed input AND the actual output line.
	readUntilN(t, c, ctx, "persist_marker_42", 2)
	c.Close(websocket.StatusNormalClosure, "")
	cancel()
	time.Sleep(300 * time.Millisecond) // let the PTY client detach cleanly

	// 2) reconnect → tmux repaint must still show the marker (session persisted)
	c2, ctx2, cancel2 := dial()
	defer cancel2()
	defer c2.Close(websocket.StatusNormalClosure, "")
	readUntil(t, c2, ctx2, "persist_marker_42")
}

func readUntil(t *testing.T, c *websocket.Conn, ctx context.Context, want string) {
	t.Helper()
	readUntilN(t, c, ctx, want, 1)
}

// readUntilN waits until want appears at least n times in the accumulated stream.
func readUntilN(t *testing.T, c *websocket.Conn, ctx context.Context, want string, n int) {
	t.Helper()
	c.SetReadLimit(1 << 20)
	deadline := time.Now().Add(5 * time.Second)
	var accumulated strings.Builder
	for time.Now().Before(deadline) {
		rctx, rcancel := context.WithTimeout(ctx, 800*time.Millisecond)
		_, data, err := c.Read(rctx)
		rcancel()
		if err == nil {
			accumulated.Write(data)
			if strings.Count(accumulated.String(), want) >= n {
				return
			}
		}
	}
	t.Fatalf("never saw %q (x%d)", want, n)
}
