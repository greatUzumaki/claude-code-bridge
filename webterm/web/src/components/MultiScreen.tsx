import { useEffect, useState } from "react";
import { X, LayoutGrid } from "lucide-react";
import { api } from "../lib/api";
import { buildTree, type Project } from "../lib/grouping";
import { TerminalPane } from "./TerminalPane";

// Grid count → number of columns (rows are derived). Chosen so there are no
// empty cells: 2→2×1, 3→3×1, 4→2×2, 6→3×2, 9→3×3.
const COLS: Record<number, number> = { 1: 1, 2: 2, 3: 3, 4: 2, 6: 3, 9: 3 };
const SIZES = [2, 3, 4, 6, 9];

export function MultiScreen({ onExit }: { onExit: () => void }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [count, setCount] = useState(4);
  const [cells, setCells] = useState<(string | null)[]>(() => Array(4).fill(null));
  const [activeCell, setActiveCell] = useState(0);

  useEffect(() => {
    api.listProjects().then((lay) => {
      const tree = buildTree(lay);
      setProjects([...tree.ungrouped, ...tree.groups.flatMap((g) => g.projects)]);
    });
  }, []);

  // Change grid size, preserving existing cell assignments.
  const setGrid = (n: number) => {
    setCount(n);
    setCells((prev) => {
      const next: (string | null)[] = Array(n).fill(null);
      for (let i = 0; i < Math.min(n, prev.length); i++) next[i] = prev[i];
      return next;
    });
    setActiveCell((a) => (a < n ? a : 0));
  };

  const assign = (i: number, projectId: string) => {
    setCells((prev) => {
      const next = [...prev];
      next[i] = projectId || null;
      return next;
    });
  };

  const cols = COLS[count] ?? Math.ceil(Math.sqrt(count));

  return (
    <div className="h-full w-full flex flex-col bg-bg">
      {/* Toolbar: grid-size picker + exit */}
      <div className="shrink-0 flex items-center gap-2 px-2 min-h-11 border-b border-border bg-panel">
        <LayoutGrid size={16} className="shrink-0 text-muted" />
        <div className="flex items-center gap-1">
          {SIZES.map((n) => (
            <button
              key={n}
              onClick={() => setGrid(n)}
              aria-label={`${n} terminals`}
              aria-pressed={count === n}
              className={[
                "rounded h-9 min-w-9 px-2 text-[13px] transition-colors hover:bg-white/5 active:bg-white/10",
                count === n ? "text-accent bg-white/5" : "text-muted",
              ].join(" ")}
            >
              {n}
            </button>
          ))}
        </div>
        <span className="flex-1" />
        <button
          onClick={onExit}
          aria-label="Exit multiscreen"
          className="flex items-center justify-center rounded h-9 w-9 text-muted transition-colors hover:bg-white/5 active:bg-white/10"
        >
          <X size={18} />
        </button>
      </div>

      {/* Grid of terminal cells (1px gaps via the border background) */}
      <div
        className="flex-1 min-h-0 grid gap-px bg-border"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {cells.map((pid, i) => {
          const isActive = i === activeCell;
          return (
            <div
              key={i}
              onMouseDownCapture={() => setActiveCell(i)}
              className={[
                "relative min-w-0 min-h-0 flex flex-col bg-bg overflow-hidden",
                isActive ? "outline outline-2 -outline-offset-2 outline-accent" : "",
              ].join(" ")}
            >
              {/* Cell header: pick which project occupies this cell */}
              <div className="shrink-0 flex items-center px-1 min-h-9 border-b border-border bg-panel">
                <select
                  value={pid ?? ""}
                  onChange={(e) => assign(i, e.target.value)}
                  aria-label={`Project for cell ${i + 1}`}
                  className="flex-1 min-w-0 h-8 rounded px-1 bg-panel text-text text-[13px] outline-none"
                >
                  <option value="">— select project —</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Cell body: the project's terminal (its main tmux session) */}
              <div className="flex-1 min-h-0">
                {pid ? (
                  <TerminalPane key={pid} projectId={pid} />
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-muted">
                    pick a project
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
