---
name: Infrastructure as Code
description: This skill should be used when the user asks to "write Terraform", "set up infrastructure as code", "structure Terraform modules", "manage Terraform state", "handle state drift", "set up environments (dev/staging/prod)", "make infra reproducible", "review IaC", or works on provisioning cloud infrastructure declaratively (Terraform, OpenTofu, Pulumi, CloudFormation). Tool-agnostic principles with Terraform examples.
version: 0.1.0
---

# Infrastructure as Code

Apply these principles when provisioning or reviewing infrastructure defined as code. The goal is infrastructure that is **declarative, reproducible, version-controlled, and reviewable** — the same code produces the same environment every time. Examples use Terraform/OpenTofu syntax; the principles apply to any declarative IaC tool.

## Core principles

- **Declarative, not imperative.** Describe the desired end state; let the tool compute the diff to reach it. Don't script "create then modify then maybe delete."
- **Everything in version control.** All infrastructure lives in git, reviewed via PRs like application code. No click-ops in the console for anything that should persist — manual changes cause drift and are unauditable.
- **Reproducible.** Anyone should be able to recreate an environment from the code. This forces you to capture all dependencies explicitly.
- **Idempotent.** Applying the same config repeatedly converges to the same state with no unintended changes. A plan with no code change should show no diff.
- **Immutable over mutable** where practical. Replace resources rather than mutating them in place (e.g. new AMI/image → new instance), mirroring container/artifact discipline.

## State management (the part that bites people)

The state file maps your code to real-world resources. Mishandling it is the most common source of IaC disasters.

- **Use remote, shared state** (S3 + DynamoDB lock, Terraform Cloud, GCS, etc.) — never local state for team or production infra. Local state can't be shared and is easily lost.
- **Enable state locking** so two applies can't run concurrently and corrupt state.
- **State contains secrets.** Resource attributes (passwords, keys) land in state in plaintext. Encrypt state at rest and restrict access tightly.
- **Never hand-edit the state file.** Use the tool's commands (`state mv`, `import`, `state rm`) for surgical changes.
- **Separate state per environment.** dev/staging/prod each have isolated state so a mistake in dev can't touch prod. Also separate by blast radius (networking vs app) so a small change plans fast and risks little.
- **Back up state** / enable versioning on the state backend so you can recover from corruption.

## Drift

Drift = real infrastructure diverging from code (someone changed it manually, or an external process did).

- Detect drift by running `plan` regularly (ideally scheduled in CI) — a non-empty plan against unchanged code signals drift.
- Resolve by either reverting the manual change (re-apply code) or codifying the change (update code to match), then re-apply. Decide deliberately; don't let drift accumulate.
- Prevent drift by removing humans' ability to make persistent manual changes in prod (tighten console permissions).

## Structure: modules & DRY

- **Modularize** reusable infrastructure into modules with clear inputs (variables) and outputs — the same encapsulation logic as good functions. A module should do one thing (a "vpc" module, an "rds" module) with a documented interface.
- **Compose, don't copy.** Reuse modules across environments by passing different variables, rather than duplicating resource blocks. Duplication drifts apart over time.
- **Don't over-abstract.** A module wrapping a single resource with no added value is noise. Abstract when there's real reuse or meaningful grouping.
- **Pin versions** — provider versions and module versions. Unpinned versions make `apply` non-reproducible and can break unexpectedly. Commit the lock file.
- **Keep environments consistent.** Dev/staging/prod should differ only in scale and variables, not in structure — so staging actually predicts prod. See `references/terraform-patterns.md` for layout options (workspaces vs directories).

## Variables, secrets & config

- Parameterize per-environment values (sizes, counts, region, names) as variables; never hardcode environment-specific values in resource blocks.
- **Secrets never go in code or `.tfvars` committed to git.** Source them from a secret manager (Vault, cloud secret store) or inject via CI environment / `TF_VAR_` at apply time. Mark sensitive outputs `sensitive = true`.
- Tag/label all resources (owner, environment, cost-center, managed-by=terraform) for cost attribution, cleanup, and auditability.

## Workflow & safety

- **Plan before apply, always.** `plan` is the diff/preview — review it like a code review. Never `apply` blind.
- **Gate prod applies** behind PR review of the plan output and a required approval. Run `plan` automatically on PRs and post the output for reviewers.
- **Automate apply through CI/CD** from the main branch, not from laptops — consistent credentials, audit trail, and no "works on my machine" state.
- **Watch for destructive changes** in the plan. Some attribute changes force resource replacement (destroy + recreate) — for stateful resources (databases) that means data loss. Read `# forces replacement` lines carefully; use lifecycle rules (`prevent_destroy`, `create_before_destroy`) where appropriate.
- **Run policy/security checks** in CI (tfsec/checkov/OPA) to catch open security groups, public buckets, unencrypted volumes before apply.

## Review heuristics

- Local state, or no state locking → move to remote locked backend immediately.
- Hardcoded environment values / secrets in `.tf` or committed `.tfvars` → variables + secret manager.
- Copy-pasted resource blocks across environments → extract a module.
- Unpinned provider/module versions, missing lock file → pin and commit.
- Plan shows `forces replacement` on a database/stateful resource → stop and assess data loss.
- `apply` run from a laptop against prod → move to gated CI.
- No tags / no `managed-by` → add for attribution and drift clarity.

## Additional Resources

- **`references/terraform-patterns.md`** — repo layout (per-env directories vs workspaces), a reusable module example with inputs/outputs, remote-backend config, lifecycle rules, and a CI plan/apply workflow outline.
