---
name: CI/CD Pipelines
description: This skill should be used when the user asks to "set up CI/CD", "design a pipeline", "write a GitHub Actions/GitLab CI workflow", "speed up the build", "add a deploy stage", "choose a deployment strategy", "set up blue-green or canary deploys", "add a rollback", or works on continuous integration, continuous delivery/deployment, build/test/deploy automation, or release gating. Stack- and platform-agnostic principles.
version: 0.1.0
---

# CI/CD Pipelines

Apply these principles when designing or reviewing a continuous integration / delivery pipeline. The pipeline is the path from commit to production: it must be **fast, reliable, and safe**. A flaky or slow pipeline trains the team to ignore it — protect those properties deliberately.

## Pipeline stages (canonical order)

Structure the pipeline as ordered stages, failing fast and cheapest first so feedback is quick:

1. **Lint / static analysis / format check** — seconds; catches trivial issues before spending compute.
2. **Build / compile** — produce the artifact once.
3. **Unit tests** — fast, isolated, run in parallel.
4. **Integration / component tests** — slower; need services (DB, queues) via ephemeral containers.
5. **Security & quality gates** — dependency scan (SCA), SAST, secret scan, license check, coverage threshold.
6. **Package** — build the immutable artifact (container image, binary, bundle) and tag it.
7. **Deploy to staging** — automatic.
8. **End-to-end / smoke tests** — against staging.
9. **Deploy to production** — automatic (CD) or gated by approval (continuous delivery).

Order cheap/fast checks before expensive ones. A 3-second lint failure should not wait behind a 10-minute test suite.

## Build once, promote the same artifact

The cardinal rule: **build the artifact exactly once, then promote that identical artifact through environments.** Never rebuild per environment — rebuilding can produce a different binary, so what you tested is not what you ship.

- Configuration differs per environment, not the artifact. Inject config/secrets at deploy time (env vars, mounted config), keeping the image immutable.
- Tag artifacts immutably (git SHA or semver). `latest` is not a deployable reference — it is ambiguous and unrepeatable.

## Speed (protect fast feedback)

Slow pipelines kill productivity and tempt people to skip them.

- **Cache aggressively** — dependencies, build layers, compiled outputs, test fixtures. Key caches on lockfile/content hashes.
- **Parallelize** — run independent jobs concurrently; shard large test suites across runners.
- **Run only what changed** where safe (affected packages in a monorepo) — but ensure correctness (a shared change must trigger dependents).
- **Fail fast** — stop the pipeline on first hard failure; don't waste minutes after a compile error.
- Target keeping the PR feedback loop under ~10 minutes. Measure pipeline duration as a tracked metric.

## Reliability (no flaky pipelines)

A flaky pipeline is worse than no pipeline — it trains the team to re-run until green, masking real failures.

- Hunt and fix flaky tests; quarantine them out of the blocking path until fixed, and track them. Do not normalize "just re-run it."
- Make jobs deterministic: pin tool/runtime versions, pin dependency versions (lockfiles), avoid reliance on wall-clock/network/ordering.
- Use ephemeral, isolated environments per run (fresh containers) so state from a prior run can't leak.

## Deployment strategies

Choose based on risk tolerance and rollback needs (full detail and trade-offs in `references/deployment-strategies.md`):

- **Rolling** — replace instances gradually. Default for stateless services; no extra capacity needed, but mixed versions run simultaneously.
- **Blue-green** — run two identical environments; switch traffic all at once; keep the old one warm for instant rollback. Needs double capacity briefly.
- **Canary** — route a small % of traffic to the new version, watch metrics, then ramp. Best risk control; needs traffic-splitting and good monitoring.
- **Feature flags** — decouple deploy from release; ship code dark, enable for cohorts, kill instantly without redeploy.

Whatever the strategy, **every deploy must have a defined, tested rollback path.** A deploy you cannot reverse is a liability.

## Safety gates & secrets

- **Protect production**: require green checks + review approval before prod deploy. Use environment protection rules / required reviewers for the prod environment.
- **Secrets**: never hardcode in pipeline files or commit them. Use the platform secret store / OIDC short-lived credentials. Mask secrets in logs. Prefer keyless OIDC federation over long-lived static cloud keys.
- **Least privilege**: pipeline credentials scoped to exactly what the job needs. A test job does not need prod deploy keys.
- **Supply chain**: pin third-party actions/orbs to a full commit SHA (not a moving tag), generate an SBOM, and verify checksums of downloaded tooling.

## Quality gates

Encode standards as automated gates so they can't be skipped:
- Test coverage threshold (with sane floor; don't chase 100%).
- Dependency vulnerability scan (fail on high/critical).
- Secret scanning on the diff.
- Build/bundle size budgets where relevant.

## Review heuristics

- Rebuilding the artifact per environment → promote one artifact instead.
- `latest` or branch-name as the deployed reference → use immutable SHA/semver tags.
- Secrets in workflow YAML or echoed to logs → move to secret store, mask.
- No rollback plan / no health-check gate on deploy → add automated verification + revert path.
- Third-party actions pinned to `@v3` (mutable) → pin to a commit SHA.
- Serial jobs that could run in parallel; no caching → speed wins available.

## Additional Resources

- **`references/deployment-strategies.md`** — detailed comparison of rolling/blue-green/canary/feature-flag with trade-offs, rollback mechanics, health-check gating, and database-migration-with-deploy patterns (expand/contract).
