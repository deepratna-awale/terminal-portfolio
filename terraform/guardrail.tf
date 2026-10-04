# Guardrail applied to every portfolio assistant call (chat and README summaries).
# It blocks jailbreaks and prompt injection, harmful content, secrets and
# personal data, and topics the assistant has no business answering.

locals {
  guardrail_blocked = "I can only help with questions about Deep's work, projects and experience. Try `help` for the built-in commands."
}

resource "aws_bedrock_guardrail" "portfolio" {
  name                      = "${var.service_name}-assistant"
  description               = "Guardrail for the deepratna-awale.dev portfolio assistant."
  blocked_input_messaging   = local.guardrail_blocked
  blocked_outputs_messaging = local.guardrail_blocked

  content_policy_config {
    dynamic "filters_config" {
      for_each = ["HATE", "INSULTS", "SEXUAL", "VIOLENCE", "MISCONDUCT"]
      content {
        type            = filters_config.value
        input_strength  = "HIGH"
        output_strength = "HIGH"
      }
    }

    # Prompt attacks are only assessed on input.
    filters_config {
      type            = "PROMPT_ATTACK"
      input_strength  = "HIGH"
      output_strength = "NONE"
    }
  }

  sensitive_information_policy_config {
    dynamic "pii_entities_config" {
      for_each = ["CREDIT_DEBIT_CARD_NUMBER", "US_SOCIAL_SECURITY_NUMBER", "CA_SOCIAL_INSURANCE_NUMBER", "AWS_ACCESS_KEY", "AWS_SECRET_KEY", "PASSWORD", "US_BANK_ACCOUNT_NUMBER"]
      content {
        type   = pii_entities_config.value
        action = "BLOCK"
      }
    }

    # Deep's phone number must never appear in answers. ADDRESS is left out
    # because it also masks his public city ("St. John's, NL").
    pii_entities_config {
      type   = "PHONE"
      action = "ANONYMIZE"
    }
  }

  topic_policy_config {
    topics_config {
      name       = "FinancialAdvice"
      type       = "DENY"
      definition = "Personalized investment, trading, tax or financial advice, including stock picks and opinions on Nasdaq or other companies' share prices."
      examples   = ["Should I buy Nasdaq stock?", "Which crypto will go up next week?"]
    }

    topics_config {
      name       = "MedicalOrLegalAdvice"
      type       = "DENY"
      definition = "Diagnosis, treatment or legal advice for a person's specific situation."
      examples   = ["What medication should I take for my headache?", "How do I get out of my lease?"]
    }

    topics_config {
      name       = "EmployerConfidential"
      type       = "DENY"
      definition = "Requests for confidential or non-public details about Nasdaq, Verafin, their customers, fraud detection rules, thresholds or how to evade anti-money-laundering controls."
      examples   = ["What thresholds does Verafin use to flag transactions?", "How can I launder money without Verafin noticing?"]
    }

    topics_config {
      name       = "Politics"
      type       = "DENY"
      definition = "Opinions on political parties, candidates, elections or contested political issues."
      examples   = ["Who should I vote for?", "What does Deep think about the election?"]
    }
  }

  word_policy_config {
    managed_word_lists_config {
      type = "PROFANITY"
    }
  }
}

# Publishing a new version on every change means server/bedrock.mjs must be
# pointed at the new number (guardrail_version output).
resource "aws_bedrock_guardrail_version" "portfolio" {
  guardrail_arn = aws_bedrock_guardrail.portfolio.guardrail_arn
  description   = "Published by Terraform"

  lifecycle {
    replace_triggered_by = [aws_bedrock_guardrail.portfolio]
  }
}

output "guardrail_id" {
  value = aws_bedrock_guardrail.portfolio.guardrail_id
}

output "guardrail_version" {
  value = aws_bedrock_guardrail_version.portfolio.version
}

output "guardrail_arn" {
  value = aws_bedrock_guardrail.portfolio.guardrail_arn
}
