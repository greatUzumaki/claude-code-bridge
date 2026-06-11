import { useState } from "react";
import { createPortal } from "react-dom";
import { X, AlertTriangle } from "lucide-react";
import type { Project } from "../lib/grouping";
import { useDeleteProject } from "../lib/queries";

// Destructive: permanently removes the project folder. Requires the user to type
// the exact project name to confirm — guards against fat-finger deletion.
export function DeleteProjectModal({
  project,
  onClose,
}: {
  project: Project;
  onClose: () => void;
}) {
  const del = useDeleteProject();
  const [confirm, setConfirm] = useState("");
  const match = confirm.trim() === project.name;

  const submit = async () => {
    if (!match || del.isPending) return;
    try {
      await del.mutateAsync(project.id);
      onClose();
    } catch {
      // error surfaced below via del.isError
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Delete project"
    >
      <div className="absolute inset-0 bg-black/55" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-sm rounded-lg border border-border bg-panel p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="flex items-center gap-2 text-text text-sm font-medium">
            <AlertTriangle size={16} className="text-red-400" /> Delete project
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex items-center justify-center rounded w-9 h-9 text-muted hover:bg-white/5 active:bg-white/10"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-[13px] text-muted leading-relaxed">
          This permanently deletes <span className="text-text font-medium">{project.name}</span> and
          all of its files, and kills its terminal sessions. This cannot be undone.
        </p>
        <p className="mt-3 text-[13px] text-muted">
          Type <span className="text-text font-mono">{project.name}</span> to confirm:
        </p>

        <input
          autoFocus
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
            if (e.key === "Escape") onClose();
          }}
          placeholder={project.name}
          aria-label="Type project name to confirm"
          className="mt-2 w-full h-11 rounded-md bg-bg border border-border px-3 text-text text-[15px] outline-none focus:border-red-400"
        />

        {del.isError && (
          <p className="mt-2 text-[12px] text-red-400">
            {del.error instanceof Error ? del.error.message : "Delete failed"}
          </p>
        )}

        <div className="mt-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-11 rounded-md text-[14px] border border-border text-text transition-colors hover:bg-white/5 active:bg-white/10"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!match || del.isPending}
            className="flex-1 h-11 rounded-md text-[14px] font-medium bg-red-500 text-white transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-40 disabled:pointer-events-none"
          >
            {del.isPending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
