#!/usr/bin/env bash
# Builds the React app and puts it live. Run it ON YOUR LAPTOP (later, GitHub Actions runs it for you):
#   SITE_BUCKET=spaider-site-1234 DISTRIBUTION_ID=E2ABCDEF123 bash deploy/update-frontend.sh
# Needs the AWS CLI, logged in as a user that may write to the bucket (see docs/DEPLOY.md).
set -euo pipefail
: "${SITE_BUCKET:?Set SITE_BUCKET to your S3 bucket name}"
: "${DISTRIBUTION_ID:?Set DISTRIBUTION_ID to your CloudFront distribution ID}"

cd "$(dirname "$0")/../frontend"
echo "1. Build"
npm ci
npm run build

echo "2. Upload the files with a hash in their name (assets/index-3f9a2c.js) first. A new build gives them"
echo "   new names, so browsers may keep them for a year. Old ones stay, for pages that are still open."
aws s3 sync dist/assets "s3://$SITE_BUCKET/assets" --cache-control "public, max-age=31536000, immutable"

echo "3. Then index.html and the rest, which keep their names, so browsers must check for a new version"
aws s3 sync dist "s3://$SITE_BUCKET" --exclude "assets/*" --cache-control "no-cache" --delete

echo "4. Tell CloudFront to drop its saved copies, so everyone gets the new version now"
aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" --paths "/*" --query "Invalidation.Id" --output text
echo "Frontend is live (CloudFront takes about a minute to update everywhere)."
