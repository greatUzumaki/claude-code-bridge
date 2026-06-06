import { useRef, useState, useEffect, useCallback } from "react";
import {
  Keyboard,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  CornerDownLeft,
  Search,
  ChevronUp,
  ChevronDown,
  X,
  type LucideIcon,
} from "lucide-react";
import { useTerminal } from "../hooks/useTerminal";
import { useSettings } from "../lib/settings";
import { haptic } from "../lib/haptics";

// Raw byte sequences sent to the PTY. Arrows are the ANSI cursor codes;
// Enter = CR; "Ctrl C" = 0x03 (SIGINT) — the terminal-useful "cmd+C".
type Key = {
  id: string;
  label?: string;
  icon?: LucideIcon;
  data: string;
  aria: string;
  confirm?: boolean;
};

// Full catalog with stable ids.
const ACTION_KEYS: Key[] = [
  { id: "esc", label: "Esc", data: "\x1b", aria: "Escape" },
  { id: "tab", label: "Tab", data: "\t", aria: "Tab" },
  { id: "enter", icon: CornerDownLeft, data: "\r", aria: "Enter" },
  // Ctrl-C interrupts the running process — confirm before sending (easy to mis-tap on a phone).
  { id: "ctrlc", label: "Ctrl C", data: "\x03", aria: "Ctrl C (interrupt)", confirm: true },
];

const ARROW_KEYS: Key[] = [
  { id: "left", icon: ArrowLeft, data: "\x1b[D", aria: "Arrow left" },
  { id: "up", icon: ArrowUp, data: "\x1b[A", aria: "Arrow up" },
  { id: "down", icon: ArrowDown, data: "\x1b[B", aria: "Arrow down" },
  { id: "right", icon: ArrowRight, data: "\x1b[C", aria: "Arrow right" },
];

