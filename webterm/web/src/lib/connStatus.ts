import { useSyncExternalStore } from "react";

// Global aggregated connection status across all mounted terminals, so a single
// indicator can live in the header. Each TerminalPane reports its own status by
// id; the aggregate is "closed" if any is closed, else "connecting" if any is
// connecting, else "open" (also "open" when nothing is mounted).
export type ConnStatus = "connecting" | "open" | "closed";

const statuses = new Map<string, ConnStatus>();
const subscribers = new Set<() => void>();

function emit() {
  for (const cb of subscribers) cb();
}

export function reportConn(id: string, status: ConnStatus) {
  if (statuses.get(id) === status) return;
  statuses.set(id, status);
  emit();
}

export function unreportConn(id: string) {
  if (statuses.delete(id)) emit();
}

function aggregate(): ConnStatus {
  if (statuses.size === 0) return "open";
  let sawConnecting = false;
  for (const s of statuses.values()) {
    if (s === "closed") return "closed";
    if (s === "connecting") sawConnecting = true;
  }
  return sawConnecting ? "connecting" : "open";
}

export function useAggregateConn(): ConnStatus {
  return useSyncExternalStore(
    (cb) => {
      subscribers.add(cb);
      return () => subscribers.delete(cb);
    },
    aggregate,
    aggregate,
  );
}
