import { useAggregateConn } from "../lib/connStatus";

// Slim banner under the header that surfaces terminal connection trouble.
// Hidden when everything is connected (aggregate "open").
export function ConnectionBanner() {
  const conn = useAggregateConn();
  if (conn === "open") return null;
  const connecting = conn === "connecting";
  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        "shrink-0 flex items-center justify-center gap-2 px-3 py-1 text-[12px] font-medium",
        connecting ? "bg-amber-500/15 text-amber-300" : "bg-red-500/15 text-red-300",
      ].join(" ")}
    >
      <span
        className={[
          "w-2 h-2 rounded-full",
          connecting ? "bg-amber-400 animate-pulse" : "bg-red-400",
        ].join(" ")}
      />
      {connecting ? "Connecting…" : "Disconnected — retrying"}
    </div>
  );
}
