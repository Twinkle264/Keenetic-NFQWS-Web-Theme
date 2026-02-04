#!/bin/sh
set -e

TARGET=""
BACKUP=""

if [ -d "/opt" ] && [ -w "/opt" ]; then
    TARGET="/opt/share/www/nfqws"
else
    TARGET="/share/www/nfqws"
fi

BACKUP="${TARGET}.bak"

if [ ! -d "$BACKUP" ]; then
    echo "Backup not found: $BACKUP"
    exit 1
fi

if [ -d "$TARGET" ]; then
    mv "$TARGET" "${TARGET}.prev.$(date +%s)" || true
fi

mkdir -p "$(dirname "$TARGET")"
cp -a "$BACKUP/." "$TARGET/"

echo "OK: restored backup from ${BACKUP} to ${TARGET}"
