import { useEffect, useState } from "react";

// Minimal path-based router. The Go static handler already serves index.html for
// unknown non-API paths (SPA fallback), so pushState navigation just works — no
// need to pull in react-router for four routes. The <Link> component lives in
// components/Link.tsx so this module stays a pure (component-free) hook/util
// boundary for React Fast Refresh.

export function useRoute(): string {
  const [path, setPath] = useState(() => window.location.pathname);
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  return path;
}

export function navigate(to: string): void {
  if (to === window.location.pathname) return;
  window.history.pushState(null, "", to);
  // pushState doesn't emit popstate; nudge useRoute subscribers manually.
  window.dispatchEvent(new PopStateEvent("popstate"));
}
