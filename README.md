# terminal-portfolio

Terminal-style portfolio for [deepratna-awale.dev](https://deepratna-awale.dev), built with React + Vite and served by a small Node server on AWS Lightsail.

## Local development

```bash
npm install
npm run dev        # Vite on :5173, proxies /api to :8787
npm run build && npm run api   # production build served by the Node server on :8787
```

`fortune` and `cowthink` call the real binaries, so they only work locally if those are installed (`brew install fortune cowsay`) or inside the container:

```bash
docker build --platform linux/amd64 -t terminal-portfolio .
docker run --rm -p 8080:8080 terminal-portfolio
```

## Infrastructure

Everything lives in `terraform/`:

| Resource | Purpose |
| --- | --- |
| Lightsail container service (nano) | Runs the container, ~$7/month |
| ECR repository | Private image registry the service pulls from |
| Lightsail certificate | TLS for the apex and `www` |
| Lightsail DNS zone | Free DNS that can alias the apex to the container service |
| GitHub OIDC role | Lets the Deploy workflow push and deploy without stored keys |

State is kept in S3 (`terraform/bootstrap` creates the bucket once).

### First-time setup

1. `cd terraform/bootstrap && terraform init && terraform apply` creates the state bucket.
2. `cd terraform && terraform init && terraform apply` creates the stack with the domain not yet attached.
3. Run the command from the `nameservers_command` output and set those nameservers on the domain at GoDaddy.
4. Wait until `aws lightsail get-certificates --certificate-name terminal-portfolio-cert --query 'certificates[0].certificateDetail.status'` shows `ISSUED`.
5. Set `attach_custom_domain` to `true` (the default now) and `terraform apply` to attach the domain and create the apex/`www` records.
6. Set the GitHub repository variable `DEPLOY_ENABLED=true`. Every push to `main` now builds, pushes and deploys.

## Portfolio assistant (Bedrock)

Anything typed that is not a built-in command goes to `POST /api/chat`, which calls Claude Haiku 4.5 on Amazon Bedrock from the server. The browser never sees credentials.

- Lightsail containers cannot assume IAM roles, so the key belongs to a dedicated IAM user, `terminal-portfolio-bedrock-chat`, created once in the IAM console (the Terraform identity is not allowed to manage users). Attach [`docs/bedrock-chat-policy.json`](docs/bedrock-chat-policy.json) as its only inline policy: it allows `bedrock:InvokeModel` on the Claude Haiku 4.5 inference profile and nothing else.
- Generate a long-term Bedrock API key for that user (IAM console, user, Security credentials, API keys for Amazon Bedrock) and store it straight into the repository secret, so it never lands in Terraform state or chat:

  ```bash
  gh secret set BEDROCK_API_KEY -R deepratna-awale/terminal-portfolio
  ```

- The server reads it as `AWS_BEARER_TOKEN_BEDROCK`. Limits: 6 questions/minute and 60/day per visitor, 1,500/day overall (`CHAT_PER_MINUTE`, `CHAT_PER_DAY`, `CHAT_GLOBAL_PER_DAY`).

`GET /api/projects` lists public GitHub repositories and, when Bedrock is configured, summarises each README into bullets. Results are cached for six hours.
