#!/usr/bin/env bash
#
# Package Flafka for beta distribution.
# Creates flafka-beta.zip with only the files needed to run the app.
# Includes node_modules so testers can skip npm install.
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/flafka-beta.zip"

rm -f "$OUT"
cd "$ROOT"

echo "Staging files..."
STAGING=$(mktemp -d)

# Copy source (excluding tests and examples)
cp -r src/ "$STAGING/src/"
rm -rf "$STAGING/src/__tests__" "$STAGING/src/test"

cp -r public/ "$STAGING/public/"
rm -rf "$STAGING/public/examples"

# Copy config files
for f in index.html vite.config.ts tsconfig.json tsconfig.node.json package.json package-lock.json .env.example README.md; do
  cp "$f" "$STAGING/$f"
done

echo "Compressing (this may take a minute)..."
WIN_STAGING=$(cygpath -w "$STAGING")
WIN_OUT=$(cygpath -w "$OUT")
powershell.exe -NoProfile -Command "Compress-Archive -Path '$WIN_STAGING\*' -DestinationPath '$WIN_OUT' -Force"

rm -rf "$STAGING"

SIZE=$(du -h "$OUT" | cut -f1)
echo ""
echo "Created $OUT ($SIZE)"