export function TerminalPane({ projectId, n }: { projectId: string; n?: number }) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => setEl(ref.current), []);

  const { send, status, fontSize, setFont, findNext, findPrevious, clearSearch } = useTerminal(
    projectId,
    n,
    el,
  );

  const { settings } = useSettings();

  const [showKeys, setShowKeys] = useState(false);
  const [confirmKey, setConfirmKey] = useState<Key | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const pressKey = (k: Key) => {
    haptic(settings.haptics);
    if (k.confirm) setConfirmKey(k);
    else send(k.data);
  };

  // Focus the search input when the bar appears.
  useEffect(() => {
    if (showSearch) {
      searchInputRef.current?.focus();
    }
  }, [showSearch]);

  const handleSearchClose = useCallback(() => {
    clearSearch();
    setShowSearch(false);
    setSearchQuery("");
  }, [clearSearch]);

  const handleFindNext = useCallback(() => {
    if (searchQuery) findNext(searchQuery);
  }, [findNext, searchQuery]);

  const handleFindPrevious = useCallback(() => {
    if (searchQuery) findPrevious(searchQuery);
  }, [findPrevious, searchQuery]);

  // Status dot appearance
  const dotColor = status === "open" ? "bg-green-500" : "bg-amber-500";
  const statusLabel =
    status === "open" ? "Connected" : status === "connecting" ? "Connecting…" : "Disconnected";

  return (
    <div className="h-full w-full flex flex-col relative bg-bg">
      {/* Connection status dot — top-right */}
      <span
        className={["absolute top-2 right-2 z-20 rounded-full", dotColor].join(" ")}
        style={{ width: 8, height: 8 }}
        title={statusLabel}
        aria-label={statusLabel}
        role="status"
      />

      {/* In-terminal search bar — slides in below the dot row */}
      {showSearch && (
        <div className="absolute top-0 left-0 right-0 z-30 flex items-center gap-1 px-2 py-1 bg-panel border-b border-border">
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (e.shiftKey) handleFindPrevious();
                else handleFindNext();
              }
              if (e.key === "Escape") handleSearchClose();
            }}
            placeholder="Find in terminal…"
            aria-label="Search terminal"
            className="flex-1 min-w-0 h-9 bg-bg border border-border rounded px-2 text-[13px] text-text placeholder:text-muted focus:outline-none focus:border-accent"
          />
          <button
            onClick={handleFindPrevious}
            aria-label="Previous match"
            title="Previous match (Shift+Enter)"
            className="h-9 w-9 flex items-center justify-center rounded text-muted hover:bg-white/10 active:bg-white/20 transition-colors"
          >
            <ChevronUp size={16} />
          </button>
          <button
            onClick={handleFindNext}
            aria-label="Next match"
            title="Next match (Enter)"
            className="h-9 w-9 flex items-center justify-center rounded text-muted hover:bg-white/10 active:bg-white/20 transition-colors"
          >
            <ChevronDown size={16} />
          </button>
          <button
            onClick={handleSearchClose}
            aria-label="Close search"
            className="h-9 w-9 flex items-center justify-center rounded text-muted hover:bg-white/10 active:bg-white/20 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div ref={ref} className="flex-1 min-h-0 w-full" />

      {/* Control cluster — bottom-right above key bar */}
      <div
        className="absolute right-2 z-10 flex flex-col items-end gap-1"
        style={{ bottom: showKeys ? "100px" : "8px" }}
      >
        {/* Font-size controls */}
        <div className="flex items-center gap-0.5 rounded-full bg-panel border border-border">
          <button
            onClick={() => setFont(-1)}
            aria-label="Decrease font size"
            title="Decrease font size"
            className="h-8 w-8 flex items-center justify-center rounded-full text-muted hover:bg-white/10 active:bg-white/20 transition-colors text-[11px] font-medium"
          >
            A-
          </button>
          <span
            className="text-muted text-[11px] select-none px-0.5 tabular-nums"
            aria-label={`Font size ${fontSize}`}
          >
            {fontSize}
          </span>
          <button
            onClick={() => setFont(+1)}
            aria-label="Increase font size"
            title="Increase font size"
            className="h-8 w-8 flex items-center justify-center rounded-full text-muted hover:bg-white/10 active:bg-white/20 transition-colors text-[13px] font-medium"
          >
            A+
          </button>
        </div>

        {/* Search toggle + keyboard toggle */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSearch((v) => !v)}
            aria-label={showSearch ? "Hide search" : "Search in terminal"}
            aria-pressed={showSearch}
            className={[
              "flex items-center justify-center rounded-full transition-colors hover:bg-white/10 active:bg-white/20",
              "w-10 h-10 bg-panel border border-border",
              showSearch ? "text-accent" : "text-muted",
            ].join(" ")}
          >
            <Search size={16} />
          </button>

          <button
            onClick={() => setShowKeys((v) => !v)}
            aria-label={showKeys ? "Hide on-screen keys" : "Show on-screen keys"}
            aria-pressed={showKeys}
            className={[
              "flex items-center justify-center rounded-full transition-colors hover:bg-white/10 active:bg-white/20",
              "w-10 h-10 bg-panel border border-border",
              showKeys ? "text-accent" : "text-muted",
            ].join(" ")}
          >
            <Keyboard size={18} />
          </button>
        </div>
      </div>

      {/* On-screen key bar — actions on top, arrows on the bottom */}
      {showKeys && (
        <div className="shrink-0 w-full border-t border-border bg-panel pb-[env(safe-area-inset-bottom)]">
          {[ACTION_KEYS, ARROW_KEYS].map((rowKeys, r) => {
            const visible = rowKeys.filter((k) => settings.keys.includes(k.id));
            if (visible.length === 0) return null;
            return (
              <div key={r} className="flex items-stretch gap-1 px-1">
                {visible.map((k) => {
                  const Icon = k.icon;
                  return (
                    <button
                      key={k.id}
                      onClick={() => pressKey(k)}
                      aria-label={k.aria}
                      className="flex-1 flex items-center justify-center rounded transition-colors hover:bg-white/5 active:bg-white/10 min-w-0 h-11 text-text text-[13px]"
                    >
                      {Icon ? <Icon size={18} /> : k.label}
                    </button>
                  );
                })}
              </div>
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
          <div className="relative w-full max-w-sm rounded-lg border border-border bg-panel p-5">
            <p className="text-text text-sm">
              Send{" "}
              <span className="text-accent font-medium">{confirmKey.label ?? confirmKey.aria}</span>
              ? This interrupts the running process.
            </p>
            <div className="mt-5 flex gap-6">
              <button
                onClick={() => setConfirmKey(null)}
                className="flex-1 h-14 rounded-md text-[15px] border border-border text-text transition-colors hover:bg-white/5 active:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  send(confirmKey.data);
                  setConfirmKey(null);
                }}
                className="flex-1 h-14 rounded-md text-[15px] font-medium bg-accent text-bg transition-opacity hover:opacity-90 active:opacity-80"
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
