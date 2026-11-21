#!/usr/bin/env bash
# One-time setup of Caddy on the EC2: HTTPS, the website files, and /api passed to the backend.
# Run it ON THE SERVER (after git pull):   bash ~/spaider/deploy/setup-caddy.sh
# To change the site password later: sudo rm /etc/caddy/site-password.caddy, then run this again.
set -euo pipefail

echo "1. Install Caddy (it runs as a service, like spaider)"
sudo apt-get install -y -q caddy

echo "2. A folder for the website files (the laptop copies the React build into it)"
sudo mkdir -p /var/www/spaider
sudo chown ubuntu:ubuntu /var/www/spaider

echo "3. The site password (asked once; only its hash is stored, in /etc/caddy/site-password.caddy)"
if [ ! -f /etc/caddy/site-password.caddy ]; then
  read -rp "   Choose a username for the site: " SITE_USER
  read -rsp "   Choose a password (nothing shows while you type): " SITE_PASSWORD; echo
  read -rsp "   Type it again: " AGAIN; echo
  if [ "$SITE_PASSWORD" != "$AGAIN" ]; then
    echo "   The two passwords are different. Run the script again."
    exit 1
  fi
  HASH=$(caddy hash-password --plaintext "$SITE_PASSWORD")
  printf 'basicauth {\n\t%s %s\n}\n' "$SITE_USER" "$HASH" | sudo tee /etc/caddy/site-password.caddy > /dev/null
  sudo chmod 640 /etc/caddy/site-password.caddy
  sudo chown root:caddy /etc/caddy/site-password.caddy
fi

echo "4. Caddy's settings: deploy/Caddyfile"
sudo cp "$HOME/spaider/deploy/Caddyfile" /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile   # stops here if the file has a mistake
sudo systemctl restart caddy

echo
echo "Done. Caddy is now getting the HTTPS certificate (about 30 seconds). To watch it:"
echo "  sudo journalctl -u caddy -n 30 --no-pager"
