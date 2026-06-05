import { useEffect, useState } from "react";
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
    api.readFile(path).then((r) => { setValue(r.tooLarge ? "// file too large to display" : r.content ?? ""); setDirty(false); });
  }, [path]);
  const save = async () => { await api.writeFile(path, value); setDirty(false); };
  return (
    <div className="h-full flex flex-col" style={{ background: "var(--bg)" }}>
      <div className="flex items-center justify-between px-3 py-1.5 text-xs" style={{ color: "var(--muted)", borderBottom: "1px solid var(--border)" }}>
        <span className="truncate">{path}{dirty ? " •" : ""}</span>
        <span className="flex gap-3">
          <button onClick={save} style={{ color: "var(--accent)" }}>save</button>
          <button onClick={onClose}>close</button>
        </span>
      </div>
      <div className="flex-1 overflow-auto">
        <CodeMirror value={value} theme="dark" extensions={ext(path)}
          onChange={(v) => { setValue(v); setDirty(true); }} height="100%" />
      </div>
    </div>
  );
}
