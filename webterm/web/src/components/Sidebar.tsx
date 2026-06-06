import { useEffect, useState } from "react";
import {
  Plus,
  FolderPlus,
  SquareTerminal,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  X,
} from "lucide-react";
import { api } from "../lib/api";
import { buildTree, type Layout, type Project } from "../lib/grouping";

export function Sidebar({
  activeId,
  onSelect,
  onViewFiles,
  onClose,
  multi,
  onToggleMulti,
}: {
  activeId: string;
  onSelect: (p: Project) => void;
  onViewFiles: (p: Project) => void;
  onClose?: () => void;
  multi?: boolean;
  onToggleMulti?: () => void;
}) {
  const [layout, setLayout] = useState<Layout>({ groups: [], projects: [] });
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [dialog, setDialog] = useState<null | "project" | "group">(null);
  const [name, setName] = useState("");

  const refresh = () => api.listProjects().then(setLayout);
  useEffect(() => {
    refresh();
  }, []);

  const tree = buildTree(layout);

  const openDialog = (kind: "project" | "group") => {
    setName("");
    setDialog(kind);
  };

  const submitDialog = async () => {
    const n = name.trim();
    if (!n || !dialog) return;
    if (dialog === "project") await api.createProject(n);
    else await api.createGroup(n);
    setDialog(null);
    setName("");
    refresh();
  };

  const toggleGroup = (id: string) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const row = (p: Project) => {
    const isActive = p.id === activeId;
    return (
      <div
        key={p.id}
        onClick={() => onSelect(p)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onSelect(p)}
        className={[
          "flex items-center gap-2 px-3 cursor-pointer select-none rounded-sm transition-colors hover:bg-white/5 active:bg-white/10 min-h-11",
          isActive ? "text-accent" : "text-text",
        ].join(" ")}
      >
        <SquareTerminal size={16} className="shrink-0 text-muted" />

        {isActive && (
          <span
            className="shrink-0 rounded-full bg-accent"
            aria-label="active session"
            style={{ width: "6px", height: "6px" }}
          />
        )}

        <span className="flex-1 truncate text-[15px]">{p.name}</span>

        {isActive && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewFiles(p);
            }}
            aria-label="View project files"
            className="flex items-center justify-center shrink-0 rounded transition-colors hover:bg-white/10 active:bg-white/15 w-9 h-9 text-muted"
          >
            <FolderOpen size={16} />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-panel border-r border-border w-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 shrink-0 min-h-11 border-b border-border">
        <span className="text-xs font-semibold tracking-widest uppercase text-muted">Projects</span>
        <span className="flex items-center gap-1">
          {onToggleMulti && (
            <button
              onClick={onToggleMulti}
              aria-label="Multiscreen mode"
              aria-pressed={multi}
              className={[
                "flex items-center justify-center rounded transition-colors hover:bg-white/5 active:bg-white/10 w-9 h-9",
                multi ? "text-accent" : "text-muted",
              ].join(" ")}
            >
              <LayoutGrid size={18} />
            </button>
          )}
          <button
            onClick={() => openDialog("project")}
            aria-label="New project"
            className="flex items-center justify-center rounded transition-colors hover:bg-white/5 active:bg-white/10 w-9 h-9 text-muted"
          >
            <Plus size={18} />
          </button>
          <button
            onClick={() => openDialog("group")}
            aria-label="New group"
            className="flex items-center justify-center rounded transition-colors hover:bg-white/5 active:bg-white/10 w-9 h-9 text-muted"
          >
            <FolderPlus size={18} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close navigation"
              className="sm:hidden flex items-center justify-center rounded transition-colors hover:bg-white/5 active:bg-white/10 w-9 h-9 text-muted"
            >
              <X size={18} />
            </button>
          )}
        </span>
      </div>

      {/* Project list */}
      <div className="flex-1 overflow-y-auto px-1 py-1">
        {tree.ungrouped.map(row)}

        {tree.groups.map((g) => {
          const isCollapsed = !!collapsed[g.id];
          return (
            <div key={g.id}>
              <button
                onClick={() => toggleGroup(g.id)}
                className="w-full flex items-center gap-2 px-3 text-left rounded-sm transition-colors hover:bg-white/5 active:bg-white/10 min-h-9 text-muted"
              >
                {isCollapsed ? (
                  <ChevronRight size={14} className="shrink-0" />
                ) : (
                  <ChevronDown size={14} className="shrink-0" />
                )}
                <span className="flex-1 truncate text-xs uppercase tracking-wider font-semibold">
                  {g.name}
                </span>
              </button>
              {!isCollapsed && <div className="pl-2">{g.projects.map(row)}</div>}
            </div>
          );
        })}
      </div>

      {/* Custom create-project / create-group modal */}
      {dialog && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={dialog === "project" ? "New project" : "New group"}
        >
          <div
            className="absolute inset-0 bg-black/55"
            onClick={() => setDialog(null)}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-sm rounded-lg border border-border bg-panel p-5">
            <h2 className="text-text text-sm font-medium mb-3">
              {dialog === "project" ? "New project" : "New group"}
            </h2>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitDialog();
                if (e.key === "Escape") setDialog(null);
              }}
              placeholder={dialog === "project" ? "project-name" : "Group name"}
              className="w-full h-12 rounded-md bg-bg border border-border px-3 text-text text-[15px] outline-none focus:border-accent"
            />
            <div className="mt-5 flex gap-4">
              <button
                onClick={() => setDialog(null)}
                className="flex-1 h-12 rounded-md text-[15px] border border-border text-text transition-colors hover:bg-white/5 active:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={submitDialog}
                disabled={!name.trim()}
                className="flex-1 h-12 rounded-md text-[15px] font-medium bg-accent text-bg transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-40 disabled:pointer-events-none"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
