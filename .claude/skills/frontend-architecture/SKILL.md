---
name: Frontend Architecture
description: This skill should be used when the user asks to "structure a frontend", "design components", "organize state", "manage state", "choose a rendering strategy", "improve accessibility", "set up a design system", "fix prop drilling", "decide client vs server components", or when building/reviewing UI component boundaries, state management, accessibility, or folder structure. Stack-agnostic principles applicable to React, Vue, Svelte, Angular, or vanilla.
version: 0.1.0
---

# Frontend Architecture

Apply these principles when designing or reviewing how a frontend is structured: component boundaries, state placement, rendering model, accessibility, and project organization. The guidance is framework-agnostic — map each principle to the host framework's primitives.

## Component boundaries

Design components around a single responsibility and a clear contract. The test: can someone use the component from its props/inputs alone without reading its internals, and can the internals change without breaking callers? If not, the boundary is wrong.

- **Separate presentational from container concerns.** Presentational components take data and callbacks as inputs and render markup — no data fetching, no global state access. Container/smart components own fetching, state wiring, and pass data down. This makes presentational components trivially testable and reusable.
- **Props are a contract.** Keep them minimal and typed. Prefer many small specific props over one large opaque config object. Avoid boolean-flag explosion (`isPrimary`, `isLarge`, `isLoading`…) — when flags interact, model the valid states as a single enum/variant prop so impossible combinations cannot be expressed.
- **Composition over configuration.** Expose slots/children/render-props instead of growing a component to handle every case via props. A `Card` that accepts `header`, `body`, `footer` slots beats a `Card` with 20 props.
- **Colocation.** Keep a component's styles, tests, and local helpers next to it. Split a file when it stops fitting in your head — a large component file is a signal it does too much.

## State management

The dominant mistake is putting state too high (forces re-renders and couples unrelated subtrees) or too low (forces lifting and prop drilling later). Place each piece of state at the **lowest common ancestor of its consumers**.

Classify state before choosing a tool — most "state management" pain is misclassification:

- **Server/remote state** — data owned by the backend (lists, entities). This is a *cache*, not state. Use a data-fetching/caching library (query cache with keys, staleness, revalidation). Do NOT hand-roll it in global state; you will reinvent caching, dedup, and invalidation badly.
- **URL state** — current view, selected item, filters, pagination, search. Put it in the URL (path/query params). It is shareable, bookmarkable, and survives refresh for free. Reaching for global state when the URL would do is a common error.
- **Local UI state** — open/closed, hover, form input in progress. Keep it in the component (`useState`/signal/ref). Do not globalize it.
- **Shared client state** — theme, auth session, feature flags, cross-cutting UI. This is the small slice that justifies a global store or context.

Avoid one giant global store. Split by domain. For React specifically: context is for low-frequency, widely-read values (theme, locale) — high-frequency updates through context cause wide re-renders; use a store with selectors instead. See `references/state-patterns.md` for decision trees and anti-patterns.

## Rendering strategy

Choose how and where markup is produced based on the content's freshness and personalization needs, not by habit.

- **Static (SSG / prerender)** — content identical for all users, changes infrequently. Fastest, cacheable at the edge.
- **Server-rendered (SSR)** — per-request HTML; needed for personalized or always-fresh content and good SEO/first paint.
- **Client-rendered (CSR/SPA)** — highly interactive app shells behind auth where SEO/first-paint matter less.
- **Streaming / partial / islands** — send the shell immediately, stream slow parts, hydrate only interactive regions. Default to shipping less JavaScript: server-render what is static, hydrate only what needs interactivity.

The cross-cutting rule: **minimize client JavaScript and avoid hydration of static content.** Pick the lightest strategy that meets the freshness/SEO requirement.

## Accessibility (non-negotiable baseline)

Build accessibility in from the start — retrofitting is far more expensive. Enforce this baseline:

- **Semantic HTML first.** Use `<button>`, `<a>`, `<nav>`, `<main>`, `<label>`, headings in order. A `<div onClick>` is a bug — it loses keyboard focus, role, and Enter/Space handling. Reach for ARIA only to enhance semantics, never to replace them ("no ARIA is better than bad ARIA").
- **Keyboard.** Every interactive element must be reachable and operable by keyboard, with a visible focus indicator. Manage focus on route changes and when opening/closing modals (trap focus, restore on close).
- **Forms.** Every input has an associated `<label>`. Errors are announced and programmatically linked to their field.
- **Contrast & motion.** Meet WCAG AA contrast (4.5:1 text). Respect `prefers-reduced-motion`.
- **Images/icons.** Meaningful images have `alt`; decorative ones have empty `alt`. Icon-only buttons have an accessible name.

See `references/accessibility-checklist.md` for a reviewable checklist and common ARIA patterns.

## Project structure

Organize by **feature/domain, not by file type.** A `users/` folder containing its components, hooks, and tests beats parallel `components/`, `hooks/`, `utils/` trees where one feature is scattered across all of them.

- Keep a `shared/` (or `ui/`) layer for genuinely cross-feature primitives (design-system components, utilities). Resist dumping everything there.
- Enforce dependency direction: features may depend on `shared`, not on each other; `shared` depends on nothing app-specific. This prevents cycles and keeps features independently removable.
- Co-locate tests with the code they test.

## Design systems & styling

- Build on **design tokens** (color, spacing, typography, radius as named values), not magic numbers scattered in components. Tokens enable theming and consistency.
- Establish a primitive component layer (Button, Input, Stack, Text) and compose features from it. Do not let every feature reinvent a button.
- Keep styling decisions consistent project-wide. Whatever the approach (utility classes, CSS modules, CSS-in-JS), apply it uniformly — mixing paradigms fragments the codebase.

## Review heuristics (quick signals of trouble)

- Prop drilling >2-3 levels → state is misplaced or a composition/context is missing.
- A component that both fetches data and renders complex UI → split container from presentation.
- `useEffect`/watchers syncing one piece of state to another → derive it instead; synced state drifts.
- Business logic inside components → extract to hooks/composables/plain functions, test in isolation.
- Re-render storms → unstable references, context overuse, or state too high.

## Additional Resources

- **`references/state-patterns.md`** — state classification decision tree, global-store patterns, derived-state and anti-patterns (effect-as-setter, prop drilling fixes).
- **`references/accessibility-checklist.md`** — reviewable WCAG AA checklist, keyboard/focus patterns, common ARIA recipes (modal, combobox, tabs, disclosure).
