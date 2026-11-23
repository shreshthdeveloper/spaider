#!/usr/bin/env bash
# Installs a GitHub Actions runner on this server, once. After that, every push to main deploys by itself: when
# the checks in .github/workflows/ci.yml pass, the "deploy" job runs deploy/update.sh here, on this server.
#
# The runner only makes outgoing connections to GitHub, so no port is opened and no key is stored in GitHub.
#
# 1. On your laptop, get a registration token (it works for one hour):
#      gh api -X POST repos/<owner>/<repo>/actions/runners/registration-token --jq .token
# 2. On the server:
#      bash ~/spaider/deploy/setup-runner.sh <token>
set -euo pipefail

TOKEN="${1:?Give the registration token: bash setup-runner.sh <token>}"
RUNNER_DIR="$HOME/actions-runner"
REPO_URL="$(git -C "$HOME/spaider" remote get-url origin)"
REPO_URL="${REPO_URL%.git}"  # https://github.com/<owner>/<repo>

if [ -f "$RUNNER_DIR/.runner" ]; then
  echo "A runner is already set up in $RUNNER_DIR. To set it up again, remove it first:"
  echo "  cd $RUNNER_DIR && sudo ./svc.sh stop && sudo ./svc.sh uninstall && ./config.sh remove --token <token>"
  exit 1
fi

echo "1. Download the newest runner"
# Read the whole answer first: piping curl straight into "grep -m1" makes curl fail when grep stops reading early.
RELEASE="$(curl -fsSL https://api.github.com/repos/actions/runner/releases/latest)"
VERSION="$(echo "$RELEASE" | grep '"tag_name"' | sed -E 's/.*"v([^"]+)".*/\1/')"
echo "   version $VERSION"
mkdir -p "$RUNNER_DIR"
cd "$RUNNER_DIR"
curl -fsSL -o runner.tar.gz "https://github.com/actions/runner/releases/download/v${VERSION}/actions-runner-linux-x64-${VERSION}.tar.gz"
tar xzf runner.tar.gz
rm runner.tar.gz
sudo ./bin/installdependencies.sh > /dev/null

echo "2. Connect it to $REPO_URL (label: spaider)"
./config.sh --url "$REPO_URL" --token "$TOKEN" --name spaider-ec2 --labels spaider --unattended

echo "3. Run it as a service (as $USER, the owner of ~/spaider), so it starts again after a reboot"
sudo ./svc.sh install "$USER"
sudo ./svc.sh start

echo
echo "Done. The runner shows as Idle in GitHub: Settings → Actions → Runners."
