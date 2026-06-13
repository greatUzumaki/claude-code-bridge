import { useState } from "react";
import { RefreshCw, Container, Play, Square, RotateCw } from "lucide-react";
import { NavBar } from "./NavBar";
import { SortHeader } from "./SortHeader";
import { useDocker, useDockerAction } from "../lib/queries";
import { haptic } from "../lib/haptics";
import type { DockerContainer } from "../lib/api";
import { sortContainers, formatPorts, type DockerSortKey } from "../lib/dockerSort";
import type { SortDir } from "../lib/procFilter";

function StateBadge({ state }: { state: string }) {
  const running = (state ?? "").toLowerCase() === "running";
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 px-2 h-6 rounded text-[12px]",
        running ? "bg-green-500/15 text-green-400" : "bg-white/5 text-muted",
      ].join(" ")}
    >
      <span
        className={["w-1.5 h-1.5 rounded-full", running ? "bg-green-500" : "bg-muted"].join(" ")}
      />
      {state || "—"}
    </span>
  );
}

function Actions({ container }: { container: DockerContainer }) {
  const act = useDockerAction();
  const running = (container.State ?? "").toLowerCase() === "running";
  const busy = act.isPending && act.variables?.id === container.ID;
  const btn =
    "flex items-center justify-center gap-1 px-2 h-7 rounded text-[12px] border border-border transition-colors disabled:opacity-40 disabled:pointer-events-none";
  return (
    <span className="flex items-center gap-1.5">
      {running ? (
        <>
          <button
            onClick={() => {
              haptic();
              act.mutate({ id: container.ID, action: "stop" });
            }}
            disabled={busy}
            className={`${btn} text-red-400 hover:bg-red-500/10`}
            aria-label={`Stop ${container.Names}`}
          >
            <Square size={12} /> Stop
          </button>
          <button
            onClick={() => {
              haptic();
              act.mutate({ id: container.ID, action: "restart" });
            }}
            disabled={busy}
            className={`${btn} text-muted hover:bg-white/5`}
            aria-label={`Restart ${container.Names}`}
          >
            <RotateCw size={12} className={busy ? "animate-spin" : ""} /> Restart
          </button>
        </>
      ) : (
        <button
          onClick={() => {
            haptic();
            act.mutate({ id: container.ID, action: "start" });
          }}
          disabled={busy}
          className={`${btn} text-green-400 hover:bg-green-500/10`}
          aria-label={`Start ${container.Names}`}
        >
          <Play size={12} /> Start
        </button>
      )}
    </span>
  );
}

export function DockerPage() {
  const { data, isLoading, refetch, isFetching } = useDocker();
  const [sort, setSort] = useState<{ key: DockerSortKey; dir: SortDir }>({
    key: "State",
    dir: "asc",
  });
  const toggleSort = (key: DockerSortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  const containers = sortContainers(data?.containers ?? [], sort.key, sort.dir);

  return (
    <div className="h-dvh flex flex-col bg-bg overflow-hidden">
      <NavBar />
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <h1 className="flex items-center gap-2 text-text text-sm font-medium">
          <Container size={16} /> Containers{" "}
          {containers.length > 0 && <span className="text-muted">({containers.length})</span>}
        </h1>
        <button
          onClick={() => refetch()}
          aria-label="Refresh"
          className="flex items-center justify-center rounded w-9 h-9 text-muted hover:bg-white/5 active:bg-white/10"
        >
          <RefreshCw size={15} className={isFetching ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading && <div className="p-6 text-center text-[13px] text-muted">Loading…</div>}
        {!isLoading && !data?.available && (
          <div className="p-6 text-center text-[13px] text-muted">
            Docker unavailable{data?.error ? <span className="block mt-1 font-mono text-[12px]">{data.error}</span> : null}
          </div>
        )}
        {!isLoading && data?.available && containers.length === 0 && (
          <div className="p-6 text-center text-[13px] text-muted">No containers</div>
        )}
        {containers.length > 0 && (
          <table className="w-full text-[13px] border-collapse">
            <thead className="sticky top-0 bg-bg">
              <tr className="text-muted text-left">
                <SortHeader column="Names" label="Name" activeColumn={sort.key} dir={sort.dir} onSort={toggleSort} />
                <SortHeader column="Image" label="Image" activeColumn={sort.key} dir={sort.dir} onSort={toggleSort} />
                <SortHeader column="State" label="State" activeColumn={sort.key} dir={sort.dir} onSort={toggleSort} />
                <SortHeader column="Status" label="Status" activeColumn={sort.key} dir={sort.dir} onSort={toggleSort} />
                <th className="px-3 py-2 font-medium">Ports</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {containers.map((c) => (
                <tr key={c.ID} className="border-t border-border align-top">
                  <td className="px-3 py-2 font-mono text-text whitespace-nowrap">{c.Names}</td>
                  <td className="px-3 py-2 text-muted break-all">{c.Image}</td>
                  <td className="px-3 py-2">
                    <StateBadge state={c.State} />
                  </td>
                  <td className="px-3 py-2 text-muted whitespace-nowrap">{c.Status}</td>
                  <td className="px-3 py-2 text-muted font-mono text-[12px] whitespace-nowrap">
                    {formatPorts(c.Ports) || "—"}
                  </td>
                  <td className="px-3 py-2">
                    <Actions container={c} />
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
