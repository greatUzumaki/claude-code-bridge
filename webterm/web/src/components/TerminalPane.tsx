import { useRef, useState, useEffect } from "react";
import { useTerminal } from "../hooks/useTerminal";

export function TerminalPane({
  projectId,
  n,
}: {
  projectId: string;
  n?: number;
}) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => setEl(ref.current), []);
  useTerminal(projectId, n, el);
  return <div ref={ref} className="h-full w-full" style={{ background: "var(--bg)" }} />;
}
