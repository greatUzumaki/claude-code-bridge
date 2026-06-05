---
name: API Design
description: This skill should be used when the user asks to "design an API", "design a REST endpoint", "version an API", "design error responses", "add pagination", "make an endpoint idempotent", "design a GraphQL schema", "review an API", or works on HTTP/REST/GraphQL contracts, resource modeling, status codes, pagination, versioning, or backward compatibility. Stack-agnostic principles for any backend.
version: 0.1.0
---

# API Design

Apply these principles when designing or reviewing an HTTP API (REST or GraphQL). An API is a long-lived contract: clients depend on its exact shape, so design for evolution and treat backward compatibility as a hard constraint once published.

## Resource modeling (REST)

Model APIs around **resources (nouns)**, not actions (verbs). The HTTP method is the verb.

- Use plural nouns for collections: `/orders`, `/orders/{id}`, `/orders/{id}/items`.
- Map methods to semantics: `GET` (read, safe, idempotent), `POST` (create / non-idempotent action), `PUT` (replace, idempotent), `PATCH` (partial update), `DELETE` (remove, idempotent).
- Avoid verbs in paths (`/createOrder`, `/getUser`). The few legitimate exceptions are true RPC-style actions that are not CRUD (`POST /orders/{id}/cancel`, `POST /search`) — model these as a sub-resource or a clearly-named action, sparingly.
- Keep nesting shallow (max ~2 levels). Deep nesting (`/a/{}/b/{}/c/{}/d`) is rigid; prefer top-level resources with filter params and links.

## HTTP status codes — use them correctly

Returning `200` with `{"error": ...}` in the body is the single most common API mistake. The status code IS part of the contract; clients and proxies act on it.

- `200` OK, `201` Created (return the created resource + `Location`), `202` Accepted (async), `204` No Content (successful delete/empty).
- `400` malformed request, `401` not authenticated, `403` authenticated but not authorized, `404` not found, `409` conflict (e.g. version/state), `422` semantic validation failure, `429` rate limited (with `Retry-After`).
- `500` unexpected server fault, `502/503/504` upstream/availability. Never return `5xx` for client mistakes, never return `2xx` for failures.

## Error responses — consistent and actionable

Use one error envelope across the whole API. A machine-readable `code` plus a human `message` plus field-level details:

```json
{
  "error": {
    "code": "validation_failed",
    "message": "The request body is invalid.",
    "details": [
      { "field": "email", "code": "invalid_format", "message": "Must be a valid email." }
    ],
    "request_id": "req_01H..."
  }
}
```

- `code` is a stable enum clients can branch on — never make clients parse `message`.
- Always include a `request_id`/correlation id so a client error maps to a server log line.
- Do not leak stack traces, SQL, or internal hostnames in production error bodies.

## Pagination, filtering, sorting

Never return an unbounded collection. Paginate every list endpoint from day one.

- **Cursor (keyset) pagination** is the default for large or changing datasets: stable under inserts, scales without `OFFSET` scans. Return an opaque `next_cursor`.
- **Offset/limit** is acceptable only for small, mostly-static datasets where page numbers matter to users.
- Filtering via query params (`?status=active&created_after=...`); sorting via `?sort=-created_at`. Document allowed fields; reject unknown ones rather than ignoring silently.
- Return pagination metadata consistently (e.g. `{ "data": [...], "page": { "next_cursor": "...", "has_more": true } }`).

## Versioning & backward compatibility

Pick a versioning strategy before launch and commit to it. URL versioning (`/v1/...`) is the most operationally simple and visible; header/media-type versioning is cleaner but harder to debug and cache. Whatever you choose, the discipline matters more than the mechanism.

**Backward-compatible (safe) changes** — do NOT require a version bump:
- Adding a new endpoint, a new optional request field, or a new response field.
- Adding a new optional query param with a safe default.

**Breaking changes** — require a new version + deprecation window:
- Removing/renaming a field or endpoint, changing a field's type, making an optional field required, changing default behavior, changing error codes/semantics.

Rules: clients must tolerate unknown response fields (document this). Deprecate before removing — announce, set a sunset date, emit a `Deprecation`/`Sunset` header, monitor usage, then remove. See `references/rest-conventions.md` for the full compatibility matrix.

## Idempotency & concurrency

- Make unsafe operations safe to retry. For `POST` that creates resources, accept an **`Idempotency-Key`** header and dedupe server-side so a retried request returns the original result instead of creating duplicates.
- Use optimistic concurrency for updates: return an `ETag`/version on read, require `If-Match`/version on write, return `409` on mismatch. Prevents lost updates.

## Security baseline (API)

- Authenticate every non-public endpoint; authorize per-resource (check the caller owns/may access THIS id, not just that they are logged in — broken object-level authorization is the top API vulnerability).
- Validate and constrain all input at the boundary (types, ranges, lengths, enums). Reject unknown fields where strictness matters.
- Rate-limit and return `429` + `Retry-After`. Set sane payload size limits.
- Never put secrets/PII in URLs (they land in logs); use headers/body. Always TLS.

## GraphQL specifics

- Design the schema around client needs and domain types, not as a 1:1 mirror of database tables.
- Use a consistent nullability discipline; prefer non-null where a value is guaranteed.
- Paginate connections (Relay-style `edges`/`pageInfo` cursors) rather than returning raw lists.
- Mutations return a payload type with the affected entity and a typed `userErrors` array — surface domain errors in the schema, not only as top-level GraphQL errors.
- Guard against expensive queries: depth limiting, complexity scoring, and persisted queries. Beware N+1 — batch with a dataloader.

## Review heuristics

- Verbs in paths, or `200` wrapping an error → resource/status model is wrong.
- Unpaginated list endpoint → will break at scale.
- Inconsistent error shapes across endpoints → clients can't handle errors generically.
- No idempotency on create → duplicate resources on retry.
- Authorization checks that verify login but not ownership → IDOR vulnerability.

## Additional Resources

- **`references/rest-conventions.md`** — status-code catalog, full backward-compat matrix, deprecation workflow, header reference, and worked request/response examples.
