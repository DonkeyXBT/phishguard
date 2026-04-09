#!/usr/bin/env bash
#
# Generate environment-specific Outlook add-in manifests.
#
# Usage:
#   ./generate-manifest.sh                        # defaults to production
#   ENV=dev   ./generate-manifest.sh              # dev with localhost
#   ENV=staging ./generate-manifest.sh             # staging
#
# Output: manifest-{ENV}.xml in the outlook-addin directory
#
set -euo pipefail

ENV="${ENV:-production}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEMPLATE="$SCRIPT_DIR/manifest.template.xml"
OUTPUT="$SCRIPT_DIR/manifest-${ENV}.xml"

case "$ENV" in
  dev|development)
    BASE_URL="https://localhost:3000"
    ;;
  staging)
    BASE_URL="${STAGING_URL:-https://phishguard-staging.vercel.app}"
    ;;
  production|prod)
    BASE_URL="${PRODUCTION_URL:-https://phishing-detector-orpin-ten.vercel.app}"
    ;;
  *)
    echo "Unknown environment: $ENV (use dev, staging, or production)"
    exit 1
    ;;
esac

if [ ! -f "$TEMPLATE" ]; then
  echo "Template not found: $TEMPLATE"
  exit 1
fi

sed "s|{{BASE_URL}}|${BASE_URL}|g" "$TEMPLATE" > "$OUTPUT"
echo "Generated $OUTPUT (base: $BASE_URL)"
