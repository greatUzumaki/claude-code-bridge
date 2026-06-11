import type { ReactNode, AnchorHTMLAttributes } from "react";
import { navigate } from "../lib/router";

type LinkProps = { to: string; children: ReactNode } & Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "href"
>;

// Client-side link: intercepts plain left-clicks and routes via pushState, while
// letting modified clicks (new tab/window) behave as normal anchors.
export function Link({ to, children, ...rest }: LinkProps) {
  return (
    <a
      href={to}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        navigate(to);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
