import { useAggregateConn } from "../lib/connStatus";
import { useLatency } from "../lib/latency";
import { useHostStats } from "../lib/queries";

// Compact header cluster: host CPU/MEM/load + WS latency + aggregated conn dot.
export function HeaderStatus() {
  const conn = useAggregateConn();
  const lat = useLatency();
  const { data: stats } = useHostStats();

  const dot =
    conn === "open" ? "bg-green-500" : conn === "connecting" ? "bg-amber-500" : "bg-red-500";
  const label =
    conn === "open" ? "Connected" : conn === "connecting" ? "Connecting…" : "Disconnected";

  // Latency only meaningful while connected.
  const showLat = conn === "open" && lat != null;
  const latColor =
    lat == null ? "" : lat < 100 ? "text-green-400" : lat < 300 ? "text-amber-400" : "text-red-400";

  return (
    <div className="flex items-center gap-2 shrink-0 text-[11px] text-muted tabular-nums">
      {stats && <span>CPU {Math.round(stats.cpuPercent)}%</span>}
      {stats && <span>MEM {Math.round(stats.memPercent)}%</span>}
      {stats && <span className="hidden min-[480px]:inline">ld {stats.load1.toFixed(1)}</span>}
      {showLat && (
        <span className={latColor} title="Terminal round-trip latency">
          {lat}ms
        </span>
      )}
      <span
        className={["w-2 h-2 rounded-full shrink-0", dot].join(" ")}
        title={label}
        aria-label={label}
        role="status"
      />
    </div>
  );
}
