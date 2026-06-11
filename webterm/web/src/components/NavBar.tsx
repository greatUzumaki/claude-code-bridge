import { LayoutDashboard, SquareTerminal, Container, Activity, type LucideIcon } from "lucide-react";
import { useRoute } from "../lib/router";
import { Link } from "./Link";

const items: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/terminal", label: "Terminal", icon: SquareTerminal },
  { to: "/docker", label: "Docker", icon: Container },
  { to: "/process", label: "Processes", icon: Activity },
];

export function NavBar() {
  const path = useRoute();
  return (
    <nav className="flex items-center gap-1 px-3 min-h-12 shrink-0 border-b border-border bg-panel pt-[env(safe-area-inset-top)] overflow-x-auto">
      <span className="text-sm font-semibold text-text mr-2 shrink-0">WebTerm</span>
      {items.map(({ to, label, icon: Icon }) => {
        const active = to === "/" ? path === "/" : path.startsWith(to);
        return (
          <Link
            key={to}
            to={to}
            aria-current={active ? "page" : undefined}
            className={[
              "flex items-center gap-1.5 px-3 h-9 rounded-md text-[13px] whitespace-nowrap transition-colors shrink-0",
              active ? "bg-accent/15 text-accent" : "text-muted hover:bg-white/5 hover:text-text",
            ].join(" ")}
          >
            <Icon size={15} /> {label}
          </Link>
        );
      })}
    </nav>
  );
}
