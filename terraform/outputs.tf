output "container_service_name" {
  value = aws_lightsail_container_service.portfolio.name
}

output "container_service_url" {
  value = aws_lightsail_container_service.portfolio.url
}

output "container_name" {
  value = local.container_name
}

output "ecr_repository_url" {
  value = aws_ecr_repository.portfolio.repository_url
}

output "github_deploy_role_arn" {
  value = aws_iam_role.github_deploy.arn
}

output "nameservers_command" {
  description = "Run this to get the nameservers to set at GoDaddy."
  value       = "aws lightsail get-domain --region us-east-1 --domain-name ${var.domain_name} --query \"domain.domainEntries[?type=='NS'].target\" --output text"
}

output "guestbook_bucket" {
  value = aws_lightsail_bucket.guestbook.name
}
