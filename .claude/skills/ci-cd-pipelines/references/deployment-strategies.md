# Deployment Strategies Reference

## Comparison

| Strategy | How | Rollback | Extra cost | Mixed versions? | Best for |
|----------|-----|----------|-----------|-----------------|----------|
| **Recreate** | Stop old, start new | Redeploy old | None | No (downtime) | Dev/internal tools where downtime is OK |
| **Rolling** | Replace instances batch by batch | Roll back batches | None | Yes (transient) | Default stateless services |
| **Blue-green** | Two full envs, switch traffic | Flip back instantly | ~2× during cutover | No | Low-risk instant rollback; stateful cutovers |
| **Canary** | Small % to new, ramp on healthy metrics | Stop ramp, shift back | Slight | Yes | High-risk changes, large user base |
| **Feature flag** | Deploy dark, toggle release | Toggle off | None | Code yes, feature no | Decoupling deploy from release; gradual rollout |

## Rolling
- Configure `maxSurge` (extra instances allowed) and `maxUnavailable` (how many can be down) to balance speed vs capacity.
- Requires backward/forward-compatible changes since old + new run together during the roll.
- Rollback = roll the previous version forward; not instantaneous.

## Blue-green
1. Deploy new version to the idle ("green") environment.
2. Run smoke tests against green directly.
3. Switch the load balancer / DNS / router from blue to green.
4. Keep blue warm for a defined window for instant rollback (flip back).
5. Decommission blue after confidence window.
- Watch for stateful concerns: sessions, in-flight jobs, DB connections. Drain connections on cutover.

## Canary
1. Deploy new version alongside old.
2. Route a small slice (1–5%) of traffic to it.
3. Compare key metrics (error rate, latency, saturation, business KPIs) against the baseline — automate this comparison where possible.
4. If healthy, ramp (5%→25%→50%→100%); if not, halt and shift traffic back.
- Requires traffic splitting (service mesh / LB / ingress) and trustworthy real-time monitoring. Automated analysis (e.g. a canary-analysis controller) reduces human error.

## Feature flags
- Deploy code disabled; enable per environment, user cohort, or percentage at runtime.
- Decouples "deploy" (ship the binary) from "release" (expose the feature) — the two biggest risk events are separated.
- Kill switch: disable a misbehaving feature instantly without a redeploy.
- Discipline: flags are tech debt. Track them, set removal dates, clean up stale flags. A codebase full of dead flags is its own hazard.

## Health-check gating (apply to every strategy)
After deploy, automatically verify before declaring success / before ramping:
- **Liveness/readiness**: instances report healthy.
- **Smoke tests**: critical user paths return expected results.
- **Metric guardrails**: error rate and latency within thresholds vs the prior baseline for N minutes.
Wire failure of these to automatic rollback or halt — don't rely on a human watching a dashboard.

## Database migrations with zero-downtime deploys

The hard part: schema and code deploy at different instants while both versions run. Use **expand/contract (parallel change)**:

1. **Expand** — make an additive, backward-compatible schema change (add nullable column / new table / new index). Old code still works.
2. **Migrate code** — deploy code that writes to both old and new shape, reads new with fallback. Backfill data.
3. **Contract** — once all instances use the new shape and backfill is done, remove the old column/code in a later deploy.

Rules:
- Never combine an additive and a destructive migration in one step.
- Make migrations idempotent and reversible where possible.
- Run migrations as an explicit pipeline step, gated, before/independent of the app rollout depending on direction.
- A column rename is a 3-step expand/contract, never an in-place rename, under zero-downtime.

## Rollback principles
- Every deploy must have a rehearsed rollback. Test it, don't assume it.
- Prefer "roll forward" with a fix when rollback is risky (e.g. after irreversible migration), but always have a reversal for the common case.
- Keep the previous artifact readily redeployable (immutable tags make this trivial).
