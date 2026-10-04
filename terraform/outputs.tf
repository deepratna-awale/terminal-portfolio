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

# Inline policy for the IAM user whose Bedrock API key the server uses: one
# model through the US inference profile, the portfolio guardrail, nothing else.
locals {
  bedrock_profile_arn = "arn:aws:bedrock:${var.aws_region}:${data.aws_caller_identity.current.account_id}:inference-profile/${var.bedrock_model_id}"
  bedrock_base_model  = trimprefix(var.bedrock_model_id, "us.")
}

output "bedrock_chat_policy" {
  description = "Attach as the only inline policy of the Bedrock chat IAM user: terraform output -raw bedrock_chat_policy"
  value = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "InvokeViaInferenceProfile"
        Effect   = "Allow"
        Action   = "bedrock:InvokeModel"
        Resource = local.bedrock_profile_arn
      },
      {
        Sid      = "InvokeUnderlyingModel"
        Effect   = "Allow"
        Action   = "bedrock:InvokeModel"
        Resource = [for region in ["us-east-1", "us-east-2", "us-west-2"] : "arn:aws:bedrock:${region}::foundation-model/${local.bedrock_base_model}"]
        Condition = {
          StringEquals = { "bedrock:InferenceProfileArn" = local.bedrock_profile_arn }
        }
      },
      {
        Sid      = "ApplyPortfolioGuardrail"
        Effect   = "Allow"
        Action   = "bedrock:ApplyGuardrail"
        Resource = aws_bedrock_guardrail.portfolio.guardrail_arn
      },
      {
        Sid      = "UseBedrockApiKey"
        Effect   = "Allow"
        Action   = "bedrock:CallWithBearerToken"
        Resource = "*"
      },
    ]
  })
}

output "github_actions_variables" {
  description = "Repository variables the Deploy workflow reads (set them with gh variable set)."
  value = {
    AWS_REGION                = var.aws_region
    AWS_DEPLOY_ROLE_ARN       = aws_iam_role.github_deploy.arn
    SERVICE_NAME              = var.service_name
    GUESTBOOK_BUCKET          = aws_lightsail_bucket.guestbook.name
    BEDROCK_GUARDRAIL_ID      = aws_bedrock_guardrail.portfolio.guardrail_id
    BEDROCK_GUARDRAIL_VERSION = aws_bedrock_guardrail_version.portfolio.version
  }
}
