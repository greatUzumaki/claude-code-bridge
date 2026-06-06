import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Plus,
  FolderPlus,
  SquareTerminal,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  MoreVertical,
  X,
} from "lucide-react";
import { api } from "../lib/api";
import { buildTree, type Layout, type Project } from "../lib/grouping";

type Dialog =
  | null
  | { kind: "project" }
  | { kind: "group" }
  | { kind: "rename-group"; id: string; currentName: string };

type ProjectMenu = { projectId: string; anchorEl: HTMLElement } | null;
type GroupMenu = { groupId: string; anchorEl: HTMLElement } | null;

function menuStyle(anchor: HTMLElement | null): React.CSSProperties {
  if (!anchor) return {};
  const rect = anchor.getBoundingClientRect();
  return {
    position: "fixed",
    top: rect.bottom + 4,
    right: window.innerWidth - rect.right,
    zIndex: 50,
  };
}

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
  const [dialog, setDialog] = useState<Dialog>(null);
  const [name, setName] = useState("");
  const [projectMenu, setProjectMenu] = useState<ProjectMenu>(null);
  const [groupMenu, setGroupMenu] = useState<GroupMenu>(null);
  const projectMenuRef = useRef<HTMLDivElement>(null);
  const groupMenuRef = useRef<HTMLDivElement>(null);

  const refresh = () => api.listProjects().then(setLayout);
  useEffect(() => {
    refresh();
  }, []);

  // Close menus on outside click / Escape
  useEffect(() => {
    if (!projectMenu && !groupMenu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setProjectMenu(null);
        setGroupMenu(null);
      }
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (projectMenuRef.current && !projectMenuRef.current.contains(target)) {
        setProjectMenu(null);
      }
      if (groupMenuRef.current && !groupMenuRef.current.contains(target)) {
        setGroupMenu(null);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [projectMenu, groupMenu]);

  const tree = buildTree(layout);

  // ── Dialog helpers ────────────────────────────────────────────────────────

  const openCreateDialog = (kind: "project" | "group") => {
    setName("");
    setDialog({ kind });
  };

  const openRenameGroupDialog = (id: string, currentName: string) => {
    setName(currentName);
    setDialog({ kind: "rename-group", id, currentName });
  };

  const closeDialog = () => setDialog(null);

  const submitDialog = async () => {
    if (!dialog) return;
    const n = name.trim();
    if (dialog.kind === "project") {
      if (!n) return;
      await api.createProject(n);
    } else if (dialog.kind === "group") {
      if (!n) return;
      await api.createGroup(n);
    } else if (dialog.kind === "rename-group") {
      if (!n) return;
      await api.renameGroup(dialog.id, n);
    }
    setDialog(null);
    setName("");
    refresh();
  };

  const toggleGroup = (id: string) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // ── Move project helper ───────────────────────────────────────────────────

  const moveProject = async (projectId: string, groupId: string) => {
    setProjectMenu(null);
    await api.moveProject(projectId, groupId, 0);
    refresh();
  };

  // ── Delete group helper ───────────────────────────────────────────────────

  const deleteGroup = async (groupId: string) => {
    setGroupMenu(null);
    if (!window.confirm("Delete this group? Projects will become ungrouped.")) return;
    await api.deleteGroup(groupId);
    refresh();
  };

  // ── Project row ───────────────────────────────────────────────────────────

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

        <button
          onClick={(e) => {
            e.stopPropagation();
            setGroupMenu(null);
            setProjectMenu(
              projectMenu?.projectId === p.id
                ? null
                : { projectId: p.id, anchorEl: e.currentTarget },
            );
          }}
          aria-label="Move project"
          className="flex items-center justify-center shrink-0 rounded transition-colors hover:bg-white/10 active:bg-white/15 w-9 h-9 text-muted"
        >
          <MoreVertical size={16} />
        </button>
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────

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
            onClick={() => openCreateDialog("project")}
            aria-label="New project"
            className="flex items-center justify-center rounded transition-colors hover:bg-white/5 active:bg-white/10 w-9 h-9 text-muted"
          >
            <Plus size={18} />
          </button>
          <button
            onClick={() => openCreateDialog("group")}
            aria-label="New group"
            className="flex items-center justify-center rounded transition-colors hover:bg-white/5 active:bg-white/10 w-9 h-9 text-muted"
          >
            <FolderPlus size={18} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close navigation"
              className="wide:hidden flex items-center justify-center rounded transition-colors hover:bg-white/5 active:bg-white/10 w-9 h-9 text-muted"
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
              <div className="flex items-center">
                <button
                  onClick={() => toggleGroup(g.id)}
                  className="flex-1 flex items-center gap-2 px-3 text-left rounded-sm transition-colors hover:bg-white/5 active:bg-white/10 min-h-9 text-muted"
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
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setProjectMenu(null);
                    setGroupMenu(
                      groupMenu?.groupId === g.id
                        ? null
                        : { groupId: g.id, anchorEl: e.currentTarget },
                    );
                  }}
                  aria-label={`More options for ${g.name}`}
                  className="flex items-center justify-center shrink-0 rounded transition-colors hover:bg-white/10 active:bg-white/15 w-9 h-9 text-muted"
                >
                  <MoreVertical size={16} />
                </button>
              </div>
              {!isCollapsed && <div className="pl-2">{g.projects.map(row)}</div>}
            </div>
          );
        })}
      </div>

      {/* ── Project "move to group" dropdown menu ── */}
      {projectMenu &&
        createPortal(
          <div
            ref={projectMenuRef}
            style={menuStyle(projectMenu.anchorEl)}
            className="min-w-[160px] rounded-md border border-border bg-panel shadow-lg overflow-hidden"
            role="menu"
          >
            <button
              role="menuitem"
              onClick={() => moveProject(projectMenu.projectId, "")}
              className="w-full flex items-center px-4 h-11 text-[14px] text-text hover:bg-white/8 active:bg-white/12 transition-colors text-left"
            >
              Ungrouped
            </button>
            {tree.groups.map((g) => (
              <button
                key={g.id}
                role="menuitem"
                onClick={() => moveProject(projectMenu.projectId, g.id)}
                className="w-full flex items-center px-4 h-11 text-[14px] text-text hover:bg-white/8 active:bg-white/12 transition-colors text-left"
              >
                {g.name}
              </button>
            ))}
          </div>,
          document.body,
        )}

      {/* ── Group "rename / delete" dropdown menu ── */}
      {groupMenu &&
        createPortal(
          <div
            ref={groupMenuRef}
            style={menuStyle(groupMenu.anchorEl)}
            className="min-w-[140px] rounded-md border border-border bg-panel shadow-lg overflow-hidden"
            role="menu"
          >
            {(() => {
              const grp = tree.groups.find((g) => g.id === groupMenu.groupId);
              return (
                <>
                  <button
                    role="menuitem"
                    onClick={() => {
                      setGroupMenu(null);
                      openRenameGroupDialog(groupMenu.groupId, grp?.name ?? "");
                    }}
                    className="w-full flex items-center px-4 h-11 text-[14px] text-text hover:bg-white/8 active:bg-white/12 transition-colors text-left"
                  >
                    Rename
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => deleteGroup(groupMenu.groupId)}
                    className="w-full flex items-center px-4 h-11 text-[14px] text-red-400 hover:bg-white/8 active:bg-white/12 transition-colors text-left"
                  >
                    Delete
                  </button>
                </>
              );
            })()}
          </div>,
          document.body,
        )}

      {/* ── Create-project / Create-group / Rename-group modal ── */}
      {dialog &&
        createPortal(
          <div
            className="fixed inset-0 z-40 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-label={
              dialog.kind === "project"
                ? "New project"
                : dialog.kind === "group"
                  ? "New group"
                  : "Rename group"
            }
          >
            <div
              className="absolute inset-0 bg-black/55"
              onClick={closeDialog}
              aria-hidden="true"
            />
            <div className="relative w-full max-w-sm rounded-lg border border-border bg-panel p-5">
              <h2 className="text-text text-sm font-medium mb-3">
                {dialog.kind === "project"
                  ? "New project"
                  : dialog.kind === "group"
                    ? "New group"
                    : "Rename group"}
              </h2>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitDialog();
                  if (e.key === "Escape") closeDialog();
                }}
                placeholder={dialog.kind === "project" ? "project-name" : "Group name"}
                className="w-full h-12 rounded-md bg-bg border border-border px-3 text-text text-[15px] outline-none focus:border-accent"
              />
              <div className="mt-5 flex gap-4">
                <button
                  onClick={closeDialog}
                  className="flex-1 h-12 rounded-md text-[15px] border border-border text-text transition-colors hover:bg-white/5 active:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  onClick={submitDialog}
                  disabled={!name.trim()}
                  className="flex-1 h-12 rounded-md text-[15px] font-medium bg-accent text-bg transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-40 disabled:pointer-events-none"
                >
                  {dialog.kind === "rename-group" ? "Rename" : "Create"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
