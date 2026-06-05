---
name: Container Orchestration
description: This skill should be used when the user asks to "write a Dockerfile", "optimize a Docker image", "reduce image size", "do a multi-stage build", "harden a container", "write Kubernetes manifests", "set up health checks/probes", "configure resource limits", "set up a deployment", or works on Docker, container images, or Kubernetes/orchestration. Stack-agnostic container best practices.
version: 0.1.0
---

# Container Orchestration

Apply these principles when building container images or deploying to an orchestrator (Kubernetes or similar). Containers should be **small, immutable, secure, and stateless**. Most production container pain traces back to violating one of those four.

## Image building — small and secure

A bloated image is slow to build, push, pull, and scan — and carries more attack surface. Optimize relentlessly:

- **Multi-stage builds.** Build/compile in a fat builder stage; copy only the resulting artifact into a minimal runtime stage. The toolchain, dev dependencies, and source never reach the final image.
- **Minimal base image.** Prefer `distroless`, `alpine`, or a slim variant over a full OS image. Less in the image = fewer CVEs and smaller size. Match the base to the runtime's actual needs.
- **Pin base image versions** by digest or specific tag, not `latest` — reproducibility and supply-chain safety.
- **Order layers by change frequency.** Copy dependency manifests and install dependencies *before* copying source code, so the dependency layer caches across code changes. Putting `COPY . .` early invalidates the cache on every edit.
- **Minimize layers and clean up in the same layer.** Removing files in a later `RUN` does not shrink earlier layers — clean package caches in the same `RUN` that created them.
- **Use `.dockerignore`** to keep build context (and secrets, `.git`, `node_modules`) out of the image.

## Image security — non-negotiable baseline

- **Run as non-root.** Create and switch to an unprivileged user (`USER appuser`). A container running as root is a privilege-escalation risk if breached.
- **No secrets in images.** Never `COPY`/`ENV` secrets into layers — they persist in image history even if "removed" later. Inject at runtime (env from secret store, mounted files, build secrets `--mount=type=secret`).
- **Scan images** for vulnerabilities in CI (Trivy/Grype); fail on high/critical.
- **Read-only root filesystem** at runtime where possible; mount writable volumes only where needed.
- **Drop capabilities** to the minimum; never run `--privileged` unless genuinely required.
- Prefer official/verified base images; pin by digest.

## Container design — the contract

- **One concern per container.** A container runs one main process (PID 1). Don't pack app + database + cron into one image — compose them as separate containers.
- **Stateless.** Containers are ephemeral and replaceable. Persist state externally (databases, object storage, volumes), never in the container's writable layer.
- **Config via environment.** Read configuration from env vars / mounted config (12-factor). The same image runs in every environment, differing only by injected config.
- **Handle signals.** The process must handle `SIGTERM` for graceful shutdown (drain connections, finish in-flight work) within the grace period. Ensure PID 1 forwards signals (use an init like `tini` if the entrypoint is a shell).
- **Log to stdout/stderr.** Let the platform collect logs; don't write log files inside the container.

## Kubernetes essentials

When deploying to Kubernetes (concepts map to other orchestrators):

- **Health probes** — define all three appropriately:
  - *Liveness*: is the process wedged? Restart if it fails. Keep it cheap and dependency-free (don't fail liveness because a downstream DB is down — that causes restart storms).
  - *Readiness*: can it serve traffic now? Remove from the load balancer if not (e.g. still warming up, dependency unavailable).
  - *Startup*: for slow-starting apps, gate liveness until startup completes so a slow boot isn't killed.
- **Resource requests & limits** — always set CPU/memory requests (for scheduling) and limits (to cap blast radius). Without requests the scheduler can't place pods sanely; without memory limits one pod can OOM the node. Be careful with CPU limits — aggressive throttling hurts latency.
- **Multiple replicas + PodDisruptionBudget** — run ≥2 replicas for availability; a PDB prevents voluntary disruptions (node drains) from taking down all replicas at once.
- **Rolling updates** — configure `maxSurge`/`maxUnavailable`; ensure readiness probes gate the rollout so traffic only hits ready pods.
- **Config & secrets** — `ConfigMap` for config, `Secret` for sensitive data (and enable encryption-at-rest / external secret operators; base64 is encoding, not encryption).
- **Don't store state in pods** — use `StatefulSet` + `PersistentVolume` for genuinely stateful workloads, and understand the operational cost.

## Networking & access

- Expose services through the orchestrator's service/ingress abstractions, not hardcoded pod IPs.
- Apply network policies to restrict pod-to-pod traffic to what's needed (default-deny is a strong posture).
- Use least-privilege service accounts; don't mount the default token if the pod doesn't call the API server.

## Review heuristics

- Single-stage image shipping the whole toolchain → multi-stage, copy only the artifact.
- Image based on full OS / `:latest` → slim/distroless + pinned digest.
- Running as root, secrets baked into layers → non-root user, runtime secret injection.
- `COPY . .` before dependency install → reorder for layer caching.
- No liveness/readiness probes, no resource requests/limits → add them.
- Single replica for a user-facing service → scale to ≥2 + PDB.
- App writes state/logs to local filesystem → externalize.

## Additional Resources

- **`references/dockerfile-and-k8s.md`** — annotated multi-stage Dockerfile, `.dockerignore` example, a production Deployment manifest with probes/limits/securityContext, and a layer-caching/image-size troubleshooting guide.
