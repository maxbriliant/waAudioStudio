#!/bin/bash

# uninstaller.sh - Uninstall the WhatsApp Audio Studio project
# This script removes systemd services, watchdog scripts, and optionally dependencies,
# the watchdog folder, and npm dependencies. It is idempotent and safe to run multiple times.

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_DIR="/usr/local/bin"
SYSTEMD_DIR="/etc/systemd/system"
WATCHDOG_SCRIPTS=("ffmpeg-converter.sh" "watch-whatsapp-folder.sh")
WATCHDOG_SERVICE="audio-webm-watcher.service"
SERVER_SERVICE="whatsapp-audio-server.service"
WATCHDOG_FOLDER="/home/$SUDO_USER/Music/WhatsappMessages"
LOG_FILE="/tmp/watchdog.log"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    echo -e "${RED}Error: This script must be run as root (use sudo).${NC}"
    exit 1
fi

# Get current username (non-root user who invoked sudo)
CURRENT_USER="${SUDO_USER:-$(whoami)}"
if [[ "$CURRENT_USER" == "root" ]]; then
    echo -e "${RED}Error: Please run this script as a non-root user with sudo.${NC}"
    exit 1
fi

echo -e "${GREEN}Starting WhatsApp Audio Studio uninstallation...${NC}"

# Step 1: Stop and disable systemd services
for service in "$SERVER_SERVICE" "$WATCHDOG_SERVICE"; do
    if systemctl is-active "$service" >/dev/null 2>&1; then
        echo -e "${YELLOW}Stopping $service...${NC}"
        systemctl stop "$service"
        echo -e "${GREEN}Stopped $service${NC}"
    fi
    if systemctl is-enabled "$service" >/dev/null 2>&1; then
        echo -e "${YELLOW}Disabling $service...${NC}"
        systemctl disable "$service"
        echo -e "${GREEN}Disabled $service${NC}"
    fi
done

# Step 2: Remove systemd service files
for service in "$SERVER_SERVICE" "$WATCHDOG_SERVICE"; do
    if [[ -f "$SYSTEMD_DIR/$service" ]]; then
        echo -e "${YELLOW}Removing $service from $SYSTEMD_DIR...${NC}"
        rm "$SYSTEMD_DIR/$service"
        echo -e "${GREEN}Removed $service${NC}"
    else
        echo -e "${GREEN}$service not found in $SYSTEMD_DIR, skipping${NC}"
    fi
done

# Step 3: Reload systemd daemon
echo -e "${YELLOW}Reloading systemd daemon...${NC}"
systemctl daemon-reload
systemctl reset-failed >/dev/null 2>&1 || true
echo -e "${GREEN}Systemd daemon reloaded${NC}"

# Step 4: Remove watchdog scripts
for script in "${WATCHDOG_SCRIPTS[@]}"; do
    if [[ -f "$BIN_DIR/$script" ]]; then
        echo -e "${YELLOW}Removing $script from $BIN_DIR...${NC}"
        rm "$BIN_DIR/$script"
        echo -e "${GREEN}Removed $script${NC}"
    else
        echo -e "${GREEN}$script not found in $BIN_DIR, skipping${NC}"
    fi
done

