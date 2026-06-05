---
name: Web Performance
description: This skill should be used when the user asks to "improve web performance", "fix Core Web Vitals", "improve LCP/CLS/INP", "reduce bundle size", "make the site faster", "fix slow page load", "set a performance budget", "optimize images/fonts", "fix layout shift", or works on loading speed, rendering performance, caching, or asset optimization. Stack-agnostic principles for any web frontend.
version: 0.1.0
---

# Web Performance

Apply these principles when diagnosing or improving the loading and runtime performance of a web page. Performance is a feature with direct revenue/SEO impact. Always **measure first, optimize the bottleneck, measure again** — never optimize on intuition.

## Core Web Vitals — the targets

Optimize for the three user-centric metrics Google measures (use the 75th-percentile field value, not lab-only):

- **LCP (Largest Contentful Paint)** ≤ 2.5s — when the main content appears. Usually the hero image or headline.
- **INP (Interaction to Next Paint)** ≤ 200ms — responsiveness to clicks/taps/keypresses. Replaced FID. Driven by main-thread blocking.
- **CLS (Cumulative Layout Shift)** ≤ 0.1 — visual stability; content jumping during load.

Supporting metrics: TTFB (server response), FCP (first paint), TBT (lab proxy for INP).

## Diagnose before optimizing

1. **Field data** (real users): Chrome UX Report / RUM. Tells you what actually hurts users.
2. **Lab data** (reproducible): Lighthouse, WebPageTest, DevTools Performance panel. Tells you why.
3. Identify the single biggest contributor to the worst metric. Fix that. Re-measure. Repeat. Resist shotgun optimization — most "optimizations" applied blindly add complexity for no measurable gain.

## Fixing LCP (load speed)

LCP is usually slow due to: slow TTFB, render-blocking resources, slow resource load, or client-side rendering delay.

- **Prioritize the LCP resource.** Preload the hero image/font (`<link rel="preload">`); set `fetchpriority="high"` on the LCP image. Never lazy-load the LCP image.
- **Eliminate render-blocking.** Inline critical CSS, defer non-critical CSS, `defer`/`async` non-critical JS. Reduce the critical request chain.
- **Serve fast.** Cache HTML at the edge/CDN where possible; reduce server work; use streaming/early flush so the browser starts work sooner.
- **Right-size the LCP image** (see assets below). A 2MB hero is the most common LCP killer.

## Fixing INP / runtime responsiveness

INP is hurt by long tasks blocking the main thread when the user interacts.

- **Break up long tasks** (>50ms). Yield to the main thread (`scheduler.yield()`, `setTimeout`, chunking). Defer non-urgent work.
- **Ship less JavaScript.** The fastest script is the one you don't send. Code-split by route; lazy-load below-the-fold and interaction-triggered components.
- **Move heavy compute off the main thread** (Web Workers) for parsing, crunching, image work.
- **Avoid hydration of static content**; hydrate only interactive islands.
- Debounce/throttle high-frequency handlers; avoid layout thrashing (batch DOM reads then writes).

## Fixing CLS (visual stability)

- **Always reserve space** for images, video, ads, embeds: set `width`/`height` attributes or `aspect-ratio` so the browser reserves the box before load.
- **Reserve space for dynamic content** (banners, async-loaded UI). Don't inject content above existing content.
- **Prevent font swap shift.** Use `font-display: optional` or `swap` with a metrics-matched fallback (`size-adjust`) so the fallback occupies the same space.
- Use CSS transforms for animation (compositor), not properties that trigger layout (top/left/width/height).

## Asset optimization

**Images** (typically the largest payload):
- Serve modern formats (AVIF/WebP) with fallbacks. Compress appropriately.
- Serve **responsive images** (`srcset`/`sizes`) so mobile doesn't download desktop-sized images.
- Lazy-load below-the-fold images (`loading="lazy"`); eager-load the LCP image.

**Fonts:**
- Subset to used glyphs; self-host or preconnect to the font origin; preload the critical font.
- Use `font-display` to avoid invisible text (FOIT) and minimize shift.

**JavaScript & CSS:**
- Minify, compress (Brotli/gzip), tree-shake. Remove dead code and unused dependencies.
- Audit bundle composition; replace heavy libraries with lighter ones or native APIs. A date library or moment-sized dependency is often the biggest single win.

## Caching strategy

Caching is the highest-leverage performance lever — it removes work entirely.

- **Static assets:** content-hashed filenames + `Cache-Control: public, max-age=31536000, immutable`. The hash changes on content change, so cache forever safely.
- **HTML:** short or no cache, or `stale-while-revalidate` so users get instant cached responses while revalidating in the background.
- **CDN:** serve assets and cacheable HTML from the edge, close to users. Use `ETag`/`Last-Modified` for conditional revalidation.
- **Application caching:** cache expensive computed/fetched data with explicit invalidation (tags/keys). See `references/optimization-playbook.md`.

## Performance budgets

Prevent regressions by setting and enforcing budgets in CI:
- Total JS (e.g. ≤ 170KB compressed on the critical path), total page weight, request count, and metric thresholds (LCP/INP/CLS).
- Fail the build (or warn loudly) when a budget is exceeded. Without enforcement, performance erodes one PR at a time.

## Review heuristics

- LCP image lazy-loaded, or no `width`/`height` on images → quick LCP/CLS wins.
- Large render-blocking JS/CSS in `<head>` → defer/split.
- A single huge dependency in the bundle → replace or lazy-load.
- No CDN / no immutable caching on hashed assets → easy wins.
- "Optimizations" with no before/after measurement → unjustified complexity.

## Additional Resources

- **`references/optimization-playbook.md`** — metric-by-metric diagnosis→fix tables, caching header recipes, image/font checklists, and a CI budget example.
