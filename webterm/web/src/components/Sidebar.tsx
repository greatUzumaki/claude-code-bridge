import { useState, type DragEvent } from "react";
import { createPortal } from "react-dom";
import {
  Plus,
  FolderPlus,
  SquareTerminal,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  LayoutGrid,
  MoreVertical,
  Settings2,
  Trash2,
  Check,
  X,
  Star,
  GitBranch,
  MonitorPlay,
} from "lucide-react";
import { buildTree, type Project } from "../lib/grouping";
import { haptic } from "../lib/haptics";
import { SessionsModal } from "./SessionsModal";
import { DeleteProjectModal } from "./DeleteProjectModal";
import {
  useProjects,
  useGitStatus,
  useCreateProject,
  useCloneProject,
  useCreateGroup,
  useMoveProject,
  useRenameGroup,
  useDeleteGroup,
} from "../lib/queries";

type Dialog = null | { kind: "project" } | { kind: "group" };

type GitInfo = { isRepo: boolean; branch?: string; dirty?: boolean };

// ── localStorage helpers ───────────────────────────────────────────────────
const PINS_KEY = "webterm_pins";

function loadPins(): string[] {
  try {
    return JSON.parse(localStorage.getItem(PINS_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function savePins(ids: string[]) {
  try {
    localStorage.setItem(PINS_KEY, JSON.stringify(ids));
  } catch {
    /* quota exceeded or private mode — pins won't persist, but rendering is unaffected */
  }
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
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [dialog, setDialog] = useState<Dialog>(null);
  const [name, setName] = useState("");
  const [cloneUrl, setCloneUrl] = useState("");
  const [settingsGroup, setSettingsGroup] = useState<string | null>(null);
  const [settingsName, setSettingsName] = useState("");
  const [showSessions, setShowSessions] = useState(false);
  const [deleteProj, setDeleteProj] = useState<Project | null>(null);
  // Per-project actions menu: the project + the screen position to anchor to.
  const [rowMenu, setRowMenu] = useState<{ p: Project; x: number; y: number } | null>(null);
  // Header "more" menu: anchor position captured at click time (avoids reading a
  // ref during render).
  const [moreMenu, setMoreMenu] = useState<{ x: number; y: number } | null>(null);
  // Desktop drag-and-drop: which project is being dragged, which group is hovered.
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null); // "" = ungrouped

  // ── Feature state ──────────────────────────────────────────────────────────
  const [pins, setPins] = useState<string[]>(loadPins);

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: projectsData } = useProjects();
  const layout = projectsData ?? { groups: [], projects: [] };

  const { data: gitData } = useGitStatus();
  const gitStatuses: Record<string, GitInfo> = gitData?.statuses ?? {};

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createProject = useCreateProject();
  const cloneProject = useCloneProject();
  const createGroup = useCreateGroup();
  const moveProject = useMoveProject();
  const renameGroup = useRenameGroup();
  const deleteGroup = useDeleteGroup();

  const tree = buildTree(layout);

  // ── Create dialog ─────────────────────────────────────────────────────────
  const openCreateDialog = (kind: "project" | "group") => {
    setName("");
    setCloneUrl("");
    setDialog({ kind });
  };
  const submitDialog = async () => {
    if (!dialog) return;
    const n = name.trim();
    if (dialog.kind === "group") {
      if (!n) return;
      await createGroup.mutateAsync(n);
    } else {
      const url = cloneUrl.trim();
      if (url) await cloneProject.mutateAsync({ url, name: n || undefined });
      else if (n) await createProject.mutateAsync({ name: n });
      else return;
    }
    setDialog(null);
    setName("");
    setCloneUrl("");
  };

  const toggleGroup = (id: string) => setCollapsed((p) => ({ ...p, [id]: !p[id] }));

  const toggleCollapseAll = () => {
    const allCollapsed = tree.groups.every((g) => collapsed[g.id]);
    if (allCollapsed) {
      setCollapsed({});
    } else {
      const next: Record<string, boolean> = {};
      for (const g of tree.groups) next[g.id] = true;
      setCollapsed(next);
    }
  };

  // ── Move (used by drag + group-settings toggles) ──────────────────────────
  const moveTo = async (projectId: string, groupId: string) => {
    await moveProject.mutateAsync({ projectId, groupId, order: 0 });
  };

  // ── Group settings ────────────────────────────────────────────────────────
  const openSettings = (id: string, current: string) => {
    setSettingsName(current);
    setSettingsGroup(id);
  };
  const saveGroupName = async () => {
    const n = settingsName.trim();
    if (settingsGroup && n) {
      await renameGroup.mutateAsync({ groupId: settingsGroup, name: n });
    }
  };
  const deleteSettingsGroup = async () => {
    if (!settingsGroup) return;
    if (!window.confirm("Delete this group? Its projects become ungrouped.")) return;
    await deleteGroup.mutateAsync(settingsGroup);
    setSettingsGroup(null);
  };

  // ── Drag handlers ─────────────────────────────────────────────────────────
  const onZoneOver = (gid: string) => (e: DragEvent) => {
    if (!dragId) return;
    e.preventDefault();
    setDropTarget(gid);
  };
  const onZoneDrop = (gid: string) => (e: DragEvent) => {
    e.preventDefault();
    if (dragId) void moveTo(dragId, gid);
    setDragId(null);
    setDropTarget(null);
  };

  // ── Pin toggle (#42) ──────────────────────────────────────────────────────
  const togglePin = (id: string) => {
    setPins((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev];
      savePins(next);
      return next;
    });
  };

  // ── Project row ───────────────────────────────────────────────────────────
  const row = (p: Project) => {
    const isActive = p.id === activeId;
    const gitInfo = gitStatuses[p.id];

    return (
      <div
        key={p.id}
        draggable
        onDragStart={(e) => {
          setDragId(p.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragEnd={() => {
          setDragId(null);
          setDropTarget(null);
        }}
        onClick={() => {
          haptic();
          onSelect(p);
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onSelect(p)}
        className={[
          "flex items-center gap-2 px-3 cursor-pointer select-none rounded-sm transition-colors hover:bg-white/5 active:bg-white/10 min-h-11",
          isActive ? "text-accent" : "text-text",
          dragId === p.id ? "opacity-40" : "",
        ].join(" ")}
      >
        <SquareTerminal size={16} className="shrink-0 text-muted" />

        {/* Active-session dot (#20) — green when live tmux session */}
        {p.active && (
          <span
            className="shrink-0 rounded-full bg-green-500"
            aria-label="live session"
            style={{ width: "6px", height: "6px" }}
          />
        )}

        {/* Selected accent dot (original behaviour) */}
        {isActive && (
          <span
            className="shrink-0 rounded-full bg-accent"
            aria-label="active session"
            style={{ width: "6px", height: "6px" }}
          />
        )}

        <span className="flex-1 truncate text-[15px]">{p.name}</span>

        {/* Git branch info (#36) */}
        {gitInfo?.isRepo && gitInfo.branch && (
          <span className="flex items-center gap-0.5 text-muted shrink-0 max-w-[80px] min-w-0">
            <GitBranch size={11} className="shrink-0" />
            <span className="truncate text-[11px]">{gitInfo.branch}</span>
            {gitInfo.dirty && (
              <span className="text-accent text-[11px] shrink-0" aria-label="dirty">
                ✱
              </span>
            )}
          </span>
        )}

        {/* Single actions menu — pin / view files / delete */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            const r = e.currentTarget.getBoundingClientRect();
            setRowMenu({ p, x: r.right, y: r.bottom });
          }}
          aria-label={`Actions for ${p.name}`}
          aria-haspopup="menu"
          className="flex items-center justify-center shrink-0 rounded transition-colors hover:bg-white/10 active:bg-white/15 w-9 h-9 text-muted"
        >
          <MoreVertical size={16} />
        </button>
      </div>
    );
  };

  const settings = settingsGroup ? layout.groups.find((g) => g.id === settingsGroup) : undefined;

  // ── Derived lists for Pinned / Recent (#42) ────────────────────────────────
  const allProjects = layout.projects ?? [];
  const pinnedProjects = pins
    .map((id) => allProjects.find((p) => p.id === id))
    .filter((p): p is Project => p !== undefined);

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
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setMoreMenu((m) => (m ? null : { x: r.right, y: r.bottom }));
            }}
            aria-label="More actions"
            aria-haspopup="menu"
            aria-expanded={!!moreMenu}
            className="flex items-center justify-center rounded transition-colors hover:bg-white/5 active:bg-white/10 w-9 h-9 text-muted"
          >
            <MoreVertical size={18} />
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

      {/* More menu (secondary header actions) */}
      {moreMenu &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setMoreMenu(null)}
              aria-hidden="true"
            />
            <div
              role="menu"
              className="fixed z-50 min-w-[180px] rounded-md border border-border bg-panel shadow-lg overflow-hidden"
              style={{ top: moreMenu.y + 4, right: Math.max(8, window.innerWidth - moreMenu.x) }}
            >
              <button
                role="menuitem"
                onClick={() => {
                  setMoreMenu(null);
                  openCreateDialog("group");
                }}
                className="w-full flex items-center gap-3 px-4 h-11 text-[14px] text-text hover:bg-white/5 active:bg-white/10 text-left"
              >
                <FolderPlus size={16} className="text-muted shrink-0" /> New group
              </button>
              {tree.groups.length > 0 && (
                <button
                  role="menuitem"
                  onClick={() => {
                    setMoreMenu(null);
                    toggleCollapseAll();
                  }}
                  className="w-full flex items-center gap-3 px-4 h-11 text-[14px] text-text hover:bg-white/5 active:bg-white/10 text-left"
                >
                  <ChevronsDownUp size={16} className="text-muted shrink-0" />{" "}
                  {tree.groups.every((g) => collapsed[g.id]) ? "Expand all" : "Collapse all"}
                </button>
              )}
              {/* Sessions menu item (#19) */}
              <button
                role="menuitem"
                onClick={() => {
                  setMoreMenu(null);
                  setShowSessions(true);
                }}
                className="w-full flex items-center gap-3 px-4 h-11 text-[14px] text-text hover:bg-white/5 active:bg-white/10 text-left"
              >
                <MonitorPlay size={16} className="text-muted shrink-0" /> Sessions
              </button>
            </div>
          </>,
          document.body,
        )}

      {/* Project list */}
      <div className="flex-1 overflow-y-auto px-1 py-1">
        {/* Pinned section (#42) */}
        {pinnedProjects.length > 0 && (
          <div className="mb-1">
            <div className="px-3 pt-1 pb-0.5 text-[10px] uppercase tracking-wider text-muted font-semibold">
              Pinned
            </div>
            {pinnedProjects.map(row)}
          </div>
        )}

        {/* Ungrouped (drop target) */}
        <div
          onDragOver={onZoneOver("")}
          onDragLeave={() => setDropTarget((t) => (t === "" ? null : t))}
          onDrop={onZoneDrop("")}
          className={[
            "rounded-sm",
            dropTarget === "" ? "outline outline-1 outline-accent bg-accent/5" : "",
          ].join(" ")}
        >
          {dragId && <div className="px-3 py-1 text-[11px] text-muted">Drop here → ungrouped</div>}
          {tree.ungrouped.filter((p) => !pins.includes(p.id)).map(row)}
        </div>

        {tree.groups.map((g) => {
          const isCollapsed = !!collapsed[g.id];
          const isDrop = dropTarget === g.id;
          return (
            <div
              key={g.id}
              onDragOver={onZoneOver(g.id)}
              onDragLeave={() => setDropTarget((t) => (t === g.id ? null : t))}
              onDrop={onZoneDrop(g.id)}
              className={[
                "rounded-sm",
                isDrop ? "outline outline-1 outline-accent bg-accent/5" : "",
              ].join(" ")}
            >
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
                    openSettings(g.id, g.name);
                  }}
                  aria-label={`Settings for group ${g.name}`}
                  className="flex items-center justify-center shrink-0 rounded transition-colors hover:bg-white/10 active:bg-white/15 w-9 h-9 text-muted"
                >
                  <Settings2 size={16} />
                </button>
              </div>
              {!isCollapsed && (
                <div className="pl-2">
                  {g.projects.filter((p) => !pins.includes(p.id)).map(row)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Group settings modal (rename + add/remove projects + delete) ── */}
      {settings &&
        createPortal(
          <div
            className="fixed inset-0 z-40 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Group settings"
          >
            <div
              className="absolute inset-0 bg-black/55"
              onClick={() => setSettingsGroup(null)}
              aria-hidden="true"
            />
            <div className="relative w-full max-w-sm max-h-[85vh] flex flex-col rounded-lg border border-border bg-panel p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-text text-sm font-medium">Group settings</h2>
                <button
                  onClick={() => setSettingsGroup(null)}
                  aria-label="Close"
                  className="flex items-center justify-center rounded w-9 h-9 text-muted hover:bg-white/5 active:bg-white/10"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Rename */}
              <div className="flex gap-2">
                <input
                  value={settingsName}
                  onChange={(e) => setSettingsName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void saveGroupName()}
                  aria-label="Group name"
                  className="flex-1 min-w-0 h-11 rounded-md bg-bg border border-border px-3 text-text text-[15px] outline-none focus:border-accent"
                />
                <button
                  onClick={saveGroupName}
                  disabled={!settingsName.trim() || settingsName.trim() === settings.name}
                  className="shrink-0 px-4 h-11 rounded-md text-[14px] font-medium bg-accent text-bg transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-40 disabled:pointer-events-none"
                >
                  Save
                </button>
              </div>

              {/* Members */}
              <div className="mt-4 text-xs uppercase tracking-wider text-muted">
                Projects in group
              </div>
              <div className="mt-1 flex-1 overflow-y-auto -mx-1">
                {layout.projects.map((p) => {
                  const member = p.groupId === settings.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => moveTo(p.id, member ? "" : settings.id)}
                      className="w-full flex items-center gap-3 px-3 min-h-11 rounded-sm text-left transition-colors hover:bg-white/5 active:bg-white/10"
                    >
                      <span
                        className={[
                          "shrink-0 flex items-center justify-center w-5 h-5 rounded border",
                          member
                            ? "bg-accent border-accent text-bg"
                            : "border-border text-transparent",
                        ].join(" ")}
                      >
                        <Check size={14} />
                      </span>
                      <span className="flex-1 truncate text-[15px] text-text">{p.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* Delete */}
              <button
                onClick={deleteSettingsGroup}
                className="mt-4 shrink-0 flex items-center justify-center gap-2 h-11 rounded-md text-[14px] text-red-400 border border-border transition-colors hover:bg-red-500/10 active:bg-red-500/15"
              >
                <Trash2 size={16} /> Delete group
              </button>
            </div>
          </div>,
          document.body,
        )}

      {/* ── Session manager modal (#19) ── */}
      {showSessions && <SessionsModal onClose={() => setShowSessions(false)} />}

      {/* ── Delete project modal (type-name confirm) ── */}
      {deleteProj && (
        <DeleteProjectModal project={deleteProj} onClose={() => setDeleteProj(null)} />
      )}

      {/* ── Per-project actions menu (pin / view files / delete) ── */}
      {rowMenu &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setRowMenu(null)}
              aria-hidden="true"
            />
            <div
              role="menu"
              className="fixed z-50 min-w-[170px] rounded-md border border-border bg-panel shadow-lg overflow-hidden"
              style={{ top: rowMenu.y + 4, right: Math.max(8, window.innerWidth - rowMenu.x) }}
            >
              <button
                role="menuitem"
                onClick={() => {
                  togglePin(rowMenu.p.id);
                  setRowMenu(null);
                }}
                className="w-full flex items-center gap-3 px-4 h-11 text-[14px] text-text hover:bg-white/5 active:bg-white/10 text-left"
              >
                <Star
                  size={15}
                  className="text-muted shrink-0"
                  fill={pins.includes(rowMenu.p.id) ? "currentColor" : "none"}
                />
                {pins.includes(rowMenu.p.id) ? "Unpin" : "Pin"}
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  onViewFiles(rowMenu.p);
                  setRowMenu(null);
                }}
                className="w-full flex items-center gap-3 px-4 h-11 text-[14px] text-text hover:bg-white/5 active:bg-white/10 text-left"
              >
                <FolderOpen size={15} className="text-muted shrink-0" /> View files
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setDeleteProj(rowMenu.p);
                  setRowMenu(null);
                }}
                className="w-full flex items-center gap-3 px-4 h-11 text-[14px] text-red-400 hover:bg-red-500/10 active:bg-red-500/15 text-left"
              >
                <Trash2 size={15} className="shrink-0" /> Delete
              </button>
            </div>
          </>,
          document.body,
        )}

      {/* ── Create project / group modal ── */}
      {dialog &&
        createPortal(
          <div
            className="fixed inset-0 z-40 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-label={dialog.kind === "project" ? "New project" : "New group"}
          >
            <div
              className="absolute inset-0 bg-black/55"
              onClick={() => setDialog(null)}
              aria-hidden="true"
            />
            <div className="relative w-full max-w-sm rounded-lg border border-border bg-panel p-5">
              <h2 className="text-text text-sm font-medium mb-3">
                {dialog.kind === "project" ? "New project" : "New group"}
              </h2>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitDialog();
                  if (e.key === "Escape") setDialog(null);
                }}
                placeholder={
                  dialog.kind === "project" ? "project-name (or empty if cloning)" : "Group name"
                }
                className="w-full h-12 rounded-md bg-bg border border-border px-3 text-text text-[15px] outline-none focus:border-accent"
              />
              {dialog.kind === "project" && (
                <input
                  value={cloneUrl}
                  onChange={(e) => setCloneUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitDialog();
                    if (e.key === "Escape") setDialog(null);
                  }}
                  placeholder="git clone URL (optional)"
                  className="mt-2 w-full h-12 rounded-md bg-bg border border-border px-3 text-text text-[15px] outline-none focus:border-accent"
                />
              )}
              <div className="mt-5 flex gap-4">
                <button
                  onClick={() => setDialog(null)}
                  className="flex-1 h-12 rounded-md text-[15px] border border-border text-text transition-colors hover:bg-white/5 active:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  onClick={submitDialog}
                  disabled={
                    dialog.kind === "group" ? !name.trim() : !name.trim() && !cloneUrl.trim()
                  }
                  className="flex-1 h-12 rounded-md text-[15px] font-medium bg-accent text-bg transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-40 disabled:pointer-events-none"
                >
                  {dialog.kind === "project" && cloneUrl.trim() ? "Clone" : "Create"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
