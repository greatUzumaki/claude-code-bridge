import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { SearchAddon } from "@xterm/addon-search";
import "@xterm/xterm/css/xterm.css";
import { reportLatency, unreportLatency } from "../lib/latency";

// One live xterm bound to a project's tmux session, with auto-reconnect.
// tmux handles session persistence and repaint on reconnect — no session id
// tracking needed; reconnecting with the same project (and optional n) param
// re-attaches the same tmux session automatically.
//
// Returns `send(data)` so on-screen controls (e.g. a mobile key bar) can inject
// raw bytes to the PTY through the same WebSocket the terminal uses.

const FONT_SIZE_KEY = "webterm_fontsize";
const FONT_MIN = 9;
const FONT_MAX = 24;
const FONT_DEFAULT = 13;

function clampFont(v: number): number {
  return Math.max(FONT_MIN, Math.min(FONT_MAX, v));
}

function loadFontSize(): number {
  const raw = localStorage.getItem(FONT_SIZE_KEY);
  if (raw !== null) {
    const n = parseInt(raw, 10);
    if (!isNaN(n)) return clampFont(n);
  }
  return FONT_DEFAULT;
}

export function useTerminal(projectId: string, n: number | undefined, el: HTMLDivElement | null) {
  const paneId = useId();
  const wsRef = useRef<WebSocket | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);

  const [status, setStatus] = useState<"connecting" | "open" | "closed">("connecting");
  const [fontSize, setFontSizeState] = useState<number>(loadFontSize);

  useEffect(() => {
    if (!el) return;

    const initialFontSize = loadFontSize();

    const term = new Terminal({
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      fontSize: initialFontSize,
      theme: { background: "#0d0f12", foreground: "#d7dce3", cursor: "#5b9dd9" },
      cursorBlink: true,
    });
    termRef.current = term;

    const fit = new FitAddon();
    fitRef.current = fit;
    term.loadAddon(fit);

    const searchAddon = new SearchAddon();
    searchAddonRef.current = searchAddon;
    term.loadAddon(searchAddon);

    term.open(el);
    fit.fit();

    let closed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;

    const stopPing = () => {
      if (pingTimer !== null) {
        clearInterval(pingTimer);
        pingTimer = null;
      }
    };

    const connect = () => {
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      setStatus("connecting");
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const nParam = n != null && n > 0 ? `&n=${n}` : "";
      const ws = new WebSocket(
        `${proto}://${location.host}/ws/term?project=${encodeURIComponent(projectId)}&cols=${term.cols}&rows=${term.rows}${nParam}`,
      );
      wsRef.current = ws;
      ws.binaryType = "arraybuffer";
      const ping = () => {
        if (ws.readyState === 1) ws.send(JSON.stringify({ type: "ping", t: Date.now() }));
      };
      ws.onopen = () => {
        setStatus("open");
        ping(); // measure immediately, then every 5s
        stopPing();
        pingTimer = setInterval(ping, 5000);
      };
      ws.onmessage = (ev) => {
        if (typeof ev.data === "string") {
          // Text frames are control JSON (e.g. {"type":"session"} / {"type":"pong"}).
          try {
            const msg = JSON.parse(ev.data);
            if (msg.type === "pong" && typeof msg.t === "number") {
              reportLatency(paneId, Date.now() - msg.t);
            }
          } catch {
            // ignore malformed control frames
          }
          return;
        }
        term.write(new Uint8Array(ev.data));
      };
      ws.onclose = () => {
        stopPing();
        setStatus("closed");
        if (!closed) reconnectTimer = setTimeout(connect, 1000);
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
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      stopPing();
      unreportLatency(paneId);
      onDataDisposable.dispose();
      ro.disconnect();
      wsRef.current?.close();
      wsRef.current = null;
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
      searchAddonRef.current = null;
    };
  }, [projectId, n, el, paneId]);

  // Inject raw bytes to the PTY, then refocus the terminal so typing continues.
  const send = useCallback((data: string) => {
    const ws = wsRef.current;
    if (ws?.readyState === 1) ws.send(new TextEncoder().encode(data));
    termRef.current?.focus();
  }, []);

  // Adjust font size by delta, clamp, persist, refit, and send resize.
  const setFont = useCallback((delta: number) => {
    const term = termRef.current;
    const fit = fitRef.current;
    if (!term || !fit) return;

    const next = clampFont((term.options.fontSize ?? FONT_DEFAULT) + delta);
    term.options.fontSize = next;
    fit.fit();
    setFontSizeState(next);
    localStorage.setItem(FONT_SIZE_KEY, String(next));

    const ws = wsRef.current;
    if (ws?.readyState === 1) {
      ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
    }
  }, []);

  const findNext = useCallback((q: string) => {
    searchAddonRef.current?.findNext(q, { caseSensitive: false });
  }, []);

  const findPrevious = useCallback((q: string) => {
    searchAddonRef.current?.findPrevious(q, { caseSensitive: false });
  }, []);

  const clearSearch = useCallback(() => {
    searchAddonRef.current?.clearDecorations();
  }, []);

  return { send, status, fontSize, setFont, findNext, findPrevious, clearSearch };
}
