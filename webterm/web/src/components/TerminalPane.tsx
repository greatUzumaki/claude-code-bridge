import { useRef, useState, useEffect } from "react";
import {
  Keyboard,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  CornerDownLeft,
  type LucideIcon,
} from "lucide-react";
import { useTerminal } from "../hooks/useTerminal";

// Raw byte sequences sent to the PTY. Arrows are the ANSI cursor codes;
// Enter = CR; "Ctrl C" = 0x03 (SIGINT) — the terminal-useful "cmd+C".
type Key = { label?: string; icon?: LucideIcon; data: string; aria: string; confirm?: boolean };

const KEYS: Key[] = [
  { label: "Esc", data: "\x1b", aria: "Escape" },
  { icon: ArrowUp, data: "\x1b[A", aria: "Arrow up" },
  { icon: ArrowLeft, data: "\x1b[D", aria: "Arrow left" },
  { icon: ArrowDown, data: "\x1b[B", aria: "Arrow down" },
  { icon: ArrowRight, data: "\x1b[C", aria: "Arrow right" },
  { icon: CornerDownLeft, data: "\r", aria: "Enter" },
  // Ctrl-C interrupts the running process — confirm before sending (easy to mis-tap on a phone).
  { label: "Ctrl C", data: "\x03", aria: "Ctrl C (interrupt)", confirm: true },
];

export function TerminalPane({ projectId, n }: { projectId: string; n?: number }) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => setEl(ref.current), []);
  const { send } = useTerminal(projectId, n, el);
  const [showKeys, setShowKeys] = useState(false);
  const [confirmKey, setConfirmKey] = useState<Key | null>(null);

  const pressKey = (k: Key) => {
    if (k.confirm) setConfirmKey(k);
    else send(k.data);
  };

  return (
    <div className="h-full w-full flex flex-col relative bg-bg">
      <div ref={ref} className="flex-1 min-h-0 w-full" />

      {/* Toggle for the on-screen key bar (handy on phones) */}
      <button
        onClick={() => setShowKeys((v) => !v)}
        aria-label={showKeys ? "Hide on-screen keys" : "Show on-screen keys"}
        aria-pressed={showKeys}
        className={[
          "absolute right-2 z-10 flex items-center justify-center rounded-full transition-colors hover:bg-white/10 active:bg-white/20",
          "w-10 h-10 bg-panel border border-border",
          showKeys ? "text-accent" : "text-muted",
        ].join(" ")}
        style={{ bottom: showKeys ? "52px" : "8px" }}
      >
        <Keyboard size={18} />
      </button>

      {/* On-screen key bar */}
      {showKeys && (
        <div className="shrink-0 flex items-stretch gap-1 px-1 w-full min-h-11 border-t border-border bg-panel">
          {KEYS.map((k) => {
            const Icon = k.icon;
            return (
              <button
                key={k.aria}
                onClick={() => pressKey(k)}
                aria-label={k.aria}
                className="flex-1 flex items-center justify-center rounded transition-colors hover:bg-white/5 active:bg-white/10 min-w-0 h-11 text-text text-[13px]"
              >
                {Icon ? <Icon size={18} /> : k.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Confirmation modal for keys that interrupt (Ctrl-C) */}
      {confirmKey && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm key"
        >
          <div
            className="absolute inset-0 bg-black/55"
            onClick={() => setConfirmKey(null)}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-xs rounded-lg border border-border bg-panel p-4">
            <p className="text-text text-sm">
              Send{" "}
              <span className="text-accent font-medium">{confirmKey.label ?? confirmKey.aria}</span>
              ? This interrupts the running process.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setConfirmKey(null)}
                className="rounded px-4 h-11 text-muted transition-colors hover:bg-white/5 active:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  send(confirmKey.data);
                  setConfirmKey(null);
                }}
                className="rounded px-4 h-11 text-accent font-medium transition-colors hover:bg-white/5 active:bg-white/10"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
