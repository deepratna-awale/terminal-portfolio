# The portfolio assistant calls Bedrock with a Bedrock API key (bearer token).
# Lightsail containers cannot assume IAM roles, so the key belongs to a
# dedicated IAM user that can invoke exactly one model and nothing else.
# The key itself is created outside Terraform (see README) so the secret never
# lands in state.

data "aws_caller_identity" "current" {}

locals {
  bedrock_profile_arn = "arn:aws:bedrock:${var.aws_region}:${data.aws_caller_identity.current.account_id}:inference-profile/${var.bedrock_model_id}"
  # Cross-region inference profiles route to the same model in these regions.
  bedrock_model_arns = [for region in var.bedrock_model_regions : "arn:aws:bedrock:${region}::foundation-model/${trimprefix(var.bedrock_model_id, "us.")}"]
}

resource "aws_iam_user" "bedrock_chat" {
  name = "${var.service_name}-bedrock-chat"
  path = "/service/"
}

data "aws_iam_policy_document" "bedrock_chat" {
  statement {
    sid       = "InvokeViaInferenceProfile"
    actions   = ["bedrock:InvokeModel"]
    resources = [local.bedrock_profile_arn]
  }

  statement {
    sid       = "InvokeUnderlyingModel"
    actions   = ["bedrock:InvokeModel"]
    resources = local.bedrock_model_arns

    condition {
      test     = "StringEquals"
      variable = "bedrock:InferenceProfileArn"
      values   = [local.bedrock_profile_arn]
    }
  }

  statement {
    sid       = "UseBedrockApiKey"
    actions   = ["bedrock:CallWithBearerToken"]
    resources = ["*"]
  }
}

resource "aws_iam_user_policy" "bedrock_chat" {
  name   = "invoke-one-model"
  user   = aws_iam_user.bedrock_chat.name
  policy = data.aws_iam_policy_document.bedrock_chat.json
}
