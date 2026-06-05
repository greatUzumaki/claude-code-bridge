import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { buildTree, type Layout, type Project } from "../lib/grouping";

export function Sidebar({
  activeId, onSelect, onViewFiles,
}: {
  activeId: string;
  onSelect: (p: Project) => void;
  onViewFiles: (p: Project) => void;
}) {
  const [layout, setLayout] = useState<Layout>({ groups: [], projects: [] });
  const refresh = () => api.listProjects().then(setLayout);
  useEffect(() => { refresh(); }, []);

  const tree = buildTree(layout);

  const newProject = async () => {
    const name = prompt("New project name");
    if (name) { await api.createProject(name); refresh(); }
  };
  const newGroup = async () => {
    const name = prompt("New group name");
    if (name) { await api.createGroup(name); refresh(); }
  };

  const row = (p: Project) => (
    <div key={p.id}
      onClick={() => onSelect(p)}
      className="group flex items-center justify-between px-3 py-1.5 cursor-pointer text-sm"
      style={{ color: p.id === activeId ? "var(--accent)" : "var(--text)" }}>
      <span className="truncate">{p.name}</span>
      {p.id === activeId && (
        <button onClick={(e) => { e.stopPropagation(); onViewFiles(p); }}
          className="text-xs" style={{ color: "var(--muted)" }}>files</button>
      )}
    </div>
  );

  return (
    <div className="h-full flex flex-col" style={{ background: "var(--panel)", borderRight: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between px-3 py-2 text-xs" style={{ color: "var(--muted)" }}>
        <span>PROJECTS</span>
        <span className="flex gap-2">
          <button onClick={newProject} title="new project">＋</button>
          <button onClick={newGroup} title="new group">▦</button>
        </span>
      </div>
      <div className="flex-1 overflow-auto">
        {tree.ungrouped.map(row)}
        {tree.groups.map((g) => (
          <div key={g.id}>
            <div className="px-3 py-1 text-xs uppercase" style={{ color: "var(--muted)" }}>{g.name}</div>
            {g.projects.map(row)}
          </div>
        ))}
      </div>
    </div>
  );
}
