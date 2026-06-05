import { useEffect } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

// One live xterm bound to a project's tmux session, with auto-reconnect.
// tmux handles session persistence and repaint on reconnect — no session id
// tracking needed; reconnecting with the same project (and optional n) param
// re-attaches the same tmux session automatically.
export function useTerminal(
  projectId: string,
  n: number | undefined,
  el: HTMLDivElement | null
) {
  useEffect(() => {
    if (!el) return;
    const term = new Terminal({
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      fontSize: 13,
      theme: { background: "#0d0f12", foreground: "#d7dce3", cursor: "#5b9dd9" },
      cursorBlink: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(el);
    fit.fit();

    let ws: WebSocket | null = null;
    let closed = false;

    const connect = () => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const nParam = n != null && n > 0 ? `&n=${n}` : "";
      ws = new WebSocket(
        `${proto}://${location.host}/ws/term?project=${encodeURIComponent(projectId)}&cols=${term.cols}&rows=${term.rows}${nParam}`
      );
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

    const onDataDisposable = term.onData(
      (d) => ws?.readyState === 1 && ws.send(new TextEncoder().encode(d))
    );
    const sendResize = () => {
      fit.fit();
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
      ws?.close();
      term.dispose();
    };
  }, [projectId, n, el]);
}
