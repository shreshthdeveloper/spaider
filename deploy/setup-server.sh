#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu 24.04 EC2 for the SpAIder backend. Run it ON THE SERVER:
#   bash setup-server.sh https://github.com/<you>/<repo>.git
set -euo pipefail  # stop at the first error

REPO_URL="$1"
APP_DIR="$HOME/spaider"

echo "1. System packages: Python tools and git"
sudo apt-get update -q
sudo apt-get install -y -q python3-venv python3-pip git

echo "2. 2 GB of swap: memory on disk, so installing packages on a 2 GB server can't run out of memory"
if [ ! -f /swapfile ]; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

echo "3. The code"
if [ ! -d "$APP_DIR" ]; then
  git clone "$REPO_URL" "$APP_DIR"
fi

echo "4. Python packages, in a virtual environment (takes a few minutes)"
cd "$APP_DIR/backend"
python3 -m venv .venv
.venv/bin/pip install -q --upgrade pip
.venv/bin/pip install -q -r requirements.txt

echo "5. The service (deploy/spaider.service)"
sudo cp "$APP_DIR/deploy/spaider.service" /etc/systemd/system/spaider.service
sudo systemctl daemon-reload
sudo systemctl enable spaider

echo
echo "Done. Next:"
echo "  1. create $APP_DIR/backend/.env   (nano $APP_DIR/backend/.env, copy the lines from .env.example)"
echo "  2. sudo systemctl start spaider"
echo "  3. curl localhost:8000/api/health"
