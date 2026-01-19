#!/bin/bash
set -euo pipefail

# dev-proxy installer
# Usage: curl -fsSL https://raw.githubusercontent.com/resila-inc/dev-proxy/main/install.sh | bash

REPO="resila-inc/dev-proxy"
APP_NAME="dev-proxy"
INSTALL_DIR="/Applications"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() { echo -e "${GREEN}==>${NC} $1"; }
warn() { echo -e "${YELLOW}==>${NC} $1"; }
error() { echo -e "${RED}==>${NC} $1"; exit 1; }

# Check macOS
if [[ "$(uname)" != "Darwin" ]]; then
    error "This installer only supports macOS"
fi

# Detect architecture
ARCH=$(uname -m)
case "$ARCH" in
    arm64) ASSET_PATTERN="arm64.dmg" ;;
    x86_64) ASSET_PATTERN="x64.dmg" ;;
    *) error "Unsupported architecture: $ARCH" ;;
esac

info "Detecting architecture: $ARCH"

# Get latest release
info "Fetching latest release..."
RELEASE_INFO=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest")
TAG=$(echo "$RELEASE_INFO" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
DOWNLOAD_URL=$(echo "$RELEASE_INFO" | grep "browser_download_url.*$ASSET_PATTERN" | sed -E 's/.*"([^"]+)".*/\1/')

if [[ -z "$DOWNLOAD_URL" ]]; then
    error "Could not find download URL for $ASSET_PATTERN"
fi

info "Latest version: $TAG"

# Create temp directory
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

DMG_PATH="$TEMP_DIR/$APP_NAME.dmg"
MOUNT_POINT="$TEMP_DIR/mount"

# Download
info "Downloading $APP_NAME..."
curl -fSL --progress-bar "$DOWNLOAD_URL" -o "$DMG_PATH"

# Mount DMG
info "Mounting DMG..."
mkdir -p "$MOUNT_POINT"
hdiutil attach "$DMG_PATH" -mountpoint "$MOUNT_POINT" -nobrowse -quiet

# Check if app already exists
if [[ -d "$INSTALL_DIR/$APP_NAME.app" ]]; then
    warn "Existing installation found. Removing..."
    rm -rf "$INSTALL_DIR/$APP_NAME.app"
fi

# Copy app
info "Installing to $INSTALL_DIR..."
cp -R "$MOUNT_POINT/$APP_NAME.app" "$INSTALL_DIR/"

# Unmount
hdiutil detach "$MOUNT_POINT" -quiet

# Remove quarantine attribute
info "Removing quarantine attribute..."
xattr -cr "$INSTALL_DIR/$APP_NAME.app"

info "Installation complete!"
echo ""
echo "To start dev-proxy:"
echo "  open /Applications/$APP_NAME.app"
echo ""
echo "Or search for '$APP_NAME' in Spotlight."
