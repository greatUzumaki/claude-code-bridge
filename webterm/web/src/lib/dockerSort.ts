import type { DockerContainer } from "./api";
import type { SortDir } from "./procFilter";

export type DockerSortKey = "Names" | "Image" | "State" | "Status";

// formatPorts condenses docker's verbose Ports string to just the published
// host→container mappings: drops the bind IP, the /proto suffix, and any
// exposed-but-unpublished ports (no "->"). e.g.
//   "127.0.0.1:6379->6379/tcp, 5778-5779/tcp"  ->  "6379→6379"
export function formatPorts(raw: string): string {
  if (!raw) return "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.includes("->"))
    .map((s) => {
      const [left, right] = s.split("/")[0].split("->");
      const host = left.includes(":") ? left.slice(left.lastIndexOf(":") + 1) : left;
      return `${host}→${right}`;
    })
    .join(", ");
}

// Rank container states so sorting "by status" groups running containers first,
// then progressively less-healthy states. Unknown states sort last.
const stateRank: Record<string, number> = {
  running: 0,
  restarting: 1,
  paused: 2,
  created: 3,
  exited: 4,
  dead: 5,
};

export function sortContainers(
  list: DockerContainer[],
  key: DockerSortKey,
  dir: SortDir,
): DockerContainer[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...list].sort((a, b) => {
    let cmp: number;
    if (key === "State") {
      const ra = stateRank[(a.State ?? "").toLowerCase()] ?? 99;
      const rb = stateRank[(b.State ?? "").toLowerCase()] ?? 99;
      cmp = ra - rb;
    } else {
      cmp = (a[key] ?? "").localeCompare(b[key] ?? "", undefined, { sensitivity: "base" });
    }
    // Stable tie-break by name.
    return cmp !== 0 ? cmp * sign : a.Names.localeCompare(b.Names);
  });
}
