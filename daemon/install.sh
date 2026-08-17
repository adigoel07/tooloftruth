#!/bin/bash
# Tool of Truth — Daemon Setup
# Installs the background MCP server as a launchd service on macOS

set -e

PLIST_NAME="com.tooloftruth.mcp"
PLIST_PATH="$HOME/Library/LaunchAgents/${PLIST_NAME}.plist"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Tool of Truth — Daemon Setup"
echo "============================"
echo ""

# Check if already installed
if launchctl list | grep -q "$PLIST_NAME" 2>/dev/null; then
    echo "Daemon already running. Stopping..."
    launchctl unload "$PLIST_PATH" 2>/dev/null || true
fi

# Copy plist
echo "Installing launchd agent..."
cp "$SCRIPT_DIR/com.tooloftruth.mcp.plist" "$PLIST_PATH"

# Load
echo "Starting daemon..."
launchctl load "$PLIST_PATH"

echo ""
echo "✓ Daemon installed and started!"
echo ""
echo "The MCP server is now running in the background."
echo "It will start automatically on login."
echo ""
echo "Logs: ~/.tooloftruth/daemon.log"
echo "Errors: ~/.tooloftruth/daemon-error.log"
echo ""
echo "To stop: launchctl unload ~/Library/LaunchAgents/${PLIST_NAME}.plist"
echo "To start: launchctl load ~/Library/LaunchAgents/${PLIST_NAME}.plist"
