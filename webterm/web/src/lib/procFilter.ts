import type { ProcInfo } from "./api";

export type ProcSortKey = "pid" | "name" | "user" | "cpu" | "memMB" | "ports" | "cmd";
export type SortDir = "asc" | "desc";

const STRING_KEYS = new Set<ProcSortKey>(["name", "user", "cmd"]);

// Numeric sort value for a column. "ports" sorts by the lowest listening port;
// processes with none get MAX so they trail when ascending.
function numValue(p: ProcInfo, key: ProcSortKey): number {
  if (key === "ports") return p.ports?.length ? Math.min(...p.ports) : Number.MAX_SAFE_INTEGER;
  return p[key as "pid" | "cpu" | "memMB"];
}

// filterProcesses narrows a process list by a free-text needle (matched against
// name, command, pid, or any listening port). Pure (no mutation).
export function filterProcesses(procs: ProcInfo[], query: string): ProcInfo[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return procs;
  return procs.filter(
    (p) =>
      p.name.toLowerCase().includes(needle) ||
      p.cmd.toLowerCase().includes(needle) ||
      String(p.pid).includes(needle) ||
      (p.ports ?? []).some((port) => String(port).includes(needle)),
  );
}

// sortProcesses returns a new array sorted by the given column. Strings sort
// case-insensitively; numbers numerically. Ties break by pid for stability.
export function sortProcesses(procs: ProcInfo[], key: ProcSortKey, dir: SortDir): ProcInfo[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...procs].sort((a, b) => {
    let cmp: number;
    if (STRING_KEYS.has(key)) {
      const k = key as "name" | "user" | "cmd";
      cmp = a[k].localeCompare(b[k], undefined, { sensitivity: "base" });
    } else {
      cmp = numValue(a, key) - numValue(b, key);
    }
    return cmp !== 0 ? cmp * sign : a.pid - b.pid;
  });
}
