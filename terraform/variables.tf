variable "aws_region" {
  type        = string
  description = "AWS region for the portfolio container."
  default     = "us-east-1"
}

variable "service_name" {
  type        = string
  description = "Unique Lightsail container service name."
  default     = "alex-morgan-portfolio"
}

variable "service_power" {
  type        = string
  description = "Lightsail container service tier."
  default     = "nano"
}
