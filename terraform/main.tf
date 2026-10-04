terraform {
  required_version = ">= 1.8.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

resource "aws_lightsail_container_service" "portfolio" {
  name        = var.service_name
  power       = var.service_power
  scale       = 1
  is_disabled = false
  private_registry_access {
    ecr_image_puller_role {
      is_active = false
    }
  }
}

output "container_service_name" {
  value = aws_lightsail_container_service.portfolio.name
}

output "monthly_service_tier" {
  value = var.service_power
}
