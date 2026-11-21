#!/usr/bin/env bash
# Puts the newest backend code live. Run it ON THE SERVER (later, GitHub Actions runs it for you):
#   bash ~/spaider/deploy/update-backend.sh
set -euo pipefail

cd "$HOME/spaider"
echo "1. Get the newest code"
git pull --ff-only

echo "2. Install any new Python packages"
backend/.venv/bin/pip install -q -r backend/requirements.txt

echo "3. Restart the backend (and pick up any change to the service file)"
sudo cp deploy/spaider.service /etc/systemd/system/spaider.service
sudo systemctl daemon-reload
sudo systemctl restart spaider

echo "4. Wait until it answers (up to 30 seconds)"
for second in $(seq 1 30); do
  if curl -fsS http://localhost:8000/api/health > /dev/null; then
    echo "Backend is live: $(git log -1 --format='%h %s')"
    exit 0
  fi
  sleep 1
done
echo "The backend did not start. Its last log lines:"
sudo journalctl -u spaider -n 40 --no-pager
exit 1
