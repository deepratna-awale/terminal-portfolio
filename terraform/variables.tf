variable "aws_region" {
  type        = string
  description = "AWS region for the portfolio. Lightsail DNS zones must live in us-east-1."
  default     = "us-east-1"
}

variable "service_name" {
  type        = string
  description = "Lightsail container service name (also the ECR repository name)."
  default     = "terminal-portfolio"
}

variable "service_power" {
  type        = string
  description = "Lightsail container service tier."
  default     = "nano"
}

variable "domain_name" {
  type        = string
  description = "Apex domain served by the portfolio."
  default     = "deepratna-awale.dev"
}

variable "attach_custom_domain" {
  type        = bool
  description = "Attach the domain and certificate to the container service. Leave false until the certificate shows ISSUED (needs GoDaddy nameservers pointed at Lightsail DNS first)."
  default     = true
}

variable "github_oidc_subject_prefixes" {
  type        = list(string)
  description = "Accepted OIDC subject prefixes. The repo uses GitHub's immutable subject format (owner@id/repo@id); the name-based form is kept as a fallback."
  default = [
    "repo:deepratna-awale@48187232/terminal-portfolio@1372160544",
    "repo:deepratna-awale/terminal-portfolio",
  ]
}

variable "bedrock_model_id" {
  type        = string
  description = "Cross-region inference profile the portfolio assistant may invoke."
  default     = "us.anthropic.claude-haiku-4-5-20251001-v1:0"
}

variable "bedrock_model_regions" {
  type        = list(string)
  description = "Regions the US inference profile routes to."
  default     = ["us-east-1", "us-east-2", "us-west-2"]
}
