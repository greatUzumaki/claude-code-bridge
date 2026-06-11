import { useRoute } from "./lib/router";
import { TerminalApp } from "./components/TerminalApp";
import { Dashboard } from "./components/Dashboard";
import { DockerPage } from "./components/DockerPage";
import { ProcessPage } from "./components/ProcessPage";

export default function App() {
  const path = useRoute();
  if (path.startsWith("/terminal")) return <TerminalApp />;
  if (path.startsWith("/docker")) return <DockerPage />;
  if (path.startsWith("/process")) return <ProcessPage />;
  return <Dashboard />;
}
