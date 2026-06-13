import { useMemo, useState } from "react";
import { RefreshCw, Activity, Search, XCircle } from "lucide-react";
import { NavBar } from "./NavBar";
import { useProcesses, useKillProcess } from "../lib/queries";
import { haptic } from "../lib/haptics";
import { filterProcesses, sortProcesses, type ProcSortKey, type SortDir } from "../lib/procFilter";
import { SortHeader } from "./SortHeader";

export function ProcessPage() {
  const { data, isLoading, refetch, isFetching } = useProcesses();
  const kill = useKillProcess();
  const [q, setQ] = useState("");
  const [confirmPid, setConfirmPid] = useState<number | null>(null);
  const [sort, setSort] = useState<{ key: ProcSortKey; dir: SortDir }>({ key: "cpu", dir: "desc" });

  const doKill = (pid: number) => {
    haptic();
    kill.mutate({ pid });
    setConfirmPid(null);
  };

  const toggleSort = (key: ProcSortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "cpu" || key === "memMB" ? "desc" : "asc" },
    );

  const procs = useMemo(
    () => sortProcesses(filterProcesses(data?.processes ?? [], q), sort.key, sort.dir),
    [data, q, sort],
  );

  const listening = data?.listening ?? [];

  return (
    <div className="h-dvh flex flex-col bg-bg overflow-hidden">
      <NavBar />
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0 gap-2">
        <h1 className="flex items-center gap-2 text-text text-sm font-medium shrink-0">
          <Activity size={16} /> Processes{" "}
          {procs.length > 0 && <span className="text-muted">({procs.length})</span>}
        </h1>
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex items-center gap-1.5 px-2 h-8 rounded-md bg-panel border border-border min-w-0">
            <Search size={13} className="text-muted shrink-0" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="filter name / port / pid"
              className="bg-transparent outline-none text-[13px] text-text w-36 sm:w-48 min-w-0"
            />
          </span>
          <button
            onClick={() => refetch()}
            aria-label="Refresh"
            className="flex items-center justify-center rounded w-9 h-9 text-muted hover:bg-white/5 active:bg-white/10 shrink-0"
          >
            <RefreshCw size={15} className={isFetching ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {kill.isError && (
        <div className="px-4 py-2 border-b border-border shrink-0 text-[12px] text-red-400">
          kill failed: {kill.error instanceof Error ? kill.error.message : "unknown error"}
        </div>
      )}

      {/* Listening ports strip */}
      {listening.length > 0 && (
        <div className="px-4 py-2 border-b border-border shrink-0 flex flex-wrap gap-1.5">
          <span className="text-[11px] uppercase tracking-wider text-muted mr-1 self-center">
            Listening
          </span>
          {listening
            .slice()
            .sort((a, b) => a.port - b.port)
            .map((l, i) => (
              <span
                key={`${l.port}-${l.pid}-${i}`}
                className="font-mono text-[12px] px-2 h-6 inline-flex items-center rounded bg-white/5 text-text"
                title={l.name || "owner unknown (needs root)"}
              >
                :{l.port}
                <span className="text-muted ml-1">{l.name || "?"}</span>
              </span>
            ))}
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {isLoading && <div className="p-6 text-center text-[13px] text-muted">Loading…</div>}
        {!isLoading && procs.length === 0 && (
          <div className="p-6 text-center text-[13px] text-muted">No matching processes</div>
        )}
        {procs.length > 0 && (
          <table className="w-full text-[13px] border-collapse">
            <thead className="sticky top-0 bg-bg">
              <tr className="text-muted text-left">
                <SortHeader column="pid" label="PID" activeColumn={sort.key} dir={sort.dir} onSort={toggleSort} />
                <SortHeader column="name" label="Name" activeColumn={sort.key} dir={sort.dir} onSort={toggleSort} />
                <SortHeader column="user" label="User" activeColumn={sort.key} dir={sort.dir} onSort={toggleSort} />
                <SortHeader column="cpu" label="CPU%" align="right" activeColumn={sort.key} dir={sort.dir} onSort={toggleSort} />
                <SortHeader column="memMB" label="Mem" align="right" activeColumn={sort.key} dir={sort.dir} onSort={toggleSort} />
                <SortHeader column="ports" label="Ports" activeColumn={sort.key} dir={sort.dir} onSort={toggleSort} />
                <SortHeader column="cmd" label="Command" activeColumn={sort.key} dir={sort.dir} onSort={toggleSort} />
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {procs.map((p) => (
                <tr key={p.pid} className="border-t border-border align-top">
                  <td className="px-3 py-1.5 font-mono text-muted">{p.pid}</td>
                  <td className="px-3 py-1.5 text-text whitespace-nowrap">{p.name}</td>
                  <td className="px-3 py-1.5 text-muted whitespace-nowrap">{p.user}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-muted">
                    {p.cpu.toFixed(1)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-muted whitespace-nowrap">
                    {p.memMB.toFixed(0)} MB
                  </td>
                  <td className="px-3 py-1.5 font-mono text-[12px]">
                    {(p.ports ?? []).length > 0 ? (
                      <span className="text-accent">{(p.ports ?? []).join(", ")}</span>
                    ) : (
                      <span className="text-muted/40">—</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-muted font-mono text-[12px] max-w-md truncate">
                    {p.cmd}
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    {confirmPid === p.pid ? (
                      <span className="flex items-center gap-1">
                        <button
                          onClick={() => doKill(p.pid)}
                          className="px-2 h-7 rounded text-[12px] font-medium bg-red-500 text-white hover:opacity-90 active:opacity-80"
                        >
                          Kill
                        </button>
                        <button
                          onClick={() => setConfirmPid(null)}
                          className="px-2 h-7 rounded text-[12px] text-muted border border-border hover:bg-white/5"
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          haptic();
                          setConfirmPid(p.pid);
                        }}
                        aria-label={`Kill process ${p.pid}`}
                        className="flex items-center justify-center gap-1 px-2 h-7 rounded text-[12px] text-muted border border-border hover:bg-red-500/10 hover:text-red-400 transition-colors"
                      >
                        <XCircle size={13} /> Kill
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
