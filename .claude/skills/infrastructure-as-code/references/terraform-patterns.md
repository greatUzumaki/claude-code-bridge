# Terraform / OpenTofu Patterns Reference

## Repository layout

### Option A: per-environment directories (recommended for clear isolation)
```
infra/
├── modules/
│   ├── vpc/            # reusable, environment-agnostic
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── rds/
│   └── service/
├── environments/
│   ├── dev/
│   │   ├── main.tf     # calls modules with dev variables
│   │   ├── backend.tf  # dev state
│   │   └── dev.tfvars
│   ├── staging/
│   └── prod/
│       ├── main.tf
│       ├── backend.tf  # SEPARATE prod state
│       └── prod.tfvars
```
Each environment has its own state and is applied independently. Structure is identical across envs; only `*.tfvars` differ. A mistake in dev cannot touch prod state.

### Option B: workspaces
One config, multiple workspaces (`terraform workspace select prod`) sharing a backend with per-workspace state keys. Less code duplication, but the shared config makes it easier to accidentally affect the wrong environment and harder to diverge intentionally. Prefer directories when prod isolation matters.

## Remote backend with locking (S3 example)

```hcl
terraform {
  required_version = "~> 1.7"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.40" }   # pinned
  }
  backend "s3" {
    bucket         = "acme-tfstate"
    key            = "prod/network/terraform.tfstate"          # per-env, per-component key
    region         = "us-east-1"
    dynamodb_table = "tf-locks"                                # state locking
    encrypt        = true                                      # encrypt state at rest
  }
}
```
Commit `.terraform.lock.hcl` (the provider lock file) for reproducible provider versions.

## Reusable module with clear interface

```hcl
# modules/service/variables.tf
variable "name"          { type = string }
variable "environment"   { type = string }
variable "instance_count"{ type = number, default = 2 }
variable "instance_size" { type = string }

# modules/service/main.tf
resource "aws_ecs_service" "this" {
  name          = "${var.environment}-${var.name}"
  desired_count = var.instance_count
  # ...
  tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
    Service     = var.name
  }
}

# modules/service/outputs.tf
output "service_arn" { value = aws_ecs_service.this.id }
```

```hcl
# environments/prod/main.tf — compose with prod values
module "api" {
  source         = "../../modules/service"
  name           = "api"
  environment    = "prod"
  instance_count = 6           # prod scales higher; structure identical to dev
  instance_size  = "large"
}
```
Same module, different variables per environment → staging genuinely predicts prod.

## Lifecycle rules (protect stateful resources)

```hcl
resource "aws_db_instance" "main" {
  # ...
  lifecycle {
    prevent_destroy = true            # refuse a plan that would destroy this
    ignore_changes  = [password]      # don't fight an externally-rotated secret
  }
}

resource "aws_instance" "app" {
  # ...
  lifecycle {
    create_before_destroy = true      # zero-downtime replacement
  }
}
```
Always read plan output for `# forces replacement` — on a database that means data loss. `prevent_destroy` is a guardrail against an accidental destroy.

## Secrets — never in code

```hcl
variable "db_password" {
  type      = string
  sensitive = true                    # masked in output/logs
}
# Supplied via env at apply time: export TF_VAR_db_password=$(vault read ...)
# or referenced from a secret manager data source — NOT committed to git.

output "db_endpoint" {
  value     = aws_db_instance.main.address
  sensitive = false
}
```
Never commit a `.tfvars` containing secrets. Add `*.tfvars` (or just secret ones) to `.gitignore` and source secrets from a manager / CI environment.

## CI plan/apply workflow (outline)

```
on pull_request:
  - terraform init -backend-config=env/$ENV/backend.tf
  - terraform validate
  - terraform plan -var-file=env/$ENV/$ENV.tfvars -out=plan.bin
  - post plan output as a PR comment        # reviewers review the diff
  - run tfsec / checkov on the config       # security gate

on merge to main (gated by approval):
  - terraform apply plan.bin                # apply the EXACT reviewed plan
```
Apply runs in CI with scoped credentials (prefer OIDC over static keys), never from a laptop. Applying the saved plan guarantees you apply exactly what was reviewed.

## State surgery (use commands, never hand-edit)
- Import existing resource: `terraform import aws_s3_bucket.b my-bucket`
- Rename in state without recreating: `terraform state mv aws_s3_bucket.old aws_s3_bucket.new`
- Drop from state (stop managing, don't destroy): `terraform state rm aws_s3_bucket.b`
- Inspect drift: `terraform plan` on unchanged code — any diff = drift to reconcile.
