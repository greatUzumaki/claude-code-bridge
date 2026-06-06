import { useEffect, useState } from "react";
import { X, LayoutGrid } from "lucide-react";
import { api } from "../lib/api";
import { buildTree, type Project } from "../lib/grouping";
import { TerminalPane } from "./TerminalPane";

const STEPS = [1, 2, 3, 4];

export function MultiScreen({ onExit }: { onExit: () => void }) {
  const [projects, setProjects] = useState<Project[]>([]);
  // Layout is rows × cols — pick each independently (e.g. 1×2 = two columns,
  // 2×1 = two stacked rows). count = cols * rows.
  const [cols, setCols] = useState(2);
  const [rows, setRows] = useState(1);
  const [cells, setCells] = useState<(string | null)[]>(() => Array(2).fill(null));
  const [activeCell, setActiveCell] = useState(0);

  useEffect(() => {
    api.listProjects().then((lay) => {
      const tree = buildTree(lay);
      setProjects([...tree.ungrouped, ...tree.groups.flatMap((g) => g.projects)]);
    });
  }, []);

  // Apply a new layout, preserving existing cell assignments by index.
  const setLayout = (c: number, r: number) => {
    setCols(c);
    setRows(r);
    const n = c * r;
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

  return (
    <div className="h-full w-full flex flex-col bg-bg">
      {/* Toolbar: independent Cols × Rows pickers + exit */}
      <div className="shrink-0 flex items-center gap-6 px-2 min-h-11 border-b border-border bg-panel overflow-x-auto">
        <LayoutGrid size={16} className="shrink-0 text-muted" />
        {(["Cols", "Rows"] as const).map((kind) => {
          const cur = kind === "Cols" ? cols : rows;
          return (
            <div key={kind} className="flex items-center gap-1 shrink-0">
              <span className="text-xs text-muted">{kind}</span>
              {STEPS.map((n) => (
                <button
                  key={n}
                  onClick={() => (kind === "Cols" ? setLayout(n, rows) : setLayout(cols, n))}
                  aria-label={`${kind} ${n}`}
                  aria-pressed={cur === n}
                  className={[
                    "rounded h-9 min-w-9 text-[13px] transition-colors hover:bg-white/5 active:bg-white/10",
                    cur === n ? "text-accent bg-white/5" : "text-muted",
                  ].join(" ")}
                >
                  {n}
                </button>
              ))}
            </div>
          );
        })}
        <span className="flex-1" />
        <button
          onClick={onExit}
          aria-label="Exit multiscreen"
          className="shrink-0 flex items-center justify-center rounded h-9 w-9 text-muted transition-colors hover:bg-white/5 active:bg-white/10"
        >
          <X size={18} />
        </button>
      </div>

      {/* Grid of terminal cells (1px gaps via the border background) */}
      <div
        className="flex-1 min-h-0 grid gap-px bg-border"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        }}
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
