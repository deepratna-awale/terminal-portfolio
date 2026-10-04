locals {
  certificate_name = "${var.service_name}-cert"
  custom_domains   = [var.domain_name, "www.${var.domain_name}"]
  container_name   = "portfolio"
}

resource "aws_lightsail_certificate" "portfolio" {
  name                      = local.certificate_name
  domain_name               = var.domain_name
  subject_alternative_names = ["www.${var.domain_name}"]
}

resource "aws_lightsail_container_service" "portfolio" {
  name        = var.service_name
  power       = var.service_power
  scale       = 1
  is_disabled = false

  private_registry_access {
    ecr_image_puller_role {
      is_active = true
    }
  }

  dynamic "public_domain_names" {
    for_each = var.attach_custom_domain ? [1] : []

    content {
      certificate {
        certificate_name = aws_lightsail_certificate.portfolio.name
        domain_names     = local.custom_domains
      }
    }
  }
}