# Step 5: Ask to remove dependencies
echo -e "${YELLOW}Do you want to remove dependencies (ffmpeg, inotify-tools, nodejs)? (y/n)${NC}"
read -r REMOVE_DEPS
if [[ "$REMOVE_DEPS" =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Removing dependencies...${NC}"
    if command -v pacman >/dev/null 2>&1; then
        # Arch Linux
        pacman -Rns --noconfirm ffmpeg inotify-tools nodejs-lts-gallium npm 2>/dev/null || true
        echo -e "${GREEN}Dependencies removed (Arch Linux)${NC}"
    elif command -v apt >/dev/null 2>&1; then
        # Debian/Ubuntu
        apt purge -y ffmpeg inotify-tools nodejs 2>/dev/null || true
        apt autoremove -y 2>/dev/null || true
        echo -e "${GREEN}Dependencies removed (Debian/Ubuntu)${NC}"
    else
        echo -e "${RED}Unsupported distribution. Please remove ffmpeg, inotify-tools, and nodejs manually.${NC}"
    fi
else
    echo -e "${GREEN}Keeping dependencies installed${NC}"
fi

# Step 6: Ask to remove watchdog folder
if [[ -d "$WATCHDOG_FOLDER" ]]; then
    echo -e "${YELLOW}Do you want to delete the audio output folder ($WATCHDOG_FOLDER)? This will remove all audio files! (y/n)${NC}"
    read -r REMOVE_FOLDER
    if [[ "$REMOVE_FOLDER" =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Removing $WATCHDOG_FOLDER...${NC}"
        rm -rf "$WATCHDOG_FOLDER"
        echo -e "${GREEN}Removed $WATCHDOG_FOLDER${NC}"
    else
        echo -e "${GREEN}Keeping $WATCHDOG_FOLDER${NC}"
    fi
else
    echo -e "${GREEN}Watchdog folder ($WATCHDOG_FOLDER) not found, skipping${NC}"
fi

# Step 7: Ask to remove watchdog log file
if [[ -f "$LOG_FILE" ]]; then
    echo -e "${YELLOW}Do you want to delete the watchdog log file ($LOG_FILE)? (y/n)${NC}"
    read -r REMOVE_LOG
    if [[ "$REMOVE_LOG" =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Removing $LOG_FILE...${NC}"
        rm -f "$LOG_FILE"
        echo -e "${GREEN}Removed $LOG_FILE${NC}"
    else
        echo -e "${GREEN}Keeping $LOG_FILE${NC}"
    fi
else
    echo -e "${GREEN}Watchdog log file ($LOG_FILE) not found, skipping${NC}"
fi

# Step 8: Ask to remove npm dependencies
if [[ -d "$SCRIPT_DIR/node_modules" || -f "$SCRIPT_DIR/package-lock.json" ]]; then
    echo -e "${YELLOW}Do you want to remove npm dependencies (node_modules, package-lock.json)? (y/n)${NC}"
    read -r REMOVE_NPM
    if [[ "$REMOVE_NPM" =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Removing npm dependencies...${NC}"
        rm -rf "$SCRIPT_DIR/node_modules" "$SCRIPT_DIR/package-lock.json"
        echo -e "${GREEN}Removed npm dependencies${NC}"
    else
        echo -e "${GREEN}Keeping npm dependencies${NC}"
    fi
else
    echo -e "${GREEN}No npm dependencies found, skipping${NC}"
fi

# Step 9: Final message
echo -e "${GREEN}Uninstallation complete!${NC}"
echo -e "${BLUE}=== Uninstallation Summary ===${NC}"
echo -e "${YELLOW}- Systemd services ($SERVER_SERVICE, $WATCHDOG_SERVICE) stopped and removed.${NC}"
echo -e "${YELLOW}- Watchdog scripts removed from $BIN_DIR.${NC}"
if [[ "$REMOVE_DEPS" =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}- Dependencies (ffmpeg, inotify-tools, nodejs) removed.${NC}"
else
    echo -e "${YELLOW}- Dependencies were not removed.${NC}"
fi
if [[ "$REMOVE_FOLDER" =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}- Audio output folder ($WATCHDOG_FOLDER) deleted.${NC}"
else
    echo -e "${YELLOW}- Audio output folder ($WATCHDOG_FOLDER) was not deleted.${NC}"
fi
if [[ "$REMOVE_LOG" =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}- Watchdog log file ($LOG_FILE) deleted.${NC}"
else
    echo -e "${YELLOW}- Watchdog log file ($LOG_FILE) was not deleted.${NC}"
fi
if [[ "$REMOVE_NPM" =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}- npm dependencies (node_modules, package-lock.json) removed.${NC}"
else
    echo -e "${YELLOW}- npm dependencies were not removed.${NC}"
fi
echo -e "${BLUE}============================${NC}"