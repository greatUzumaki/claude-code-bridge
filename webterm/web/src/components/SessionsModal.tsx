import { useState } from "react";
import { createPortal } from "react-dom";
import { X, RefreshCw, Trash2 } from "lucide-react";
import { useTerms, useKillTerm } from "../lib/queries";

export function SessionsModal({ onClose }: { onClose: () => void }) {
  const { data, isLoading, refetch } = useTerms(true);
  const sessions = data?.sessions ?? [];
  const killTerm = useKillTerm();
  const [confirmName, setConfirmName] = useState<string | null>(null);

  const kill = async (name: string) => {
    await killTerm.mutateAsync(name);
    setConfirmName(null);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Session manager"
    >
      <div className="absolute inset-0 bg-black/55" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-sm max-h-[85vh] flex flex-col rounded-lg border border-border bg-panel p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-text text-sm font-medium">Terminal sessions</h2>
          <span className="flex items-center gap-1">
            <button
              onClick={() => refetch()}
              aria-label="Refresh sessions"
              className="flex items-center justify-center rounded w-9 h-9 text-muted hover:bg-white/5 active:bg-white/10"
            >
              <RefreshCw size={16} />
            </button>
            <button
              onClick={onClose}
              aria-label="Close"
              className="flex items-center justify-center rounded w-9 h-9 text-muted hover:bg-white/5 active:bg-white/10"
            >
              <X size={18} />
            </button>
          </span>
        </div>

        <div className="flex-1 overflow-y-auto -mx-1">
          {isLoading && (
            <div className="px-3 py-4 text-[13px] text-muted text-center">Loading…</div>
          )}
          {!isLoading && sessions.length === 0 && (
            <div className="px-3 py-4 text-[13px] text-muted text-center">No active sessions</div>
          )}
          {!isLoading &&
            sessions.map((name) => (
              <div
                key={name}
                className="flex items-center gap-2 px-3 min-h-11 rounded-sm hover:bg-white/5"
              >
                <span className="flex-1 truncate text-[14px] text-text font-mono">{name}</span>
                {confirmName === name ? (
                  <span className="shrink-0 flex items-center gap-1">
                    <button
                      onClick={() => kill(name)}
                      disabled={killTerm.isPending}
                      aria-label={`Confirm kill ${name}`}
                      className="flex items-center justify-center px-3 h-8 rounded text-[13px] font-medium bg-red-500 text-white transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-40 disabled:pointer-events-none"
                    >
                      Kill
                    </button>
                    <button
                      onClick={() => setConfirmName(null)}
                      aria-label="Cancel"
                      className="flex items-center justify-center px-3 h-8 rounded text-[13px] text-muted border border-border hover:bg-white/5 active:bg-white/10"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => setConfirmName(name)}
                    aria-label={`Kill session ${name}`}
                    className="shrink-0 flex items-center justify-center gap-1.5 px-3 h-8 rounded text-[13px] text-red-400 border border-border transition-colors hover:bg-red-500/10 active:bg-red-500/15"
                  >
                    <Trash2 size={14} /> Kill
                  </button>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
