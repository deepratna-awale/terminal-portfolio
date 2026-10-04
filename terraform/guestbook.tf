# Guestbook storage: one JSON object in a Lightsail bucket ($1/month plan).
# Lightsail containers cannot assume IAM roles, so the server signs requests
# with a bucket-scoped Lightsail access key. The key is created outside
# Terraform (see README) so the secret never lands in state.
resource "aws_lightsail_bucket" "guestbook" {
  name      = "${var.service_name}-guestbook-${data.aws_caller_identity.current.account_id}"
  bundle_id = "small_1_0"
}

data "aws_caller_identity" "current" {}
