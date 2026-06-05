import { useEffect, useState } from "react";
import { ChevronLeft, Folder, File } from "lucide-react";
import { api, type FsEntry } from "../lib/api";

export function FileTree({
  root,
  onOpen,
  onClose,
}: {
  root: string;
  onOpen: (path: string) => void;
  onClose: () => void;
}) {
  const [currentPath, setCurrentPath] = useState(root);
  const [entries, setEntries] = useState<FsEntry[]>([]);

  useEffect(() => {
    api.listDir(currentPath).then((r) => setEntries(r.entries));
  }, [currentPath]);

  const handleEntry = (e: FsEntry) => {
    if (e.dir) {
      setCurrentPath(`${currentPath}/${e.name}`);
    } else {
      onOpen(`${currentPath}/${e.name}`);
    }
  };

  const canGoUp = currentPath !== root;
  const goUp = () => {
    const parent = currentPath.split("/").slice(0, -1).join("/") || "/";
    setCurrentPath(parent.length < root.length ? root : parent);
  };

  const displayPath = currentPath.replace(root, "") || "/";

  return (
    <div
      className="h-full flex flex-col text-sm"
      style={{ background: "var(--panel)", borderRight: "1px solid var(--border)" }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-2 shrink-0"
        style={{
          minHeight: "44px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close file tree"
          className="flex items-center justify-center shrink-0 rounded transition-colors hover:bg-white/5 active:bg-white/10"
          style={{ width: "36px", height: "36px", color: "var(--muted)" }}
        >
          <ChevronLeft size={18} />
        </button>
        <span
          className="flex-1 truncate text-xs"
          style={{ color: "var(--muted)" }}
          title={currentPath}
        >
          {displayPath}
        </span>
        {canGoUp && (
          <button
            onClick={goUp}
            aria-label="Go to parent directory"
            className="shrink-0 text-xs px-2 rounded transition-colors hover:bg-white/5 active:bg-white/10"
            style={{ minHeight: "30px", color: "var(--muted)" }}
          >
            ..
          </button>
        )}
      </div>

      {/* Entries */}
      <div className="flex-1 overflow-y-auto px-1 py-1">
        {entries.map((e) => (
          <div
            key={e.name}
            onClick={() => handleEntry(e)}
            role="button"
            tabIndex={0}
            onKeyDown={(ev) => ev.key === "Enter" && handleEntry(e)}
            className="flex items-center gap-2 px-2 cursor-pointer truncate rounded-sm transition-colors hover:bg-white/5 active:bg-white/10 select-none"
            style={{
              minHeight: "44px",
              color: e.dir ? "var(--muted)" : "var(--text)",
            }}
          >
            {e.dir ? (
              <Folder size={16} className="shrink-0" style={{ color: "var(--accent)" }} />
            ) : (
              <File size={16} className="shrink-0" style={{ color: "var(--muted)" }} />
            )}
            <span className="truncate text-[14px]">{e.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
