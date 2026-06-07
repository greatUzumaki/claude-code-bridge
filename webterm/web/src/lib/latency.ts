import { useSyncExternalStore } from "react";

// Global WS round-trip latency across mounted terminals, so a single readout can
// live in the header. Each terminal reports its last ping→pong RTT by id; the
// representative value shown is the worst (max) across live terminals.
const latencies = new Map<string, number>();
const subscribers = new Set<() => void>();

function emit() {
  for (const cb of subscribers) cb();
}

export function reportLatency(id: string, ms: number) {
  latencies.set(id, ms);
  emit();
}

export function unreportLatency(id: string) {
  if (latencies.delete(id)) emit();
}

function worst(): number | null {
  let max: number | null = null;
  for (const v of latencies.values()) max = max === null ? v : Math.max(max, v);
  return max; // primitive → referentially stable for useSyncExternalStore
}

export function useLatency(): number | null {
  return useSyncExternalStore(
    (cb) => {
      subscribers.add(cb);
      return () => subscribers.delete(cb);
    },
    worst,
    worst,
  );
}
