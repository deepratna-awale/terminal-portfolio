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
  default     = false
}

variable "github_repository" {
  type        = string
  description = "owner/name of the GitHub repository allowed to deploy via OIDC."
  default     = "deepratna-awale/terminal-portfolio"
}
