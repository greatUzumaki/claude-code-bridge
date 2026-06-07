import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, X } from "lucide-react";
import { TerminalPane } from "./TerminalPane";

// Multiple terminals within one project. Each tab is a distinct tmux session
// (n=0 → the project's main session, n>0 → wt_<project>_<n>). All panes stay
// mounted (only the active one is visible) so switching tabs is instant and a
// background terminal keeps streaming. Closing a tab just detaches — tmux keeps
// the session alive server-side. Tap an already-active tab to rename it.
export function ProjectTerminals({ projectId }: { projectId: string }) {
  const [tabs, setTabs] = useState<number[]>([0]);
  const [active, setActive] = useState(0);
  const [labels, setLabels] = useState<Record<number, string>>({});
  const [editing, setEditing] = useState<number | null>(null);
  const [confirmIdx, setConfirmIdx] = useState<number | null>(null);
  const nextN = useRef(1);

  // Two-finger horizontal swipe over the panes switches tabs (one-finger is left
  // to xterm for normal scrolling).
  const panesRef = useRef<HTMLDivElement>(null);
  const tabsLenRef = useRef(tabs.length);
  tabsLenRef.current = tabs.length;
  useEffect(() => {
    const el = panesRef.current;
    if (!el) return;
    let startX = 0;
    let two = false;
    let fired = false;
    const avg = (t: TouchList) => (t[0].clientX + t[1].clientX) / 2;
    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        startX = avg(e.touches);
        two = true;
        fired = false;
      } else {
        two = false;
      }
    };
    const onMove = (e: TouchEvent) => {
      if (!two || fired || e.touches.length !== 2) return;
      const dx = avg(e.touches) - startX;
      if (Math.abs(dx) > 60) {
        e.preventDefault();
        fired = true;
        setActive((a) => {
          const n = tabsLenRef.current;
          return dx < 0 ? Math.min(a + 1, n - 1) : Math.max(a - 1, 0); // ← next, → prev
        });
      }
    };
    const onEnd = () => {
      two = false;
    };
    const onCancel = () => {
      two = false;
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onCancel);
    };
  }, []);

  const labelFor = (n: number, i: number) => labels[n] ?? `Term ${i + 1}`;

  const addTab = () => {
    const n = nextN.current++;
    setTabs((t) => {
      const next = [...t, n];
      setActive(next.length - 1);
      return next;
    });
  };

  const closeTab = (idx: number) => {
    setTabs((t) => {
      if (t.length <= 1) return t;
      const removed = t[idx];
      const next = t.filter((_, i) => i !== idx);
      setActive((a) => {
        if (idx < a) return a - 1;
        if (idx === a) return Math.min(a, next.length - 1);
        return a;
      });
      setLabels((prev) => {
        if (!(removed in prev)) return prev;
        const rest = { ...prev };
        delete rest[removed];
        return rest;
      });
      return next;
    });
  };

  const commitLabel = (n: number, value: string) => {
    const v = value.trim();
    setLabels((prev) => {
      const next = { ...prev };
      if (v) next[n] = v;
      else delete next[n];
      return next;
    });
    setEditing(null);
  };

  return (
    <div className="h-full w-full flex flex-col bg-bg">
      {/* Tab bar */}
      <div className="shrink-0 flex items-stretch gap-px min-h-9 border-b border-border bg-panel overflow-x-auto">
        {tabs.map((n, i) => (
          <div
            key={n}
            onClick={() => (i === active ? setEditing(n) : setActive(i))}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && setActive(i)}
            className={[
              "flex items-center gap-1 pl-3 pr-1 min-h-9 text-[13px] cursor-pointer select-none transition-colors shrink-0",
              i === active ? "text-accent bg-bg" : "text-muted hover:bg-white/5",
            ].join(" ")}
          >
            {editing === n ? (
              <input
                autoFocus
                defaultValue={labelFor(n, i)}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onBlur={(e) => commitLabel(n, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitLabel(n, (e.target as HTMLInputElement).value);
                  if (e.key === "Escape") setEditing(null);
                }}
                aria-label="Rename terminal"
                className="w-24 h-7 rounded bg-bg border border-accent px-1 text-[13px] text-text outline-none"
              />
            ) : (
              <span className="truncate max-w-[10rem]">{labelFor(n, i)}</span>
            )}
            {tabs.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmIdx(i);
                }}
                aria-label={`Close ${labelFor(n, i)}`}
                className="flex items-center justify-center rounded w-6 h-6 text-muted hover:bg-white/10 active:bg-white/20"
              >
                <X size={13} />
              </button>
            )}
          </div>
        ))}
        <button
          onClick={addTab}
          aria-label="New terminal in this project"
          className="flex items-center justify-center w-9 min-h-9 shrink-0 text-muted hover:bg-white/5 active:bg-white/10"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Panes — all mounted; only the active one is visible */}
      <div ref={panesRef} className="flex-1 min-h-0 relative">
        {tabs.map((n, i) => (
          <div key={n} className={i === active ? "absolute inset-0" : "hidden"}>
            <TerminalPane projectId={projectId} n={n === 0 ? undefined : n} />
          </div>
        ))}
      </div>

      {/* Confirm before closing a terminal tab */}
      {confirmIdx !== null &&
        createPortal(
          (() => {
            const idx = confirmIdx;
            return (
              <div
                className="fixed inset-0 z-40 flex items-center justify-center p-4"
                role="dialog"
                aria-modal="true"
                aria-label="Close terminal"
              >
                <div
                  className="absolute inset-0 bg-black/55"
                  onClick={() => setConfirmIdx(null)}
                  aria-hidden="true"
                />
                <div className="relative w-full max-w-sm rounded-lg border border-border bg-panel p-5">
                  <p className="text-text text-sm">
                    Close{" "}
                    <span className="text-accent font-medium">{labelFor(tabs[idx], idx)}</span>? The
                    tmux session keeps running on the server.
                  </p>
                  <div className="mt-5 flex gap-4">
                    <button
                      onClick={() => setConfirmIdx(null)}
                      className="flex-1 h-12 rounded-md text-[15px] border border-border text-text transition-colors hover:bg-white/5 active:bg-white/10"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        closeTab(idx);
                        setConfirmIdx(null);
                      }}
                      className="flex-1 h-12 rounded-md text-[15px] font-medium bg-accent text-bg transition-opacity hover:opacity-90 active:opacity-80"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            );
          })(),
          document.body,
        )}
    </div>
  );
}
