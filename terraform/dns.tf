# Lightsail DNS (free) instead of Route 53: it can alias the apex record
# straight to a container service. GoDaddy's nameservers must point here.
resource "aws_lightsail_domain" "portfolio" {
  domain_name = var.domain_name
}

locals {
  container_host = regex("^https://([^/]+)/?$", aws_lightsail_container_service.portfolio.url)[0]
}

resource "aws_lightsail_domain_entry" "certificate_validation" {
  for_each = {
    for option in aws_lightsail_certificate.portfolio.domain_validation_options : option.domain_name => option
  }

  domain_name = aws_lightsail_domain.portfolio.domain_name
  name        = trimsuffix(trimsuffix(each.value.resource_record_name, "."), ".${var.domain_name}")
  type        = each.value.resource_record_type
  target      = trimsuffix(each.value.resource_record_value, ".")
}

resource "aws_lightsail_domain_entry" "apex" {
  count = var.attach_custom_domain ? 1 : 0

  domain_name = aws_lightsail_domain.portfolio.domain_name
  name        = ""
  type        = "A"
  target      = local.container_host
  is_alias    = true
}

resource "aws_lightsail_domain_entry" "www" {
  count = var.attach_custom_domain ? 1 : 0

  domain_name = aws_lightsail_domain.portfolio.domain_name
  name        = "www"
  type        = "A"
  target      = local.container_host
  is_alias    = true
}
