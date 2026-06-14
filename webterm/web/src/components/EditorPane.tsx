import { useEffect, useRef, useState } from "react";
import { Columns2, Eye, GitCompare, Pencil, Rows3, Save, X } from "lucide-react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { python } from "@codemirror/lang-python";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "../lib/api";
import { useFile, useGitShow, useWriteFile } from "../lib/queries";
import { DiffView } from "./DiffView";

const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif"]);
const MD_EXTS = new Set(["md", "markdown"]);

type FileKind = "image" | "markdown" | "code";

function getExt(path: string): string {
  return (path.split(".").pop() ?? "").toLowerCase();
}

function fileKind(path: string): FileKind {
  const e = getExt(path);
  if (IMAGE_EXTS.has(e)) return "image";
  if (MD_EXTS.has(e)) return "markdown";
  return "code";
}

function cmExtensions(path: string) {
  const e = getExt(path);
  if (["ts", "tsx", "js", "jsx"].includes(e)) return [javascript({ jsx: true, typescript: true })];
  if (e === "json") return [json()];
  if (e === "py") return [python()];
  return [];
}

export function EditorPane({ path, onClose }: { path: string; onClose: () => void }) {
  const kind = fileKind(path);
  const [value, setValue] = useState("");
  const [dirty, setDirty] = useState(false);
  const [tooLarge, setTooLarge] = useState(false);
  // Markdown: default to preview mode
  const [mdMode, setMdMode] = useState<"preview" | "edit">("preview");
  // Git diff overlay (vs HEAD) and its layout (inline vs side-by-side).
  const [showDiff, setShowDiff] = useState(false);
  const [diffMode, setDiffMode] = useState<"unified" | "split">("split");

  // Track the last path whose data we already synced into the buffer so we
  // never overwrite a dirty buffer with a same-path background re-fetch.
  const lastSyncedPath = useRef<string | null>(null);

  // Only fetch file contents for non-image kinds.
  const { data: fileData, isLoading } = useFile(path, kind !== "image");
  const writeFile = useWriteFile();

  // HEAD version for the diff view. Only meaningful for text; skip images.
  const { data: headData } = useGitShow(path, kind !== "image");
  const headText = headData?.exists && !headData.tooLarge ? (headData.content ?? "") : null;
  // The file differs from its committed version (compares the live buffer, so unsaved
  // edits show up too). Drives whether the diff toggle is offered.
  const modified = headText !== null && headText !== value;

  // Fix #2: stale content from a previous file is avoided by remounting on path
  // change — the parent renders <EditorPane key={path} …>, so switching files
  // gives a fresh buffer (value="", dirty=false, lastSyncedPath=null) without a
  // setState-in-effect reset. The sync effect below then fills the buffer once.

  // Fix #1: sync fetched content into the buffer only on the first arrival for
  // this path (tracked via lastSyncedPath). A same-path background re-fetch
  // will NOT overwrite edits because lastSyncedPath.current === path.
  useEffect(() => {
    if (kind === "image") return;
    if (!fileData) return;
    if (lastSyncedPath.current === path) return; // already synced; don't clobber edits
    lastSyncedPath.current = path;
    setTooLarge(!!fileData.tooLarge);
    setValue(fileData.tooLarge ? "// file too large to display" : (fileData.content ?? ""));
    setDirty(false);
  }, [path, kind, fileData]);

  const save = async () => {
    if (tooLarge) return;
    await writeFile.mutateAsync({ path, content: value });
    setDirty(false);
  };

  const filename = path.split("/").pop() ?? path;
  // Fix #2: disable save while data hasn't loaded yet for the current path.
  const dataReady = !isLoading && fileData !== undefined;
  const canSave = kind !== "image" && !tooLarge && dataReady;

  return (
    <div className="h-full flex flex-col bg-bg">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 shrink-0 min-h-11 border-b border-border bg-panel">
        <span className="flex-1 truncate text-sm text-text" title={path}>
          {filename}
          {dirty && (
            <span className="text-accent" aria-label="unsaved changes">
              {" "}
              •
            </span>
          )}
        </span>

        {/* Markdown preview/edit toggle */}
        {kind === "markdown" && (
          <button
            onClick={() => setMdMode((m) => (m === "preview" ? "edit" : "preview"))}
            aria-label={mdMode === "preview" ? "Switch to edit mode" : "Switch to preview mode"}
            className="flex items-center justify-center rounded transition-colors hover:bg-white/5 active:bg-white/10 w-11 h-11 text-muted"
            title={mdMode === "preview" ? "Edit" : "Preview"}
          >
            {mdMode === "preview" ? <Pencil size={16} /> : <Eye size={16} />}
          </button>
        )}

        {/* Git diff toggle — only when the file differs from its committed version */}
        {modified && (
          <>
            {showDiff && (
              <button
                onClick={() => setDiffMode((m) => (m === "split" ? "unified" : "split"))}
                aria-label={diffMode === "split" ? "Inline diff" : "Side-by-side diff"}
                title={diffMode === "split" ? "Inline diff" : "Side-by-side diff"}
                className="flex items-center justify-center rounded transition-colors hover:bg-white/5 active:bg-white/10 w-11 h-11 text-muted"
              >
                {diffMode === "split" ? <Rows3 size={16} /> : <Columns2 size={16} />}
              </button>
            )}
            <button
              onClick={() => setShowDiff((s) => !s)}
              aria-label={showDiff ? "Hide diff" : "Show git diff"}
              title={showDiff ? "Hide diff" : "Git diff vs HEAD"}
              className={[
                "flex items-center justify-center rounded transition-colors hover:bg-white/5 active:bg-white/10 w-11 h-11",
                showDiff ? "text-accent" : "text-muted",
              ].join(" ")}
            >
              <GitCompare size={16} />
            </button>
          </>
        )}

        {/* Save button — hidden for images */}
        {canSave && (
          <button
            onClick={save}
            aria-label="Save file"
            disabled={kind === "markdown" && mdMode === "preview" ? false : !dirty}
            className={[
              "flex items-center justify-center rounded transition-colors hover:bg-white/5 active:bg-white/10 disabled:opacity-40 disabled:pointer-events-none w-11 h-11",
              dirty && !tooLarge ? "text-accent" : "text-muted",
            ].join(" ")}
          >
            <Save size={18} />
          </button>
        )}

        <button
          onClick={onClose}
          aria-label="Close editor"
          className="flex items-center justify-center rounded transition-colors hover:bg-white/5 active:bg-white/10 w-11 h-11 text-muted"
        >
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {showDiff && modified && headText !== null ? (
          <DiffView oldText={headText} newText={value} mode={diffMode} />
        ) : (
          <>
        {kind === "image" && (
          <div className="flex items-center justify-center h-full w-full">
            <img
              src={api.rawUrl(path)}
              alt={filename}
              className="max-w-full max-h-full object-contain"
            />
          </div>
        )}

        {kind === "markdown" && mdMode === "preview" && (
          <div className="md-body h-full overflow-auto px-6 py-5">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
          </div>
        )}

        {kind === "markdown" && mdMode === "edit" && (
          <CodeMirror
            value={value}
            theme="dark"
            extensions={[]}
            readOnly={tooLarge}
            onChange={(v) => {
              if (tooLarge) return;
              setValue(v);
              setDirty(true);
            }}
            height="100%"
          />
        )}

        {kind === "code" && (
          <CodeMirror
            value={value}
            theme="dark"
            extensions={cmExtensions(path)}
            readOnly={tooLarge}
            onChange={(v) => {
              if (tooLarge) return;
              setValue(v);
              setDirty(true);
            }}
            height="100%"
          />
        )}
          </>
        )}
      </div>
    </div>
  );
}
