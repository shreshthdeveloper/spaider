#!/usr/bin/env bash
# Puts the newest code from GitHub live. Run it ON THE SERVER after you push a change:
#   bash ~/spaider/deploy/update.sh        updates only the parts that changed (backend, frontend, Caddy)
#   bash ~/spaider/deploy/update.sh all    rebuilds and restarts everything, even if nothing changed
# Later, the CI/CD pipeline runs this same script for you.
set -euo pipefail  # stop at the first error

cd "$HOME/spaider"
MODE="${1:-changed}"

echo "== 1. Get the newest code"
BEFORE=$(git rev-parse HEAD)
git pull --ff-only
AFTER=$(git rev-parse HEAD)
CHANGED=$(git diff --name-only "$BEFORE" "$AFTER")   # the files that changed since the last update

# Decide what to update: everything with "all", otherwise only the parts whose files changed.
UPDATE_BACKEND=no
UPDATE_FRONTEND=no
UPDATE_CADDY=no
if [ "$MODE" = "all" ] || echo "$CHANGED" | grep -qE '^(backend/|deploy/spaider.service)'; then UPDATE_BACKEND=yes; fi
if [ "$MODE" = "all" ] || echo "$CHANGED" | grep -qE '^frontend/'; then UPDATE_FRONTEND=yes; fi
if [ "$MODE" = "all" ] || echo "$CHANGED" | grep -qE '^deploy/Caddyfile'; then UPDATE_CADDY=yes; fi
echo "   backend: $UPDATE_BACKEND   frontend: $UPDATE_FRONTEND   caddy: $UPDATE_CADDY"

if [ "$UPDATE_BACKEND" = yes ]; then
  echo "== 2. Backend: install packages, restart, wait until it answers"
  backend/.venv/bin/pip install -q -r backend/requirements.txt
  sudo cp deploy/spaider.service /etc/systemd/system/spaider.service
  sudo systemctl daemon-reload
  sudo systemctl restart spaider
  for second in $(seq 1 30); do
    if curl -fs http://localhost:8000/api/health > /dev/null 2>&1; then break; fi   # not up yet: try again in a second
    if [ "$second" = 30 ]; then
      echo "The backend did not start. Its last log lines:"
      sudo journalctl -u spaider -n 40 --no-pager
      exit 1
    fi
    sleep 1
  done
  echo "   backend is up: $(curl -s http://localhost:8000/api/health)"
fi

if [ "$UPDATE_FRONTEND" = yes ]; then
  echo "== 3. Frontend: build the React app and publish it"
  cd frontend
  npm ci --no-audit --no-fund --loglevel=error   # only real errors (Excalidraw's React-version warnings are harmless)
  npm run build -- --logLevel warn                # only warnings, not the list of every built file
  rsync -a --delete dist/ /var/www/spaider/   # Caddy serves this folder; --delete keeps it an exact copy
  cd ..
  echo "   website files updated"
fi

if [ "$UPDATE_CADDY" = yes ]; then
  echo "== 4. Caddy: new settings"
  sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
  sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile   # stops here, with the reason, if the file has a mistake
  sudo systemctl reload caddy
fi

echo "== Live: $(git log -1 --format='%h %s')"
