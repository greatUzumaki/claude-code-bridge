import type { SortDir } from "../lib/procFilter";

// A clickable, sortable table header cell. Generic over the column-key union so
// both the process and docker tables can share it.
export function SortHeader<K extends string>({
  column,
  label,
  align = "left",
  activeColumn,
  dir,
  onSort,
}: {
  column: K;
  label: string;
  align?: "left" | "right";
  activeColumn: K;
  dir: SortDir;
  onSort: (column: K) => void;
}) {
  const active = activeColumn === column;
  return (
    <th
      onClick={() => onSort(column)}
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
      className={[
        "px-3 py-2 font-medium cursor-pointer select-none hover:text-text whitespace-nowrap",
        align === "right" ? "text-right" : "",
        active ? "text-text" : "",
      ].join(" ")}
    >
      {label}
      <span className="inline-block w-3 text-[10px]">{active ? (dir === "asc" ? "▲" : "▼") : ""}</span>
    </th>
  );
}
