import { useState } from "react";
import {
  LayoutDashboard,
  SquareTerminal,
  Container,
  Activity,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { useRoute } from "../lib/router";
import { Link } from "./Link";
import { SettingsModal } from "./SettingsModal";
import { haptic } from "../lib/haptics";

const items: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/terminal", label: "Terminal", icon: SquareTerminal },
  { to: "/docker", label: "Docker", icon: Container },
  { to: "/process", label: "Processes", icon: Activity },
];

export function NavBar() {
  const path = useRoute();
  const [showSettings, setShowSettings] = useState(false);
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
      <button
        onClick={() => {
          haptic();
          setShowSettings(true);
        }}
        aria-label="Settings"
        className="ml-auto shrink-0 flex items-center justify-center rounded-md w-9 h-9 text-muted hover:bg-white/5 hover:text-text transition-colors"
      >
        <Settings size={16} />
      </button>
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </nav>
  );
}
