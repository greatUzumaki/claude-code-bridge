import { useState } from "react";
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

  return (
    <div className="h-full flex">
      {/* Sidebar: drawer on phone, fixed column on desktop */}
      <div className={`absolute z-10 h-full w-60 transition-transform sm:static sm:translate-x-0 ${navOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <Sidebar
          activeId={active?.id ?? ""}
          onSelect={(p) => { setActive(p); setOpenFile(null); setNavOpen(false); }}
          onViewFiles={(p) => setFilesFor(p)}
        />
      </div>

      {/* file tree column when "view files" toggled */}
      {filesFor && (
        <div className="w-56 shrink-0">
          <FileTree root={filesFor.path} onOpen={(p) => setOpenFile(p)} />
        </div>
      )}

      {/* main area */}
      <div className="flex-1 h-full relative">
        <button onClick={() => setNavOpen((v) => !v)}
          className="sm:hidden absolute top-2 left-2 z-20 text-sm" style={{ color: "var(--muted)" }}>☰</button>
        {openFile ? (
          <EditorPane path={openFile} onClose={() => setOpenFile(null)} />
        ) : active ? (
          <TerminalPane key={active.id} projectId={active.id} />
        ) : (
          <div className="h-full flex items-center justify-center text-sm" style={{ color: "var(--muted)" }}>
            select a project
          </div>
        )}
      </div>
    </div>
  );
}
