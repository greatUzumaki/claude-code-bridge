import { useEffect, useState } from "react";
import { Menu, FolderOpen, LayoutDashboard } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { ProjectTerminals } from "./ProjectTerminals";
import { FileTree } from "./FileTree";
import { EditorPane } from "./EditorPane";
import { MultiScreen } from "./MultiScreen";
import { HeaderStatus } from "./HeaderStatus";
import { ConnectionBanner } from "./ConnectionBanner";
import type { Project } from "../lib/grouping";
import { Link } from "./Link";
import { useWakeLock } from "../hooks/useWakeLock";

export function TerminalApp() {
  useWakeLock();
  // PWA app-shortcuts: /terminal?action=multi | projects — seed state from the URL
  // in the initializer (not via setState in an effect, which cascades renders).
  const [active, setActive] = useState<Project | null>(null);
  const [filesFor, setFilesFor] = useState<Project | null>(null);
  const [openFile, setOpenFile] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(
    () => new URLSearchParams(window.location.search).get("action") === "projects",
  );
  const [multi, setMulti] = useState(
    () => new URLSearchParams(window.location.search).get("action") === "multi",
  );

  // Strip the one-shot action param from the URL after it has seeded state.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("action")) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const toggleMulti = () => {
    setMulti((m) => !m);
    setNavOpen(false);
  };

  const handleSelectProject = (p: Project) => {
    setActive(p);
    setOpenFile(null);
    setNavOpen(false);
  };

  const handleViewFiles = (p: Project) => {
    setFilesFor(p);
    setNavOpen(true); // ensure the file tree (in the sidebar slot) is visible on phone
  };

  const handleCloseFiles = () => {
    setFilesFor(null);
    setOpenFile(null);
  };

  const handleOpenFile = (path: string) => {
    setOpenFile(path);
    setNavOpen(false); // close the drawer on phone so the editor is visible
  };

  const handleCloseEditor = () => {
    setOpenFile(null);
  };

  return (
    <div className="h-dvh flex overflow-hidden bg-bg">
      {/* Backdrop for mobile drawer */}
      {navOpen && (
        <div
          className="wide:hidden fixed inset-0 z-20 bg-black/55"
          onClick={() => setNavOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — full height; slide-over drawer below 1440px, static column ≥1440px */}
      <div
        className={[
          "fixed wide:static top-0 left-0 z-30 h-full wide:z-auto",
          "transition-transform duration-200 ease-out",
          "wide:translate-x-0 wide:flex wide:shrink-0",
          navOpen ? "translate-x-0" : "-translate-x-full",
          "w-72 pt-[env(safe-area-inset-top)]",
        ].join(" ")}
      >
        {filesFor ? (
          <FileTree
            key={filesFor.path}
            root={filesFor.path}
            onOpen={handleOpenFile}
            onClose={handleCloseFiles}
          />
        ) : (
          <Sidebar
            activeId={active?.id ?? ""}
            onSelect={handleSelectProject}
            onViewFiles={handleViewFiles}
            onClose={() => setNavOpen(false)}
            multi={multi}
            onToggleMulti={toggleMulti}
          />
        )}
      </div>

      {/* Right side: header (over the main area only) + content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 shrink-0 min-h-11 border-b border-border bg-panel pt-[env(safe-area-inset-top)]">
          <Link
            to="/"
            aria-label="Back to dashboard"
            className="flex items-center justify-center rounded active:bg-white/10 hover:bg-white/5 w-11 h-11 text-muted"
          >
            <LayoutDashboard size={18} />
          </Link>
          <button
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation menu"
            className="wide:hidden flex items-center justify-center rounded active:bg-white/10 hover:bg-white/5 w-11 h-11 text-text"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-1 min-w-0">
            <span
              className={["truncate text-sm font-medium", active ? "text-text" : "text-muted"].join(
                " ",
              )}
            >
              {active ? active.name : "WebTerm"}
            </span>
            {active && (
              <button
                onClick={() => handleViewFiles(active)}
                aria-label="View project files"
                className="shrink-0 flex items-center justify-center rounded w-9 h-9 text-muted hover:bg-white/5 active:bg-white/10"
              >
                <FolderOpen size={18} />
              </button>
            )}
          </div>
          <span className="flex-1" />
          <HeaderStatus />
        </div>

        <ConnectionBanner />

        {/* Main content: multiscreen grid, or terminal / editor */}
        <div className="flex-1 min-h-0 relative">
          {multi ? (
            <MultiScreen onExit={() => setMulti(false)} />
          ) : openFile ? (
            <EditorPane key={openFile} path={openFile} onClose={handleCloseEditor} />
          ) : active ? (
            <ProjectTerminals key={active.id} projectId={active.id} />
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-muted">
              select a project
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
