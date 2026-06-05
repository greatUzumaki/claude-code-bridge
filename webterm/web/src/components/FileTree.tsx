import { useEffect, useState } from "react";
import { api, type FsEntry } from "../lib/api";

export function FileTree({ root, onOpen }: { root: string; onOpen: (path: string) => void }) {
  const [path] = useState(root);
  const [entries, setEntries] = useState<FsEntry[]>([]);
  useEffect(() => { api.listDir(path).then((r) => setEntries(r.entries)); }, [path]);
  return (
    <div className="text-sm overflow-auto h-full" style={{ background: "var(--panel)", borderRight: "1px solid var(--border)" }}>
      <div className="px-3 py-2 text-xs" style={{ color: "var(--muted)" }}>{root || "/"}</div>
      {entries.map((e) => (
        <div key={e.name}
          onClick={() => !e.dir && onOpen(`${path}/${e.name}`)}
          className="px-3 py-1 cursor-pointer truncate"
          style={{ color: e.dir ? "var(--muted)" : "var(--text)" }}>
          {e.dir ? "▸ " : "  "}{e.name}
        </div>
      ))}
    </div>
  );
}
