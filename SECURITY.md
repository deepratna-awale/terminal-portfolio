# Security policy

## Reporting a vulnerability

Please report security issues privately through
[GitHub private vulnerability reporting](https://github.com/deepratna-awale/terminal-portfolio/security/advisories/new)
rather than a public issue. Include steps to reproduce and the impact you expect.
You should get a reply within a few days.

In scope: the code in this repository and the live site it deploys
(https://deepratna-awale.dev), including the `/api/*` endpoints, the portfolio
assistant and its Bedrock Guardrail, the guestbook, the container image and the
Terraform and GitHub Actions configuration.

Out of scope: denial-of-service and volumetric testing, social engineering, and
findings in third-party services (AWS, GitHub) that are not caused by this
configuration. Please do not run automated scanners against the live site.

## How the deployment is protected

- No long-lived AWS keys in CI. GitHub Actions assumes an IAM role through OIDC,
  and the role trusts only this repository's `main` branch and its `production`
  environment, which is restricted to `main`. Pull requests, including from
  forks, run on `pull_request` with a read-only token and no secrets.
- Third-party actions are pinned to commit SHAs.
- The container runs as a non-root user. The server sends a strict Content
  Security Policy and HSTS, and rate-limits the assistant and the guestbook.
- The assistant's Bedrock API key belongs to an IAM user that can call one model
  and apply one guardrail, nothing else. Every request goes through a Bedrock
  Guardrail that blocks prompt attacks, secrets and personal data.
- The guestbook writes to one Lightsail bucket with a bucket-scoped access key.
- Secrets live only in GitHub Actions secrets and the container's environment,
  never in the repository or Terraform state.

## Supported versions

Only the current `main` branch (what is deployed) receives fixes.
