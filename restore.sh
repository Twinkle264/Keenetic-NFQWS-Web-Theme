#!/bin/sh
set -e

SELF_PATH="$0"

cleanup() {
    if [ -f "$SELF_PATH" ]; then
        rm -f "$SELF_PATH" >/dev/null 2>&1 || true
    fi
}

trap cleanup EXIT INT TERM

if [ -f "/tmp/restore-nfqws-web.sh" ] && [ "$SELF_PATH" != "/tmp/restore-nfqws-web.sh" ]; then
    rm -f "/tmp/restore-nfqws-web.sh" >/dev/null 2>&1 || true
fi

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

PREV=""
if [ -d "$TARGET" ]; then
    PREV="${TARGET}.prev.$(date +%s)"
    mv "$TARGET" "$PREV" || true
fi

mkdir -p "$(dirname "$TARGET")"
cp -a "$BACKUP/." "$TARGET/"

rm -rf "${TARGET}.bak" >/dev/null 2>&1 || true
if [ -n "$PREV" ]; then
    rm -rf "$PREV" >/dev/null 2>&1 || true
fi

echo "OK: restored backup from ${BACKUP} to ${TARGET}"
