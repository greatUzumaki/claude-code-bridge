# Dockerfile & Kubernetes Reference

## Annotated multi-stage Dockerfile (compiled language pattern)

```dockerfile
# ---- Build stage: full toolchain, never shipped ----
FROM golang:1.22@sha256:<digest> AS build
WORKDIR /src
# Dependency layer first — caches across source changes
COPY go.mod go.sum ./
RUN go mod download
# Source last — invalidating this layer doesn't redo dep install
COPY . .
RUN CGO_ENABLED=0 go build -o /app/server ./cmd/server

# ---- Runtime stage: minimal, no toolchain ----
FROM gcr.io/distroless/static:nonroot@sha256:<digest>
COPY --from=build /app/server /server
USER nonroot:nonroot          # non-root
EXPOSE 8080
ENTRYPOINT ["/server"]        # exec form → process is PID 1, gets SIGTERM
```

## Interpreted language pattern (Node example)

```dockerfile
FROM node:20-slim@sha256:<digest> AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev          # prod deps only, cached on lockfile

FROM node:20-slim@sha256:<digest> AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM gcr.io/distroless/nodejs20-debian12@sha256:<digest>
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
USER nonroot
CMD ["dist/server.js"]
```

Key points: dependencies installed in their own cached layer; only `node_modules` (prod) + built output reach the final distroless image; runs non-root.

## Build-time secrets (never bake into layers)

```dockerfile
# syntax=docker/dockerfile:1
RUN --mount=type=secret,id=npmrc \
    NPM_TOKEN=$(cat /run/secrets/npmrc) npm ci
```
Build with `docker build --secret id=npmrc,src=$HOME/.npmrc .` — the secret is never written to a layer.

## .dockerignore

```
.git
node_modules
dist
*.log
.env
.env.*
**/__pycache__
Dockerfile
.dockerignore
README.md
```
Keeps the build context small and prevents secrets/`.git` from leaking into the image.

## Production Deployment manifest (Kubernetes)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 3
  selector:
    matchLabels: { app: api }
  strategy:
    type: RollingUpdate
    rollingUpdate: { maxSurge: 1, maxUnavailable: 0 }   # no capacity loss during roll
  template:
    metadata:
      labels: { app: api }
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 10001
        fsGroup: 10001
      containers:
        - name: api
          image: registry.example.com/api@sha256:<digest>   # immutable digest
          ports: [{ containerPort: 8080 }]
          envFrom:
            - configMapRef: { name: api-config }
            - secretRef: { name: api-secrets }
          resources:
            requests: { cpu: "100m", memory: "128Mi" }       # for scheduling
            limits:   { memory: "256Mi" }                    # cap blast radius (note: CPU limit often omitted)
          readinessProbe:                                    # gates traffic + rollout
            httpGet: { path: /healthz/ready, port: 8080 }
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:                                     # restarts if wedged (cheap, no deps)
            httpGet: { path: /healthz/live, port: 8080 }
            periodSeconds: 15
            failureThreshold: 3
          startupProbe:                                      # protects slow boot
            httpGet: { path: /healthz/live, port: 8080 }
            failureThreshold: 30
            periodSeconds: 2
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities: { drop: ["ALL"] }
          volumeMounts:
            - { name: tmp, mountPath: /tmp }                 # writable scratch w/ RO rootfs
      volumes:
        - name: tmp
          emptyDir: {}
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata: { name: api-pdb }
spec:
  minAvailable: 2
  selector:
    matchLabels: { app: api }
```

### Probe design notes
- **Liveness must not depend on downstream services.** If liveness checks the DB and the DB blips, every pod restarts simultaneously — a self-inflicted outage. Check only "is this process responsive."
- **Readiness should reflect ability to serve** — fail it (without restarting) when a dependency is unavailable so the pod leaves rotation but isn't killed.
- **Startup probe** lets slow-booting apps avoid liveness kills during init; once it passes, liveness takes over.

## Troubleshooting

**Image too big**
- `docker history <image>` — find the fat layers.
- Toolchain in final image? → multi-stage, copy only the artifact.
- Full base image? → switch to slim/distroless.
- Package caches not cleaned in the same RUN? → clean inline (`apt-get ... && rm -rf /var/lib/apt/lists/*`).

**Cache never hits / slow rebuilds**
- `COPY . .` before dependency install → move dep manifests + install above source copy.
- Build context huge → add `.dockerignore`.

**Container exits / restarts**
- `OOMKilled` (exit 137) → memory limit too low or a leak; raise limit or fix.
- Killed on deploy → not handling `SIGTERM`, or shell-form entrypoint not forwarding signals → use exec form / `tini`.
- CrashLoopBackOff → check `kubectl logs --previous`; often config/secret missing or failing liveness too early (add/extend startup probe).

**Throttled / slow under load**
- Aggressive CPU limit → CFS throttling; raise or drop the CPU limit, keep requests.
