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
docker run --rm -p 8080:80 terminal-portfolio
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
