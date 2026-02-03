#!/bin/sh
set -e

REPO_OWNER="Twinkle264"
REPO_NAME="Keenetic-NFQWS-Web-Theme"
TARGET="/opt/share/www/nfqws"

VERSION=""
WITH_BACKUP="false"

for arg in "$@"; do
    case "$arg" in
        --backup)
            WITH_BACKUP="true"
            ;;
        *)
            if [ -z "$VERSION" ]; then
                VERSION="$arg"
            fi
            ;;
    esac
done

need_cmd() {
    command -v "$1" >/dev/null 2>&1
}

ensure_cmd() {
    if need_cmd "$1"; then
        return 0
    fi
    if need_cmd opkg; then
        opkg update >/dev/null 2>&1 || true
        opkg install "$2" >/dev/null 2>&1 || opkg install "$1"
    fi
}

get_latest_version() {
    if ! need_cmd wget; then
        return 1
    fi
    wget -qO- "https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest" \
        | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\(v\{0,1\}[0-9][^"]*\)".*/\1/p' \
        | head -n 1
}

ensure_cmd wget wget-ssl
ensure_cmd tar tar

if ! need_cmd wget || ! need_cmd tar; then
    echo "wget/tar not found. Install them first (opkg install wget-ssl tar)."
    exit 1
fi

if [ -z "$VERSION" ]; then
    VERSION="$(get_latest_version)"
fi

if [ -z "$VERSION" ]; then
    echo "Failed to detect latest release. Provide version, e.g.: sh install.sh v0.2.0"
    exit 1
fi

VERSION_TAG="$VERSION"
VERSION_NO_V="${VERSION#v}"
ARCHIVE="Keenetic-NFQWS-Web-Theme_${VERSION_NO_V}.tar.gz"
URL="https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${VERSION_TAG}/${ARCHIVE}"

TMP="/tmp/nfqws-web-install.$$"
mkdir -p "$TMP"
cd "$TMP"

wget -qO "$ARCHIVE" "$URL"

mkdir -p "$TARGET"
if [ "$WITH_BACKUP" = "true" ] && [ -d "$TARGET" ]; then
    cp -a "$TARGET" "${TARGET}.bak" >/dev/null 2>&1 || true
fi

tar -xzf "$ARCHIVE" -C "$TMP/unpacked"
cp -a "$TMP/unpacked/." "$TARGET/"

cd /
rm -rf "$TMP"

echo "OK: installed ${VERSION_TAG} to ${TARGET}"
