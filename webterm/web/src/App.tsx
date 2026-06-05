import { useState } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "./components/Sidebar";
import { TerminalPane } from "./components/TerminalPane";
import { FileTree } from "./components/FileTree";
import { EditorPane } from "./components/EditorPane";
import type { Project } from "./lib/grouping";

export default function App() {
  const [active, setActive] = useState<Project | null>(null);
  const [filesFor, setFilesFor] = useState<Project | null>(null);
  const [openFile, setOpenFile] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(false);

  const handleSelectProject = (p: Project) => {
    setActive(p);
    setOpenFile(null);
    setNavOpen(false);
  };

  const handleViewFiles = (p: Project) => {
    setFilesFor(p);
  };

  const handleCloseFiles = () => {
    setFilesFor(null);
    setOpenFile(null);
  };

  const handleOpenFile = (path: string) => {
    setOpenFile(path);
  };

  const handleCloseEditor = () => {
    setOpenFile(null);
  };

  return (
    <div className="h-dvh flex flex-col overflow-hidden bg-bg">
      {/* Mobile top app bar */}
      <div className="sm:hidden flex items-center gap-3 px-3 shrink-0 min-h-11 border-b border-border bg-panel">
        <button
          onClick={() => setNavOpen(true)}
          aria-label="Open navigation menu"
          className="flex items-center justify-center rounded active:bg-white/10 hover:bg-white/5 w-11 h-11 text-text"
        >
          <Menu size={20} />
        </button>
        <span
          className={[
            "flex-1 truncate text-sm font-medium",
            active ? "text-text" : "text-muted",
          ].join(" ")}
        >
          {active ? active.name : "WebTerm"}
        </span>
      </div>

      {/* Body row */}
      <div className="flex flex-1 min-h-0">
        {/* Backdrop for mobile drawer */}
        {navOpen && (
          <div
            className="sm:hidden fixed inset-0 z-20"
            style={{ background: "rgba(0,0,0,0.55)" }}
            onClick={() => setNavOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Sidebar: slide-over drawer on phone, static column on sm+ */}
        <div
          className={[
            "fixed sm:static top-0 left-0 z-30 h-full sm:h-auto sm:z-auto",
            "transition-transform duration-200 ease-out",
            "sm:translate-x-0 sm:flex sm:shrink-0",
            navOpen ? "translate-x-0" : "-translate-x-full",
            "w-72",
          ].join(" ")}
        >
          <Sidebar
            activeId={active?.id ?? ""}
            onSelect={handleSelectProject}
            onViewFiles={handleViewFiles}
            onClose={() => setNavOpen(false)}
          />
        </div>

        {/* File tree: full-screen overlay on phone, full-HEIGHT column on sm+ */}
        {filesFor && !openFile && (
          <div className="fixed inset-0 z-20 sm:static sm:inset-auto sm:z-auto sm:h-full sm:w-64 sm:shrink-0">
            <FileTree root={filesFor.path} onOpen={handleOpenFile} onClose={handleCloseFiles} />
          </div>
        )}

        {/* Main content area: terminal or editor */}
        <div className="flex-1 min-w-0 h-full relative">
          {openFile ? (
            <EditorPane path={openFile} onClose={handleCloseEditor} />
          ) : active ? (
            <TerminalPane key={active.id} projectId={active.id} />
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
