import { useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { TerminalPane } from "./TerminalPane";

// Multiple terminals within one project. Each tab is a distinct tmux session
// (n=0 → the project's main session, n>0 → wt_<project>_<n>). All panes stay
// mounted (only the active one is visible) so switching tabs is instant and a
// background terminal keeps streaming. Closing a tab just detaches — tmux keeps
// the session alive server-side.
export function ProjectTerminals({ projectId }: { projectId: string }) {
  const [tabs, setTabs] = useState<number[]>([0]);
  const [active, setActive] = useState(0);
  const nextN = useRef(1);

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
      const next = t.filter((_, i) => i !== idx);
      setActive((a) => {
        if (idx < a) return a - 1;
        if (idx === a) return Math.min(a, next.length - 1);
        return a;
      });
      return next;
    });
  };

  return (
    <div className="h-full w-full flex flex-col bg-bg">
      {/* Tab bar */}
      <div className="shrink-0 flex items-stretch gap-px min-h-9 border-b border-border bg-panel overflow-x-auto">
        {tabs.map((n, i) => (
          <div
            key={n}
            onClick={() => setActive(i)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && setActive(i)}
            className={[
              "flex items-center gap-1 pl-3 pr-1 min-h-9 text-[13px] cursor-pointer select-none transition-colors shrink-0",
              i === active ? "text-accent bg-bg" : "text-muted hover:bg-white/5",
            ].join(" ")}
          >
            <span>Term {i + 1}</span>
            {tabs.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(i);
                }}
                aria-label={`Close terminal ${i + 1}`}
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
      <div className="flex-1 min-h-0 relative">
        {tabs.map((n, i) => (
          <div key={n} className={i === active ? "absolute inset-0" : "hidden"}>
            <TerminalPane projectId={projectId} n={n === 0 ? undefined : n} />
          </div>
        ))}
      </div>
    </div>
  );
}
