resource "aws_ecr_repository" "portfolio" {
  name                 = var.service_name
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "portfolio" {
  repository = aws_ecr_repository.portfolio.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep the 10 most recent images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = { type = "expire" }
    }]
  })
}

# Lets the Lightsail container service pull from this private repository.
resource "aws_ecr_repository_policy" "lightsail_pull" {
  repository = aws_ecr_repository.portfolio.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "AllowLightsailPull"
      Effect = "Allow"
      Principal = {
        AWS = aws_lightsail_container_service.portfolio.private_registry_access[0].ecr_image_puller_role[0].principal_arn
      }
      Action = ["ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer"]
    }]
  })
}
