import { useCallback, useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

// One live xterm bound to a project's tmux session, with auto-reconnect.
// tmux handles session persistence and repaint on reconnect — no session id
// tracking needed; reconnecting with the same project (and optional n) param
// re-attaches the same tmux session automatically.
//
// Returns `send(data)` so on-screen controls (e.g. a mobile key bar) can inject
// raw bytes to the PTY through the same WebSocket the terminal uses.
export function useTerminal(projectId: string, n: number | undefined, el: HTMLDivElement | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const termRef = useRef<Terminal | null>(null);

  useEffect(() => {
    if (!el) return;
    const term = new Terminal({
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      fontSize: 13,
      theme: { background: "#0d0f12", foreground: "#d7dce3", cursor: "#5b9dd9" },
      cursorBlink: true,
    });
    termRef.current = term;
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(el);
    fit.fit();

    let closed = false;

    const connect = () => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const nParam = n != null && n > 0 ? `&n=${n}` : "";
      const ws = new WebSocket(
        `${proto}://${location.host}/ws/term?project=${encodeURIComponent(projectId)}&cols=${term.cols}&rows=${term.rows}${nParam}`,
      );
      wsRef.current = ws;
      ws.binaryType = "arraybuffer";
      ws.onmessage = (ev) => {
        if (typeof ev.data === "string") {
          // parse-and-discard informational text frames (e.g. {"type":"session"})
          return;
        }
        term.write(new Uint8Array(ev.data));
      };
      ws.onclose = () => {
        if (!closed) setTimeout(connect, 1000);
      };
    };
    connect();

    const onDataDisposable = term.onData((d) => {
      const ws = wsRef.current;
      if (ws?.readyState === 1) ws.send(new TextEncoder().encode(d));
    });
    const sendResize = () => {
      fit.fit();
      const ws = wsRef.current;
      if (ws?.readyState === 1) {
        ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
      }
    };
    const ro = new ResizeObserver(sendResize);
    ro.observe(el);

    return () => {
      closed = true;
      onDataDisposable.dispose();
      ro.disconnect();
      wsRef.current?.close();
      wsRef.current = null;
      term.dispose();
      termRef.current = null;
    };
  }, [projectId, n, el]);

  // Inject raw bytes to the PTY, then refocus the terminal so typing continues.
  const send = useCallback((data: string) => {
    const ws = wsRef.current;
    if (ws?.readyState === 1) ws.send(new TextEncoder().encode(data));
    termRef.current?.focus();
  }, []);

  return { send };
}
