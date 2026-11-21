#!/usr/bin/env bash
# One command, on your laptop: push your commits to GitHub, then have the server put them live.
#   bash deploy/ship.sh          updates only the parts that changed
#   bash deploy/ship.sh all      rebuilds and restarts everything
# It ships what is COMMITTED, so the server always runs exactly what is on GitHub.
# The server's address and the key can be changed with SPAIDER_SERVER and SPAIDER_KEY.
set -euo pipefail

SERVER="${SPAIDER_SERVER:-ubuntu@15.134.148.124}"
KEY="${SPAIDER_KEY:-$HOME/spaider-keys/spaider-key.pem}"
cd "$(dirname "$0")/.."

if [ "$(git branch --show-current)" != "main" ]; then
  echo "You are on branch '$(git branch --show-current)'. The server runs 'main': switch to main (or merge into it) first."
  exit 1
fi
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "These changes aren't committed yet, so they wouldn't go live:"
  git status --short --untracked-files=no
  echo "Commit them first:  git add -A && git commit -m \"what you changed\""
  exit 1
fi

echo "== Push to GitHub"
git push

echo "== The server pulls and updates"
ssh -i "$KEY" -o IdentitiesOnly=yes "$SERVER" "bash ~/spaider/deploy/update.sh ${1:-}"
