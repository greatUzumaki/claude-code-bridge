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
const KEYS: { label?: string; icon?: LucideIcon; data: string; aria: string }[] = [
  { label: "Esc", data: "\x1b", aria: "Escape" },
  { icon: ArrowUp, data: "\x1b[A", aria: "Arrow up" },
  { icon: ArrowLeft, data: "\x1b[D", aria: "Arrow left" },
  { icon: ArrowDown, data: "\x1b[B", aria: "Arrow down" },
  { icon: ArrowRight, data: "\x1b[C", aria: "Arrow right" },
  { icon: CornerDownLeft, data: "\r", aria: "Enter" },
  { label: "Ctrl C", data: "\x03", aria: "Ctrl C (interrupt)" },
];

export function TerminalPane({ projectId, n }: { projectId: string; n?: number }) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => setEl(ref.current), []);
  const { send } = useTerminal(projectId, n, el);
  const [showKeys, setShowKeys] = useState(false);

  return (
    <div className="h-full w-full flex flex-col relative" style={{ background: "var(--bg)" }}>
      <div ref={ref} className="flex-1 min-h-0 w-full" />

      {/* Toggle for the on-screen key bar (handy on phones) */}
      <button
        onClick={() => setShowKeys((v) => !v)}
        aria-label={showKeys ? "Hide on-screen keys" : "Show on-screen keys"}
        aria-pressed={showKeys}
        className="absolute right-2 z-10 flex items-center justify-center rounded-full transition-colors hover:bg-white/10 active:bg-white/20"
        style={{
          bottom: showKeys ? "52px" : "8px",
          width: "40px",
          height: "40px",
          background: "var(--panel)",
          border: "1px solid var(--border)",
          color: showKeys ? "var(--accent)" : "var(--muted)",
        }}
      >
        <Keyboard size={18} />
      </button>

      {/* On-screen key bar */}
      {showKeys && (
        <div
          className="shrink-0 flex items-stretch gap-1 px-1 overflow-x-auto"
          style={{
            minHeight: "44px",
            borderTop: "1px solid var(--border)",
            background: "var(--panel)",
          }}
        >
          {KEYS.map((k) => {
            const Icon = k.icon;
            return (
              <button
                key={k.aria}
                onClick={() => send(k.data)}
                aria-label={k.aria}
                className="flex items-center justify-center shrink-0 rounded transition-colors hover:bg-white/5 active:bg-white/10"
                style={{
                  minWidth: "44px",
                  height: "44px",
                  padding: "0 12px",
                  color: "var(--text)",
                  fontSize: "13px",
                }}
              >
                {Icon ? <Icon size={18} /> : k.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
