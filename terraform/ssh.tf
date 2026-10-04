# The SSH edition: a small Lightsail VM serving the portfolio at
# ssh.<domain> on port 22. It installs each build from the repository's
# ssh-latest release (.github/workflows/ssh.yml), so neither GitHub nor the VM
# holds deploy credentials. The host key is generated on first boot and kept
# for the life of the instance.
locals {
  ssh_host = "${var.ssh_subdomain}.${var.domain_name}"
}

resource "aws_lightsail_instance" "ssh" {
  count = var.ssh_enabled ? 1 : 0

  name              = "${var.service_name}-ssh"
  availability_zone = "${var.aws_region}a"
  blueprint_id      = var.ssh_blueprint
  bundle_id         = var.ssh_bundle
  ip_address_type   = "dualstack"
  user_data = templatefile("${path.module}/ssh-bootstrap.sh", {
    repository  = var.github_repository
    release_tag = var.ssh_release_tag
    admin_port  = var.ssh_admin_port
  })

  lifecycle {
    # The launch script only runs on first boot; changing it would replace
    # the instance and with it the host key visitors have pinned.
    ignore_changes = [user_data]
  }
}

resource "aws_lightsail_static_ip" "ssh" {
  count = var.ssh_enabled ? 1 : 0
  name  = "${var.service_name}-ssh-ip"
}

resource "aws_lightsail_static_ip_attachment" "ssh" {
  count          = var.ssh_enabled ? 1 : 0
  static_ip_name = aws_lightsail_static_ip.ssh[0].name
  instance_name  = aws_lightsail_instance.ssh[0].name
}

# Port 22 is the portfolio for everyone. The real sshd listens on
# ssh_admin_port and is only reachable from ssh_admin_cidrs (closed by default).
resource "aws_lightsail_instance_public_ports" "ssh" {
  count         = var.ssh_enabled ? 1 : 0
  instance_name = aws_lightsail_instance.ssh[0].name

  port_info {
    protocol   = "tcp"
    from_port  = 22
    to_port    = 22
    cidrs      = ["0.0.0.0/0"]
    ipv6_cidrs = ["::/0"]
  }

  dynamic "port_info" {
    for_each = length(var.ssh_admin_cidrs) > 0 ? [1] : []

    content {
      protocol  = "tcp"
      from_port = var.ssh_admin_port
      to_port   = var.ssh_admin_port
      cidrs     = var.ssh_admin_cidrs
    }
  }
}

resource "aws_lightsail_domain_entry" "ssh" {
  count       = var.ssh_enabled ? 1 : 0
  domain_name = aws_lightsail_domain.portfolio.domain_name
  name        = var.ssh_subdomain
  type        = "A"
  target      = aws_lightsail_static_ip.ssh[0].ip_address
}

resource "aws_lightsail_domain_entry" "ssh_ipv6" {
  count       = var.ssh_enabled ? 1 : 0
  domain_name = aws_lightsail_domain.portfolio.domain_name
  name        = var.ssh_subdomain
  type        = "AAAA"
  target      = aws_lightsail_instance.ssh[0].ipv6_addresses[0]
}
