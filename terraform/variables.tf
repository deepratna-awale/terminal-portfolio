variable "aws_region" {
  type        = string
  description = "AWS region for the portfolio. Lightsail DNS zones must live in us-east-1."
  default     = "us-east-1"
}

variable "service_name" {
  type        = string
  description = "Lightsail container service name. Also prefixes the ECR repository, certificate, deploy role, guardrail and guestbook bucket."
  default     = "terminal-portfolio"
}

variable "service_power" {
  type        = string
  description = "Lightsail container service tier."
  default     = "nano"
}

variable "domain_name" {
  type        = string
  description = "Apex domain served by the portfolio, for example example.dev."
}

variable "owner_name" {
  type        = string
  description = "First name the assistant uses when it refuses an off-topic question."
}

variable "attach_custom_domain" {
  type        = bool
  description = "Attach the domain and certificate to the container service. Leave false until the certificate shows ISSUED (the registrar's nameservers must point at Lightsail DNS first)."
  default     = false
}

variable "github_repository" {
  type        = string
  description = "Repository allowed to deploy, as owner/name."
}

variable "github_immutable_subject_prefix" {
  type        = string
  description = "Set when the repository uses GitHub's immutable OIDC subject format: repo:owner@owner_id/name@repo_id. Read it with: gh api repos/OWNER/NAME/actions/oidc/customization/sub"
  default     = null
}

variable "github_deploy_branch" {
  type        = string
  description = "Only workflows running on this branch can assume the deploy role."
  default     = "main"
}

variable "github_deploy_environment" {
  type        = string
  description = "GitHub environment the Deploy job runs in. Restrict it to the deploy branch in the repository settings."
  default     = "production"
}

variable "guardrail_denied_topics" {
  type = list(object({
    name       = string
    definition = string
    examples   = list(string)
  }))
  description = "Topics the portfolio assistant refuses to discuss."
  default = [
    {
      name       = "FinancialAdvice"
      definition = "Personalized investment, trading, tax or financial advice, including stock picks and opinions on share prices."
      examples   = ["Should I buy this stock?", "Which crypto will go up next week?"]
    },
    {
      name       = "MedicalOrLegalAdvice"
      definition = "Diagnosis, treatment or legal advice for a person's specific situation."
      examples   = ["What medication should I take for my headache?", "How do I get out of my lease?"]
    },
    {
      name       = "Politics"
      definition = "Opinions on political parties, candidates, elections or contested political issues."
      examples   = ["Who should I vote for?", "What do you think about the election?"]
    },
  ]
}

variable "bedrock_model_id" {
  type        = string
  description = "US cross-region inference profile the assistant calls. Must match BEDROCK_MODEL_ID in the server (default below)."
  default     = "us.anthropic.claude-haiku-4-5-20251001-v1:0"
}

variable "budget_alert_email" {
  type        = string
  description = "Where to send AWS budget alerts. Leave unset to skip the budget."
  default     = null
}

variable "monthly_budget_usd" {
  type        = number
  description = "Monthly AWS spend that triggers a budget alert (actual or forecast)."
  default     = 25
}

variable "ssh_enabled" {
  type        = bool
  description = "Serve the portfolio over SSH from a Lightsail instance at ssh_subdomain.domain_name (about $5 a month)."
  default     = false
}

variable "ssh_subdomain" {
  type        = string
  description = "Host name visitors SSH to, under domain_name."
  default     = "ssh"
}

variable "ssh_bundle" {
  type        = string
  description = "Lightsail instance bundle. nano_3_0 is the cheapest with a public IPv4 address."
  default     = "nano_3_0"
}

variable "ssh_blueprint" {
  type        = string
  description = "Lightsail OS image. The launch script expects Debian."
  default     = "debian_13"
}

variable "ssh_release_tag" {
  type        = string
  description = "GitHub release the instance installs builds from (published by the SSH server workflow)."
  default     = "ssh-latest"
}

variable "ssh_admin_port" {
  type        = number
  description = "Port of the instance's own sshd (key-only), since the portfolio takes port 22."
  default     = 22022
}

variable "ssh_admin_cidrs" {
  type        = list(string)
  description = "IPv4 ranges allowed to reach ssh_admin_port, for example [\"203.0.113.7/32\"]. Empty keeps it closed."
  default     = []
}
