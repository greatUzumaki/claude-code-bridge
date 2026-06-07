import { useEffect, useRef, useState } from "react";
import { ChevronLeft, File, Folder, Search } from "lucide-react";
import type { FsEntry } from "../lib/api";
import { useDir, useSearch } from "../lib/queries";

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
  const [query, setQuery] = useState("");
  // Debounced query fed into useSearch so the query key only changes after 250 ms of silence.
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset to the project root when switching projects (root prop changes),
  // otherwise the tree would keep listing the previous project's directory.
  useEffect(() => {
    setCurrentPath(root);
    setQuery("");
    setDebouncedQuery("");
  }, [root]);

  // 250 ms debounce: update debouncedQuery after user stops typing.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const { data: dirData } = useDir(currentPath);
  const entries: FsEntry[] = dirData?.entries ?? [];

  const isSearching = query.trim().length > 0;
  // isFetching is true while TanStack Query is in-flight for the current debouncedQuery.
  const { data: searchData, isFetching: searching } = useSearch(root, debouncedQuery);
  const searchResults: string[] = searchData?.matches ?? [];

  const handleEntry = (e: FsEntry) => {
    if (e.dir) {
      setCurrentPath(`${currentPath}/${e.name}`);
    } else {
      onOpen(`${currentPath}/${e.name}`);
    }
  };

  const canGoUp = currentPath !== root && !query.trim();
  const goUp = () => {
    const parent = currentPath.split("/").slice(0, -1).join("/") || "/";
    setCurrentPath(parent.length < root.length ? root : parent);
  };

  const displayPath =
    (currentPath.startsWith(root) ? currentPath.slice(root.length) : currentPath) || "/";

  return (
    <div className="h-full w-full flex flex-col text-sm bg-panel border-r border-border">
      {/* Header */}
      <div className="flex items-center gap-2 px-2 shrink-0 min-h-11 border-b border-border">
        <button
          onClick={onClose}
          aria-label="Close file tree"
          className="flex items-center justify-center shrink-0 rounded transition-colors hover:bg-white/5 active:bg-white/10 w-9 h-9 text-muted"
        >
          <ChevronLeft size={18} />
        </button>
        {isSearching ? (
          <span className="flex-1 truncate text-xs text-muted italic">
            {searching
              ? "Searching…"
              : `${searchResults.length} result${searchResults.length === 1 ? "" : "s"}`}
          </span>
        ) : (
          <span className="flex-1 truncate text-xs text-muted" title={currentPath}>
            {displayPath}
          </span>
        )}
        {canGoUp && (
          <button
            onClick={goUp}
            aria-label="Go to parent directory"
            className="shrink-0 text-xs px-2 rounded transition-colors hover:bg-white/5 active:bg-white/10 min-h-[30px] text-muted"
          >
            ..
          </button>
        )}
      </div>

      {/* Search input */}
      <div className="px-2 py-1.5 border-b border-border shrink-0">
        <div className="flex items-center gap-1.5 bg-bg border border-border rounded px-2 h-8">
          <Search size={13} className="shrink-0 text-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files…"
            aria-label="Search files"
            className="flex-1 min-w-0 bg-transparent text-xs text-text placeholder:text-muted outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="shrink-0 text-muted hover:text-text transition-colors"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Entries / Search results */}
      <div className="flex-1 overflow-y-auto px-1 py-1">
        {isSearching ? (
          searchResults.length === 0 && !searching ? (
            <p className="px-3 py-2 text-xs text-muted">No results.</p>
          ) : (
            searchResults.map((relpath) => (
              <div
                key={relpath}
                onClick={() => onOpen(`${root}/${relpath}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(ev) => ev.key === "Enter" && onOpen(`${root}/${relpath}`)}
                className="flex items-center gap-2 px-2 cursor-pointer truncate rounded-sm transition-colors hover:bg-white/5 active:bg-white/10 select-none min-h-11"
              >
                <File size={16} className="shrink-0 text-muted" />
                <span className="truncate text-[14px] text-text" title={relpath}>
                  {relpath}
                </span>
              </div>
            ))
          )
        ) : (
          entries.map((e) => (
            <div
              key={e.name}
              onClick={() => handleEntry(e)}
              role="button"
              tabIndex={0}
              onKeyDown={(ev) => ev.key === "Enter" && handleEntry(e)}
              className={[
                "flex items-center gap-2 px-2 cursor-pointer truncate rounded-sm transition-colors hover:bg-white/5 active:bg-white/10 select-none min-h-11",
                e.dir ? "text-muted" : "text-text",
              ].join(" ")}
            >
              {e.dir ? (
                <Folder size={16} className="shrink-0 text-accent" />
              ) : (
                <File size={16} className="shrink-0 text-muted" />
              )}
              <span className="truncate text-[14px]">{e.name}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
