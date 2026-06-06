import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAggregateConn } from "../lib/connStatus";

type HostStats = { cpuPercent: number; memPercent: number; load1: number };

// Compact header cluster: host CPU/MEM/load + aggregated connection dot.
export function HeaderStatus() {
  const conn = useAggregateConn();
  const [stats, setStats] = useState<HostStats | null>(null);

  useEffect(() => {
    const fetchStats = () =>
      api
        .hostStats()
        .then((s) =>
          setStats({ cpuPercent: s.cpuPercent, memPercent: s.memPercent, load1: s.load1 }),
        )
        .catch(() => {});
    fetchStats();
    const t = setInterval(fetchStats, 4000);
    return () => clearInterval(t);
  }, []);

  const dot =
    conn === "open" ? "bg-green-500" : conn === "connecting" ? "bg-amber-500" : "bg-red-500";
  const label =
    conn === "open" ? "Connected" : conn === "connecting" ? "Connecting…" : "Disconnected";

  return (
    <div className="flex items-center gap-2 shrink-0 text-[11px] text-muted tabular-nums">
      {stats && (
        <span className="hidden min-[420px]:inline">CPU {Math.round(stats.cpuPercent)}%</span>
      )}
      {stats && <span>MEM {Math.round(stats.memPercent)}%</span>}
      {stats && <span className="hidden min-[480px]:inline">ld {stats.load1.toFixed(1)}</span>}
      <span
        className={["w-2 h-2 rounded-full shrink-0", dot].join(" ")}
        title={label}
        aria-label={label}
        role="status"
      />
    </div>
  );
}
