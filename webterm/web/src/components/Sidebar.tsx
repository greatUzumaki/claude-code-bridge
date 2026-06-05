import { useEffect, useState } from "react";
import {
  Plus,
  FolderPlus,
  SquareTerminal,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  X,
} from "lucide-react";
import { api } from "../lib/api";
import { buildTree, type Layout, type Project } from "../lib/grouping";

export function Sidebar({
  activeId,
  onSelect,
  onViewFiles,
  onClose,
}: {
  activeId: string;
  onSelect: (p: Project) => void;
  onViewFiles: (p: Project) => void;
  onClose?: () => void;
}) {
  const [layout, setLayout] = useState<Layout>({ groups: [], projects: [] });
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const refresh = () => api.listProjects().then(setLayout);
  useEffect(() => {
    refresh();
  }, []);

  const tree = buildTree(layout);

  const newProject = async () => {
    const name = prompt("New project name");
    if (name) {
      await api.createProject(name);
      refresh();
    }
  };

  const newGroup = async () => {
    const name = prompt("New group name");
    if (name) {
      await api.createGroup(name);
      refresh();
    }
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
        className="flex items-center gap-2 px-3 cursor-pointer select-none rounded-sm transition-colors hover:bg-white/5 active:bg-white/10"
        style={{
          minHeight: "44px",
          color: isActive ? "var(--accent)" : "var(--text)",
        }}
      >
        <SquareTerminal size={16} className="shrink-0" style={{ color: "var(--muted)" }} />

        {isActive && (
          <span
            className="shrink-0 rounded-full"
            aria-label="active session"
            style={{
              width: "6px",
              height: "6px",
              background: "var(--accent)",
            }}
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
            className="flex items-center justify-center shrink-0 rounded transition-colors hover:bg-white/10 active:bg-white/15"
            style={{
              width: "36px",
              height: "36px",
              color: "var(--muted)",
            }}
          >
            <FolderOpen size={16} />
          </button>
        )}
      </div>
    );
  };

  return (
    <div
      className="h-full flex flex-col"
      style={{
        background: "var(--panel)",
        borderRight: "1px solid var(--border)",
        width: "100%",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 shrink-0"
        style={{
          minHeight: "44px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <span
          className="text-xs font-semibold tracking-widest uppercase"
          style={{ color: "var(--muted)" }}
        >
          Projects
        </span>
        <span className="flex items-center gap-1">
          <button
            onClick={newProject}
            aria-label="New project"
            className="flex items-center justify-center rounded transition-colors hover:bg-white/5 active:bg-white/10"
            style={{ width: "36px", height: "36px", color: "var(--muted)" }}
          >
            <Plus size={18} />
          </button>
          <button
            onClick={newGroup}
            aria-label="New group"
            className="flex items-center justify-center rounded transition-colors hover:bg-white/5 active:bg-white/10"
            style={{ width: "36px", height: "36px", color: "var(--muted)" }}
          >
            <FolderPlus size={18} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close navigation"
              className="sm:hidden flex items-center justify-center rounded transition-colors hover:bg-white/5 active:bg-white/10"
              style={{ width: "36px", height: "36px", color: "var(--muted)" }}
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
                className="w-full flex items-center gap-2 px-3 text-left rounded-sm transition-colors hover:bg-white/5 active:bg-white/10"
                style={{
                  minHeight: "36px",
                  color: "var(--muted)",
                }}
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
    </div>
  );
}
