# Lightsail DNS (free) instead of Route 53: it can alias the apex record
# straight to a container service. GoDaddy's nameservers must point here.
resource "aws_lightsail_domain" "portfolio" {
  domain_name = var.domain_name
}

locals {
  container_host = regex("^https://([^/]+)/?$", aws_lightsail_container_service.portfolio.url)[0]
}

locals {
  # Keyed by the static domain list so for_each keys are known at plan time.
  validation_records = {
    for option in aws_lightsail_certificate.portfolio.domain_validation_options : option.domain_name => option
  }
}

resource "aws_lightsail_domain_entry" "certificate_validation" {
  for_each = toset(local.custom_domains)

  domain_name = aws_lightsail_domain.portfolio.domain_name
  name        = trimsuffix(trimsuffix(local.validation_records[each.key].resource_record_name, "."), ".${var.domain_name}")
  type        = local.validation_records[each.key].resource_record_type
  target      = trimsuffix(local.validation_records[each.key].resource_record_value, ".")
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

# The domain sends no mail: publish SPF/DMARC records that tell receivers to
# reject anything claiming to come from it.
resource "aws_lightsail_domain_entry" "spf" {
  domain_name = aws_lightsail_domain.portfolio.domain_name
  name        = ""
  type        = "TXT"
  target      = "\"v=spf1 -all\""
}

resource "aws_lightsail_domain_entry" "dmarc" {
  domain_name = aws_lightsail_domain.portfolio.domain_name
  name        = "_dmarc"
  type        = "TXT"
  target      = "\"v=DMARC1; p=reject; sp=reject; adkim=s; aspf=s\""
}
