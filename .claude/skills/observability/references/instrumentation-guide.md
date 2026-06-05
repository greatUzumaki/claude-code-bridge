# Instrumentation Guide

## Structured log schema

```json
{
  "timestamp": "2026-06-04T10:00:01.123Z",
  "level": "error",
  "message": "payment authorization failed",
  "service": "checkout",
  "env": "prod",
  "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",  // pivot to traces & other services
  "span_id": "00f067aa0ba902b7",
  "user_id": "u_8821",
  "order_id": "ord_4412",
  "duration_ms": 842,
  "error": {
    "type": "UpstreamTimeout",
    "code": "gateway_timeout",
    "upstream": "stripe"
  }
}
```

Rules:
- Same field names everywhere (`trace_id`, not sometimes `traceId`/`tid`).
- Always carry `trace_id` — it ties this line to the trace and to logs from other services.
- Errors carry a stable `type`/`code` (queryable) plus context ids to reproduce.
- Redact secrets/PII before serialization (no tokens, passwords, full PANs, emails where not permitted).

## Metric definitions

### RED (request-driven services)
| Metric | Type | Example name |
|--------|------|--------------|
| Rate | counter → rate() | `http_requests_total{route,method}` |
| Errors | counter | `http_requests_total{status=~"5.."}` |
| Duration | histogram | `http_request_duration_seconds_bucket{route}` |

Query p99 latency from the histogram, e.g.:
```
histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, route))
```

### USE (resources)
| Metric | Meaning |
|--------|---------|
| Utilization | % time the resource was busy (CPU %, mem used) |
| Saturation | queued/over-capacity work (run-queue, pool wait, GC pressure) |
| Errors | resource-level errors (disk errors, dropped packets, pool timeouts) |

### Cardinality discipline
- Labels: bounded sets only — `route`, `method`, `status_code`, `region`. ✅
- NOT labels: `user_id`, `request_id`, `email`, raw URL with ids. ❌ (unbounded → cardinality explosion → cost + slow queries). Put those in logs/traces.

## OpenTelemetry span (pseudocode)

```python
with tracer.start_as_current_span("charge_card") as span:
    span.set_attribute("order.id", order_id)
    span.set_attribute("payment.provider", "stripe")
    try:
        result = gateway.charge(order)
        span.set_attribute("payment.amount", order.total)
    except UpstreamTimeout as e:
        span.set_status(Status(StatusCode.ERROR))
        span.record_exception(e)       # error trace is kept by tail sampling
        raise
```
Context propagates automatically across HTTP/gRPC via injected headers (`traceparent`), so the downstream service's spans join the same trace.

### Sampling
- **Tail-based:** decide after the trace completes — keep 100% of error/slow traces, sample (e.g. 5%) of normal ones. Best signal-to-cost.
- Never drop error traces. Always-on full sampling is usually too expensive at scale.

## SLO / error budget worked example

- **SLI:** proportion of successful requests = `(1 − 5xx/total)`.
- **SLO:** 99.9% successful over 30 days.
- **Error budget:** 0.1% of requests may fail. At 10M req/30d → budget = 10,000 failed requests.
- **Usage:** if a 2-hour incident burned 6,000 failed requests, 60% of the monthly budget is gone → freeze risky launches, focus on reliability until it recovers.
- **Availability budget intuition:** 99.9% ≈ 43 min downtime/month; 99.99% ≈ 4.3 min/month. Pick the tier the product actually needs — each nine costs disproportionately more.

## Burn-rate alert recipe (multi-window)

Alert on how fast the error budget is being consumed, not raw error count:
- **Fast burn (page):** 2% of 30-day budget consumed in 1 hour (≈14.4× burn rate) AND still burning over 5 min → page; this exhausts the month in ~2 days.
- **Slow burn (ticket):** 10% of budget in 6 hours → ticket, investigate same-day.

Multi-window (long + short) confirmation avoids flapping on brief blips while still catching sustained problems.

## Incident debugging — pivot across signals

1. **Alert fires** (symptom: SLO burn / error-rate spike).
2. **Metrics:** scope it — which service/route/region? error type? when did it start? what changed (deploy/config) at that time?
3. **Traces:** pull error/slow traces in the window — find which span fails or dominates latency (the bottleneck service).
4. **Logs:** filter by the offending `trace_id`/service — read the exact error and context to find root cause.
5. **Mitigate** per runbook (roll back, scale, disable feature flag), then fix forward.

The shared `trace_id` is what makes steps 3→4 instant instead of a needle-in-haystack search. Invest in that correlation above all.

## Quick checklist
- [ ] Structured logs with consistent fields + `trace_id`
- [ ] Secrets/PII redacted at the logging boundary
- [ ] RED metrics on every service; USE on resources
- [ ] Latency as histograms (p50/p95/p99), not averages
- [ ] Bounded metric label cardinality
- [ ] Distributed tracing with context propagation + tail sampling (keep errors)
- [ ] SLIs/SLOs defined from the user's perspective; error budget tracked
- [ ] Alerts on symptoms / burn rate, each actionable + runbook-linked
