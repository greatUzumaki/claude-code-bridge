---
name: Observability
description: This skill should be used when the user asks to "add observability", "set up logging/metrics/tracing", "add structured logging", "instrument a service", "define SLOs/SLIs", "set up alerting", "reduce alert noise/fatigue", "improve on-call", "add distributed tracing", or works on monitoring, telemetry, dashboards, or production debuggability. Stack-agnostic principles (OpenTelemetry-aligned).
version: 0.1.0
---

# Observability

Apply these principles when instrumenting a service for production or reviewing its monitoring. Observability is the ability to ask arbitrary questions about a system's behavior from its outputs, without shipping new code. It rests on three signals — **logs, metrics, traces** — plus the discipline to alert on what matters. Instrument for the questions you'll ask at 3am during an incident, not for vanity dashboards.

## The three pillars

- **Logs** — discrete timestamped events ("what happened"). Best for detailed context on a specific event/error.
- **Metrics** — numeric measurements aggregated over time ("how much/how often"). Best for trends, dashboards, and alerting; cheap to store at scale.
- **Traces** — the path of a single request across services ("where did the time go / where did it fail"). Best for latency analysis and debugging distributed systems.

Use all three; they answer different questions. A metric tells you error rate spiked; a trace tells you which service; logs tell you the exact failure. Correlate them with a shared **trace/correlation id** so you can pivot between signals — this correlation is the highest-leverage thing to get right.

## Structured logging (do this from day one)

Log structured (JSON or key-value), never free-text strings you'll later regex.

- Each log is an object with consistent fields: `timestamp`, `level`, `message`, `service`, `trace_id`, plus event-specific context (`user_id`, `order_id`, `duration_ms`).
- **Always include the correlation/trace id** so logs for one request can be gathered across services.
- Use levels deliberately: ERROR (needs attention), WARN (suspicious, not yet failing), INFO (significant business events), DEBUG (diagnostic, usually off in prod). Don't log everything at INFO.
- **Never log secrets or PII** (passwords, tokens, full card numbers, personal data). Redact at the logging boundary. This is a security and compliance requirement, not a nicety.
- Log at boundaries (request in/out, external calls) and at decision/error points — not every line. Excessive logging costs money and buries signal.
- Make errors actionable: include what failed, the relevant ids, and enough context to reproduce — never a bare `"error occurred"`.

## Metrics (RED + USE)

Instrument with proven method-driven coverage rather than ad hoc gauges:

- **RED (for request-driven services):** **R**ate (requests/sec), **E**rrors (failed requests/sec), **D**uration (latency distribution). These three cover most user-facing service health.
- **USE (for resources):** **U**tilization, **S**aturation, **E**rrors — for CPU, memory, disk, queues, connection pools.
- **Use histograms for latency, never just averages.** Averages hide tail latency; p50/p95/p99 reveal what real users experience. An average of 100ms can hide a p99 of 5s affecting your biggest customers.
- Add business metrics (signups, orders, payment success rate) — they catch problems that infra metrics miss (e.g. checkout silently failing while CPU looks fine).
- Keep cardinality under control: don't put unbounded values (user id, request id) in metric labels — it explodes storage and cost. Those belong in logs/traces.

## Distributed tracing

- Instrument requests to propagate a trace context across service boundaries (W3C Trace Context / OpenTelemetry). Each hop adds a span.
- Spans capture operation name, duration, status, and attributes. A trace shows the full request tree and where time/errors concentrate.
- Use **tail-based sampling** (keep all error/slow traces, sample the rest) to control volume while retaining the interesting traces. Always-on full tracing is expensive; never sampling errors defeats the purpose.
- Prefer **OpenTelemetry** for instrumentation — vendor-neutral, so you can switch backends without re-instrumenting.

## SLIs, SLOs, and error budgets

Move from "is it up?" to "is it good enough?" with explicit targets:

- **SLI (indicator):** a measured quality metric, e.g. % of requests served < 300ms, or % of requests without errors. Define from the user's perspective.
- **SLO (objective):** the target for an SLI over a window, e.g. 99.9% availability over 30 days. Set it realistically — 100% is the wrong target (impossibly expensive, leaves no room to ship).
- **Error budget:** `100% − SLO`. The allowed amount of failure. When the budget is healthy, ship faster; when it's exhausted, slow down and prioritize reliability. This turns reliability into a shared, quantified decision rather than an argument.

## Alerting (protect the on-call human)

Bad alerting is worse than none — it trains responders to ignore pages. Alert discipline is the difference between a healthy and a burned-out on-call rotation.

- **Alert on symptoms, not causes.** Page on user-visible problems (high error rate, SLO burn, latency breach), not on every internal metric (high CPU is not itself an emergency if users are fine). Cause-based alerts produce noise; symptom-based alerts mean something.
- **Every page must be actionable and urgent.** If it can wait until morning, it's a ticket, not a page. If there's nothing to do, delete the alert.
- Use **SLO burn-rate alerts** — alert when you're consuming error budget too fast, which scales urgency to actual impact and avoids flapping.
- Tune to eliminate false positives. Each non-actionable page erodes trust in the whole system (alert fatigue). Track and review alert noise.
- Give every alert a **runbook**: what it means, how to confirm, first steps to mitigate. A page with no runbook wastes the responder's time.

## Review heuristics

- Free-text logs without structure or trace ids → switch to structured logs with correlation ids.
- Latency tracked as average only → add p95/p99 histograms.
- Secrets/PII in logs → redact at the boundary (security issue).
- Alerts on CPU/memory rather than user-facing symptoms → re-base on symptoms/SLO burn.
- High-cardinality labels on metrics → move those dimensions to logs/traces.
- "Is it up" checks but no SLOs → define SLIs/SLOs from the user's view.
- Pages that aren't actionable / have no runbook → delete or downgrade to tickets, add runbooks.

## Additional Resources

- **`references/instrumentation-guide.md`** — structured log schema example, RED/USE metric definitions, OpenTelemetry span example, SLO/error-budget worked example, burn-rate alert recipe, and an incident-debugging signal-pivot workflow.
