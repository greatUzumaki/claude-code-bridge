# REST Conventions Reference

## Status code catalog

| Code | Meaning | Use when |
|------|---------|----------|
| 200 | OK | Successful GET/PUT/PATCH; POST that returns a result without creating |
| 201 | Created | Resource created; include `Location` header + the new resource body |
| 202 | Accepted | Async work queued; return a status/polling link |
| 204 | No Content | Successful DELETE or update with nothing to return |
| 301/308 | Moved | Resource permanently relocated (308 preserves method) |
| 304 | Not Modified | Conditional GET hit cache (`If-None-Match`/`ETag`) |
| 400 | Bad Request | Malformed syntax, unparseable body |
| 401 | Unauthorized | Missing/invalid authentication |
| 403 | Forbidden | Authenticated but not permitted |
| 404 | Not Found | Resource absent (or hidden for authz reasons) |
| 405 | Method Not Allowed | Path exists, method does not |
| 409 | Conflict | State/version conflict, duplicate, concurrent edit |
| 410 | Gone | Resource permanently removed (e.g. deprecated endpoint sunset) |
| 422 | Unprocessable | Syntactically valid but semantically invalid (validation) |
| 429 | Too Many Requests | Rate limited; include `Retry-After` |
| 500 | Internal Server Error | Unhandled server fault |
| 502/503/504 | Bad Gateway / Unavailable / Timeout | Upstream or capacity problem |

400 vs 422: use 400 for "I can't parse this" and 422 for "I parsed it but the values are invalid." Pick one convention and apply it consistently.

## Backward-compatibility matrix

| Change | Compatible? | Notes |
|--------|-------------|-------|
| Add new endpoint | ✅ | Always safe |
| Add optional request field | ✅ | Must have a safe default |
| Add response field | ✅ | Clients must ignore unknown fields |
| Add optional query param | ✅ | Default must preserve old behavior |
| Add new enum value (response) | ⚠️ | Safe only if clients tolerate unknown values — document it |
| Add new enum value (request) | ✅ | Accepting more input is additive |
| Make optional field required | ❌ | Breaks existing callers |
| Remove/rename field | ❌ | Breaking |
| Change field type | ❌ | Breaking (e.g. string→object) |
| Tighten validation | ❌ | Previously-valid requests now fail |
| Change default behavior | ❌ | Silent breakage — worst kind |
| Change status code/error code | ❌ | Clients branch on these |
| Remove endpoint | ❌ | Breaking; requires sunset |

The golden rule: **be liberal in what you accept, conservative in what you require, and never silently change behavior.**

## Deprecation workflow

1. **Announce** in changelog/docs with a replacement and a sunset date.
2. **Signal in responses**: `Deprecation: true` and `Sunset: <HTTP-date>` headers; optionally a `Warning` header or a `_meta.deprecated` field.
3. **Measure**: track usage of the deprecated surface per client/key. Do not remove while traffic remains significant.
4. **Reach out** to remaining high-volume consumers directly.
5. **Sunset**: after the window, return `410 Gone` (or `301` to the replacement) — do not just delete and 404.

Give a window proportional to your client base: weeks for internal, months for public APIs.

## Useful headers

| Header | Purpose |
|--------|---------|
| `Idempotency-Key` (req) | Client-generated key; server dedupes retried writes |
| `ETag` / `If-None-Match` | Caching + conditional GET |
| `ETag` / `If-Match` | Optimistic concurrency on writes |
| `Retry-After` | With 429/503 — when to retry |
| `Location` | With 201 — URL of created resource |
| `Cache-Control` | Cacheability of the response |
| `Deprecation` / `Sunset` | Lifecycle signaling |
| `X-Request-Id` / `Traceparent` | Correlation across services and logs |

## Worked examples

**Create with idempotency**
```http
POST /v1/payments
Idempotency-Key: 9f1c...-stable-per-attempt
Content-Type: application/json

{ "amount": 4200, "currency": "usd", "source": "card_x" }
```
```http
201 Created
Location: /v1/payments/pay_01H...
{ "id": "pay_01H...", "status": "succeeded", "amount": 4200 }
```
A retry with the same key returns the same `201` + body, never a second charge.

**Optimistic concurrency**
```http
GET /v1/docs/42  → 200, ETag: "v7"
PUT /v1/docs/42
If-Match: "v7"
```
If the stored version is no longer `v7`: `409 Conflict` with current state.

**Cursor pagination response**
```json
{
  "data": [ { "id": "ord_3" }, { "id": "ord_4" } ],
  "page": { "next_cursor": "b3JkXzQ", "has_more": true }
}
```
Next page: `GET /v1/orders?limit=2&cursor=b3JkXzQ`.
