import {
  SquareTerminal,
  Container,
  Activity,
  Cpu,
  MemoryStick,
  Gauge,
  type LucideIcon,
} from "lucide-react";
import { Link } from "./Link";
import { NavBar } from "./NavBar";
import { useHostStats, useProjects } from "../lib/queries";

function Stat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex flex-col gap-1 p-3 rounded-lg border border-border bg-panel">
      <span className="flex items-center gap-1.5 text-muted text-[12px]">
        <Icon size={13} /> {label}
      </span>
      <span className="text-text text-lg font-semibold tabular-nums">{value}</span>
      {sub && <span className="text-muted text-[11px] tabular-nums">{sub}</span>}
    </div>
  );
}

export function Dashboard() {
  const { data: host } = useHostStats();
  const { data: projects } = useProjects();

  const projectCount = projects?.projects?.length ?? 0;

  const cards: { to: string; icon: LucideIcon; title: string; desc: string }[] = [
    {
      to: "/terminal",
      icon: SquareTerminal,
      title: "Terminal",
      desc: `${projectCount} project${projectCount === 1 ? "" : "s"}`,
    },
    { to: "/docker", icon: Container, title: "Docker", desc: "start / stop containers" },
    { to: "/process", icon: Activity, title: "Processes", desc: "running + ports" },
  ];

  return (
    <div className="h-dvh flex flex-col bg-bg overflow-hidden">
      <NavBar />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <h1 className="text-text text-base font-semibold mb-4">Overview</h1>

        <div className="grid grid-cols-3 gap-3 mb-6 max-w-3xl">
          <Stat icon={Cpu} label="CPU" value={host ? `${host.cpuPercent.toFixed(0)}%` : "—"} />
          <Stat
            icon={MemoryStick}
            label="Memory"
            value={host ? `${host.memPercent.toFixed(0)}%` : "—"}
            sub={
              host ? `${(host.memUsedMB / 1024).toFixed(1)} / ${(host.memTotalMB / 1024).toFixed(1)} GB` : undefined
            }
          />
          <Stat icon={Gauge} label="Load (1m)" value={host ? host.load1.toFixed(2) : "—"} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl">
          {cards.map(({ to, icon: Icon, title, desc }) => (
            <Link
              key={to}
              to={to}
              className="flex flex-col gap-2 p-4 rounded-lg border border-border bg-panel hover:border-accent transition-colors"
            >
              <Icon size={22} className="text-accent" />
              <span className="text-text text-[15px] font-medium">{title}</span>
              <span className="text-muted text-[13px]">{desc}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
