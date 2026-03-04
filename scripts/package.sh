#!/usr/bin/env bash
#
# Package Flafka for beta distribution.
# Creates flafka-beta.zip with only the files needed to run the app.
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/flafka-beta.zip"

rm -f "$OUT"

cd "$ROOT"

# Collect files, excluding tests and internal dirs
find src/ public/ \
  -not -path "src/__tests__/*" \
  -not -path "src/test/*" \
  -not -path "public/examples/*" \
  -type f > /tmp/flafka-filelist.txt

# Add root config files
echo "index.html" >> /tmp/flafka-filelist.txt
echo "vite.config.ts" >> /tmp/flafka-filelist.txt
echo "tsconfig.json" >> /tmp/flafka-filelist.txt
echo "tsconfig.node.json" >> /tmp/flafka-filelist.txt
echo "package.json" >> /tmp/flafka-filelist.txt
echo "package-lock.json" >> /tmp/flafka-filelist.txt
echo ".env.example" >> /tmp/flafka-filelist.txt
echo "README.md" >> /tmp/flafka-filelist.txt

# Use PowerShell Compress-Archive for zip (works on Windows)
if command -v powershell.exe &>/dev/null; then
  # Create a temp dir with just the files we need
  STAGING=$(mktemp -d)
  while IFS= read -r f; do
    mkdir -p "$STAGING/$(dirname "$f")"
    cp "$f" "$STAGING/$f"
  done < /tmp/flafka-filelist.txt

  WIN_STAGING=$(cygpath -w "$STAGING")
  WIN_OUT=$(cygpath -w "$OUT")
  powershell.exe -NoProfile -Command "Compress-Archive -Path '$WIN_STAGING\\*' -DestinationPath '$WIN_OUT' -Force"
  rm -rf "$STAGING"
elif command -v zip &>/dev/null; then
  zip -r "$OUT" -@ < /tmp/flafka-filelist.txt
else
  echo "Error: Neither PowerShell nor zip found. Cannot create archive."
  exit 1
fi

rm -f /tmp/flafka-filelist.txt

SIZE=$(du -h "$OUT" | cut -f1)
echo ""
echo "Created $OUT ($SIZE)"
