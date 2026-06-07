# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — build the React frontend.
# vite.config.ts writes the build to ../internal/server/dist (embedded by Go),
# so inside the container that lands at /app/internal/server/dist.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:24-alpine AS web
WORKDIR /app/web
# Install deps first (cache layer) — only re-runs when the lockfile changes.
COPY web/package.json web/package-lock.json ./
RUN npm ci
# Then the source + build.
COPY web/ ./
RUN npm run build   # → /app/internal/server/dist

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — build the Go binary (static, frontend embedded via embed.FS).
# ─────────────────────────────────────────────────────────────────────────────
FROM golang:1.25-alpine AS build
WORKDIR /app
# Module cache layer.
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
# Source, then overlay the freshly built frontend so embed.FS picks it up.
COPY . .
COPY --from=web /app/internal/server/dist ./internal/server/dist
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /webterm ./cmd/webterm

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3 — runtime. Needs a shell + the tools WebTerm shells out to:
# tmux (sessions), git (status/clone), curl (notify hook + healthcheck).
# tini is PID 1 so PTY/tmux children reap cleanly on signals.
#
# To run interactive `claude` inside the terminal, extend this stage with Node +
# the Claude Code CLI, e.g.:
#   RUN apk add --no-cache nodejs npm && curl -fsSL https://claude.ai/install.sh | bash
# ─────────────────────────────────────────────────────────────────────────────
FROM alpine:3.21 AS runtime
RUN apk add --no-cache tmux git curl ca-certificates bash openssh-client tini \
 && adduser -D -u 1000 webterm \
 && mkdir -p /workspace && chown webterm:webterm /workspace
COPY --from=build /webterm /usr/local/bin/webterm
USER webterm
WORKDIR /workspace
EXPOSE 7070
# --root = where projects live (mount a host dir here). Binds 0.0.0.0 INSIDE the
# container; publish/proxy it yourself and set a token before exposing to a network.
ENV WEBTERM_ADDR=0.0.0.0:7070
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD curl -fsS "http://127.0.0.1:7070/healthz" || exit 1
ENTRYPOINT ["/sbin/tini", "--", "webterm"]
CMD ["--root", "/workspace", "--addr", "0.0.0.0:7070"]
