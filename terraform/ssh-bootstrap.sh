#!/bin/bash
# First boot of the SSH portfolio instance (Lightsail launch script, runs once
# as root). Terraform template: only the three values below are filled in.
# After this, every build comes from the GitHub release; see ssh/deploy/.
set -euo pipefail
REPOSITORY="${repository}"
RELEASE_TAG="${release_tag}"
ADMIN_PORT="${admin_port}"
export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get -y upgrade
apt-get install -y --no-install-recommends ca-certificates curl xz-utils unattended-upgrades

# Node.js (current v24 LTS) from nodejs.org, checked against the published checksum.
cd /tmp
curl -fsSLO https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt
NODE_TARBALL=$(grep -o 'node-v[0-9.]*-linux-x64.tar.xz' SHASUMS256.txt | head -n1)
curl -fsSLO "https://nodejs.org/dist/latest-v24.x/$NODE_TARBALL"
grep " $NODE_TARBALL\$" SHASUMS256.txt | sha256sum -c -
tar -xJf "$NODE_TARBALL" -C /usr/local --strip-components=1 --exclude='*/include' --exclude='*/share'
rm -f "$NODE_TARBALL" SHASUMS256.txt

# The portfolio takes port 22, so the real sshd moves to ADMIN_PORT, keys only.
cat > /etc/ssh/sshd_config.d/10-portfolio-admin.conf <<CONF
Port $ADMIN_PORT
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
CONF
systemctl disable --now ssh.socket 2>/dev/null || true
systemctl enable ssh.service
systemctl restart ssh.service

# Service account and the host key visitors pin (kept across deploys).
id portfolio-ssh >/dev/null 2>&1 || useradd --system --home-dir /nonexistent --no-create-home --shell /usr/sbin/nologin portfolio-ssh
install -d -m 755 /opt/portfolio-ssh
install -d -m 750 -g portfolio-ssh /var/lib/portfolio-ssh
if [ ! -f /var/lib/portfolio-ssh/host_ed25519 ]; then
  ssh-keygen -q -t ed25519 -N '' -C portfolio-ssh -f /var/lib/portfolio-ssh/host_ed25519
fi
chgrp portfolio-ssh /var/lib/portfolio-ssh/host_ed25519
chmod 640 /var/lib/portfolio-ssh/host_ed25519

# Updater: installs the newest build from the release, then checks every two minutes.
cat > /etc/portfolio-ssh-release <<CONF
REPOSITORY=$REPOSITORY
RELEASE_TAG=$RELEASE_TAG
CONF
cat > /usr/local/sbin/portfolio-ssh-update <<'SCRIPT'
#!/bin/bash
# Installs the latest SSH portfolio build if its checksum changed.
set -euo pipefail
. /etc/portfolio-ssh-release
BASE="https://github.com/$REPOSITORY/releases/download/$RELEASE_TAG"
cd /opt/portfolio-ssh
LATEST=$(curl -fsSL --max-time 30 "$BASE/portfolio-ssh.sha256")
[ "$LATEST" = "$(cat VERSION 2>/dev/null || true)" ] && exit 0
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
curl -fsSL --max-time 300 -o "$WORK/portfolio-ssh.tar.gz" "$BASE/portfolio-ssh.tar.gz"
(cd "$WORK" && echo "$LATEST" | sha256sum -c --quiet -)
mkdir "$WORK/app"
tar -xzf "$WORK/portfolio-ssh.tar.gz" -C "$WORK/app" --no-same-owner
chmod -R u=rwX,go=rX "$WORK/app"
install -m 644 "$WORK/app/deploy/portfolio-ssh.service" /etc/systemd/system/portfolio-ssh.service
rm -rf app.previous
[ -d app ] && mv app app.previous
mv "$WORK/app" app
echo "$LATEST" > VERSION
systemctl daemon-reload
systemctl enable portfolio-ssh.service
systemctl restart portfolio-ssh.service
echo "installed $LATEST"
SCRIPT
chmod 755 /usr/local/sbin/portfolio-ssh-update

cat > /etc/systemd/system/portfolio-ssh-update.service <<'UNIT'
[Unit]
Description=Install the latest SSH portfolio build
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/portfolio-ssh-update
UNIT
cat > /etc/systemd/system/portfolio-ssh-update.timer <<'UNIT'
[Unit]
Description=Check for a new SSH portfolio build every two minutes

[Timer]
OnBootSec=30s
OnUnitActiveSec=2min
RandomizedDelaySec=15s

[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now portfolio-ssh-update.timer
/usr/local/sbin/portfolio-ssh-update || echo "no build published yet; the timer will retry"
