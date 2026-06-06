import { useEffect, useState } from "react";
import { Eye, Pencil, Save, X } from "lucide-react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { python } from "@codemirror/lang-python";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "../lib/api";

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

  useEffect(() => {
    if (kind === "image") return; // no file read needed
    api.readFile(path).then((r) => {
      setTooLarge(!!r.tooLarge);
      setValue(r.tooLarge ? "// file too large to display" : (r.content ?? ""));
      setDirty(false);
    });
    // Reset markdown to preview whenever path changes
    setMdMode("preview");
  }, [path, kind]);

  const save = async () => {
    if (tooLarge) return;
    await api.writeFile(path, value);
    setDirty(false);
  };

  const filename = path.split("/").pop() ?? path;
  const canSave = kind !== "image" && !tooLarge;

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
      </div>
    </div>
  );
}
