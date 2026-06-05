# Web Performance Optimization Playbook

## Metric → likely cause → fix

### LCP > 2.5s
| Symptom | Cause | Fix |
|---------|-------|-----|
| High TTFB | Slow server/origin | Edge-cache HTML, reduce server work, stream response |
| Long gap before LCP paint | Render-blocking CSS/JS | Inline critical CSS, defer rest, `async`/`defer` JS |
| LCP image loads late | Not prioritized / lazy-loaded | `fetchpriority="high"`, `preload`, remove `loading=lazy` from LCP |
| Heavy hero image | Oversized/unoptimized | AVIF/WebP, responsive `srcset`, compress |
| CSR delay | Client renders content | SSR/SSG the above-the-fold content |

### INP > 200ms
| Symptom | Cause | Fix |
|---------|-------|-----|
| Janky on click | Long main-thread tasks | Break tasks, yield (`scheduler.yield()`), chunk work |
| Slow first interaction | Too much JS / heavy hydration | Code-split, lazy-hydrate, islands |
| Sluggish scroll/type | Unthrottled handlers, layout thrash | Debounce/throttle, batch DOM reads/writes |
| CPU-bound UI | Heavy compute on main thread | Move to Web Worker |

### CLS > 0.1
| Symptom | Cause | Fix |
|---------|-------|-----|
| Image pop-in shift | No reserved dimensions | `width`/`height` or `aspect-ratio` |
| Text reflow | Font swap | `font-display: optional`, metrics-matched fallback w/ `size-adjust` |
| Content jumps down | Async content injected above | Reserve space; insert below or in a fixed slot |
| Late banner/ad | Unreserved dynamic slot | Pre-size the container |

## Caching header recipes

```
# Content-hashed static asset (app.7f3a9b.js) — cache forever
Cache-Control: public, max-age=31536000, immutable

# HTML — always revalidate, serve fast meanwhile
Cache-Control: public, max-age=0, must-revalidate
# or, for instant repeat loads:
Cache-Control: public, s-maxage=60, stale-while-revalidate=86400

# User-specific/private
Cache-Control: private, no-cache

# API GET that rarely changes
Cache-Control: public, max-age=300, stale-while-revalidate=3600
```

Pair with `ETag` so revalidation is cheap (`304 Not Modified` when unchanged).

## Image checklist
- [ ] Modern format (AVIF first, WebP fallback, then JPEG/PNG)
- [ ] Responsive `srcset` + `sizes` for varied viewports
- [ ] Explicit `width`/`height` or `aspect-ratio` (prevents CLS)
- [ ] LCP image: eager + `fetchpriority="high"` + preload
- [ ] Below-fold: `loading="lazy"` + `decoding="async"`
- [ ] Compressed (quality ~75–85 is usually indistinguishable)

## Font checklist
- [ ] Subset to used characters/languages
- [ ] Self-host or `preconnect` to font origin
- [ ] `preload` the critical (above-the-fold) font
- [ ] `font-display: optional|swap`
- [ ] Metrics-matched fallback (`size-adjust`, `ascent-override`) to cut swap shift
- [ ] WOFF2 format

## JS bundle checklist
- [ ] Route-based code splitting
- [ ] Lazy-load below-fold + interaction-triggered components
- [ ] Tree-shaking enabled; no dead code
- [ ] Audit largest dependencies; replace/lighten
- [ ] Brotli/gzip compression on
- [ ] Avoid shipping polyfills to modern browsers (differential serving)

## CI performance budget (example, Lighthouse CI)

```json
{
  "ci": {
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }],
        "total-byte-weight": ["warn", { "maxNumericValue": 1600000 }],
        "resource-summary:script:size": ["error", { "maxNumericValue": 350000 }]
      }
    }
  }
}
```

Run on every PR against a representative URL; fail the build on regression. A budget that doesn't block merges gets ignored.

## Measurement tools
- **Field (RUM):** Chrome UX Report (CrUX), `web-vitals` JS library, your APM.
- **Lab:** Lighthouse, WebPageTest (filmstrip + waterfall), Chrome DevTools Performance + Coverage tabs.
- **Bundle:** source-map-explorer / bundle analyzer to see what's actually shipped.

Always compare before/after on the same conditions (network throttle, device class). An "optimization" without a measured delta is a guess.
