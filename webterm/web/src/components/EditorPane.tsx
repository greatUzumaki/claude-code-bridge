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

  useEffect(() => {
    api.readFile(path).then((r) => {
      setValue(r.tooLarge ? "// file too large to display" : (r.content ?? ""));
      setDirty(false);
    });
  }, [path]);

  const save = async () => {
    await api.writeFile(path, value);
    setDirty(false);
  };

  const filename = path.split("/").pop() ?? path;

  return (
    <div className="h-full flex flex-col" style={{ background: "var(--bg)" }}>
      {/* Toolbar */}
      <div
        className="flex items-center gap-2 px-3 shrink-0"
        style={{
          minHeight: "44px",
          borderBottom: "1px solid var(--border)",
          background: "var(--panel)",
        }}
      >
        <span className="flex-1 truncate text-sm" style={{ color: "var(--text)" }} title={path}>
          {filename}
          {dirty && (
            <span style={{ color: "var(--accent)" }} aria-label="unsaved changes">
              {" "}
              •
            </span>
          )}
        </span>
        <button
          onClick={save}
          aria-label="Save file"
          className="flex items-center justify-center rounded transition-colors hover:bg-white/5 active:bg-white/10"
          style={{ width: "44px", height: "44px", color: dirty ? "var(--accent)" : "var(--muted)" }}
        >
          <Save size={18} />
        </button>
        <button
          onClick={onClose}
          aria-label="Close editor"
          className="flex items-center justify-center rounded transition-colors hover:bg-white/5 active:bg-white/10"
          style={{ width: "44px", height: "44px", color: "var(--muted)" }}
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
          onChange={(v) => {
            setValue(v);
            setDirty(true);
          }}
          height="100%"
        />
      </div>
    </div>
  );
}
