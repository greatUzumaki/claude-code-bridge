import { useEffect, useState } from "react";
import { Save, X } from "lucide-react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { python } from "@codemirror/lang-python";
import { api } from "../lib/api";

function ext(path: string) {
  const e = path.split(".").pop() ?? "";
  if (["ts", "tsx", "js", "jsx"].includes(e)) return [javascript({ jsx: true, typescript: true })];
  if (e === "json") return [json()];
  if (e === "py") return [python()];
  return [];
}

export function EditorPane({ path, onClose }: { path: string; onClose: () => void }) {
  const [value, setValue] = useState("");
  const [dirty, setDirty] = useState(false);
  const [tooLarge, setTooLarge] = useState(false);

  useEffect(() => {
    api.readFile(path).then((r) => {
      setTooLarge(!!r.tooLarge);
      setValue(r.tooLarge ? "// file too large to display" : (r.content ?? ""));
      setDirty(false);
    });
  }, [path]);

  const save = async () => {
    if (tooLarge) return; // never write the placeholder back over a large file
    await api.writeFile(path, value);
    setDirty(false);
  };

  const filename = path.split("/").pop() ?? path;

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
        <button
          onClick={save}
          aria-label="Save file"
          disabled={tooLarge}
          className={[
            "flex items-center justify-center rounded transition-colors hover:bg-white/5 active:bg-white/10 disabled:opacity-40 disabled:pointer-events-none w-11 h-11",
            dirty && !tooLarge ? "text-accent" : "text-muted",
          ].join(" ")}
        >
          <Save size={18} />
        </button>
        <button
          onClick={onClose}
          aria-label="Close editor"
          className="flex items-center justify-center rounded transition-colors hover:bg-white/5 active:bg-white/10 w-11 h-11 text-muted"
        >
          <X size={18} />
        </button>
      </div>

      {/* Editor content */}
      <div className="flex-1 overflow-auto">
        <CodeMirror
          value={value}
          theme="dark"
          extensions={ext(path)}
          readOnly={tooLarge}
          onChange={(v) => {
            if (tooLarge) return;
            setValue(v);
            setDirty(true);
          }}
          height="100%"
        />
      </div>
    </div>
  );
}
