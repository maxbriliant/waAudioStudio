#!/bin/bash

# installer.sh - Install and configure the WhatsApp Audio Studio project
# This script installs the React server, watchdog service, and configures all components.
# It is idempotent, safe, and can be re-run to adjust settings (e.g., enable services on boot).
# Supports Arch Linux and Debian/Ubuntu; other distros require manual dependency installation.

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
WATCHDOG_DIR="$SCRIPT_DIR/webm-ffmpeg-watchdog"
WATCHDOG_SCRIPTS=("ffmpeg-converter.sh" "watch-whatsapp-folder.sh")
WATCHDOG_SERVICE="audio-webm-watcher.service"
SERVER_SERVICE="whatsapp-audio-server.service"
WATCHDOG_FOLDER="/home/$SUDO_USER/Music/WhatsappMessages"
NODE_VERSION="16"  # Preferred Node.js version
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

echo -e "${GREEN}Starting WhatsApp Audio Studio installation...${NC}"

# Step 1: Detect distribution and install dependencies
echo -e "${YELLOW}Checking and installing dependencies (ffmpeg, inotify-tools, nodejs)...${NC}"
install_deps() {
    if command -v pacman >/dev/null 2>&1; then
        # Arch Linux
        if ! command -v ffmpeg >/dev/null 2>&1 || ! command -v inotifywait >/dev/null 2>&1; then
            pacman -Syu --noconfirm
            pacman -S --noconfirm ffmpeg inotify-tools
        fi
        if ! command -v node >/dev/null 2>&1 || ! node -v | grep -q "v$NODE_VERSION"; then
            pacman -S --noconfirm nodejs-lts-gallium npm  # Node.js v16
        fi
    elif command -v apt >/dev/null 2>&1; then
        # Debian/Ubuntu
        if ! command -v ffmpeg >/dev/null 2>&1 || ! command -v inotifywait >/dev/null 2>&1; then
            apt update
            apt install -y ffmpeg inotify-tools
        fi
        if ! command -v node >/dev/null 2>&1 || ! node -v | grep -q "v$NODE_VERSION"; then
            curl -fsSL https://deb.nodesource.com/setup_$NODE_VERSION.x | bash -
            apt install -y nodejs
        fi
    else
        echo -e "${RED}Error: Unsupported distribution. Please install ffmpeg, inotify-tools, and Node.js v$NODE_VERSION manually.${NC}"
        exit 1
    fi
}
if ! command -v ffmpeg >/dev/null 2>&1 || ! command -v inotifywait >/dev/null 2>&1 || ! command -v node >/dev/null 2>&1; then
    install_deps
    echo -e "${GREEN}Dependencies installed${NC}"
else
    echo -e "${GREEN}Dependencies already installed${NC}"
fi

# Step 2: Create watchdog folder
echo -e "${YELLOW}Creating watchdog folder at $WATCHDOG_FOLDER...${NC}"
if [[ ! -d "$WATCHDOG_FOLDER" ]]; then
    mkdir -p "$WATCHDOG_FOLDER"
    chown "$CURRENT_USER:$CURRENT_USER" "$WATCHDOG_FOLDER"
    echo -e "${GREEN}Created $WATCHDOG_FOLDER${NC}"
else
    echo -e "${GREEN}Watchdog folder already exists${NC}"
fi

# Step 3: Install npm dependencies
echo -e "${YELLOW}Installing npm dependencies...${NC}"
cd "$SCRIPT_DIR"
if [[ -f "package.json" ]]; then
    if [[ ! -d "node_modules" ]] || ! npm ls >/dev/null 2>&1; then
        npm install
        echo -e "${GREEN}npm dependencies installed${NC}"
    else
        echo -e "${GREEN}npm dependencies already installed${NC}"
    fi
else
    echo -e "${RED}Error: package.json not found in $SCRIPT_DIR${NC}"
    exit 1
fi

# Step 4: Create systemd service for React server
echo -e "${YELLOW}Creating systemd service for React server ($SERVER_SERVICE)...${NC}"
cat > "$SYSTEMD_DIR/$SERVER_SERVICE" << EOF
[Unit]
Description=WhatsApp Audio Studio React Server
After=network.target

[Service]
ExecStart=/usr/bin/npm start
WorkingDirectory=$SCRIPT_DIR
Restart=always
User=$CURRENT_USER
Environment=PATH=/usr/local/bin:/usr/bin:/bin
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
echo -e "${GREEN}Created $SERVER_SERVICE${NC}"

# Step 5: Copy watchdog scripts to /usr/local/bin
echo -e "${YELLOW}Copying watchdog scripts to $BIN_DIR...${NC}"
for script in "${WATCHDOG_SCRIPTS[@]}"; do
    if [[ -f "$WATCHDOG_DIR/$script" ]]; then
        cp "$WATCHDOG_DIR/$script" "$BIN_DIR/"
        chmod +x "$BIN_DIR/$script"
        echo -e "${GREEN}Copied and made executable: $script${NC}"
    else
        echo -e "${RED}Error: $script not found in $WATCHDOG_DIR${NC}"
        exit 1
    fi
done

# Step 6: Copy watchdog systemd service
echo -e "${YELLOW}Copying $WATCHDOG_SERVICE to $SYSTEMD_DIR...${NC}"
if [[ -f "$WATCHDOG_DIR/$WATCHDOG_SERVICE" ]]; then
    cp "$WATCHDOG_DIR/$WATCHDOG_SERVICE" "$SYSTEMD_DIR/"
    echo -e "${GREEN}Copied: $WATCHDOG_SERVICE${NC}"
else
    echo -e "${RED}Error: $WATCHDOG_SERVICE not found in $WATCHDOG_DIR${NC}"
    exit 1
fi

# Step 7: Configure target_user in ffmpeg-converter.sh
echo -e "${YELLOW}Configuring target_user in $BIN_DIR/ffmpeg-converter.sh...${NC}"
if [[ -f "$BIN_DIR/ffmpeg-converter.sh" ]]; then
    if grep -q "target_user=\"$CURRENT_USER\"" "$BIN_DIR/ffmpeg-converter.sh"; then
        echo -e "${GREEN}target_user already set to $CURRENT_USER${NC}"
    else
        if grep -q "target_user=" "$BIN_DIR/ffmpeg-converter.sh"; then
            sed -i "s/target_user=.*/target_user=\"$CURRENT_USER\"/" "$BIN_DIR/ffmpeg-converter.sh"
        else
            echo "target_user=\"$CURRENT_USER\"" >> "$BIN_DIR/ffmpeg-converter.sh"
        fi
        echo -e "${GREEN}Set target_user to $CURRENT_USER${NC}"
    fi
else
    echo -e "${RED}Error: ffmpeg-converter.sh not found in $BIN_DIR${NC}"
    exit 1
fi

# Step 8: Configure User in audio-webm-watcher.service
echo -e "${YELLOW}Configuring User in $SYSTEMD_DIR/$WATCHDOG_SERVICE...${NC}"
if [[ -f "$SYSTEMD_DIR/$WATCHDOG_SERVICE" ]]; then
    if grep -q "User=$CURRENT_USER" "$SYSTEMD_DIR/$WATCHDOG_SERVICE"; then
        echo -e "${GREEN}User already set to $CURRENT_USER${NC}"
    else
        if grep -q "User=" "$SYSTEMD_DIR/$WATCHDOG_SERVICE"; then
            sed -i "s/User=.*/User=$CURRENT_USER/" "$SYSTEMD_DIR/$WATCHDOG_SERVICE"
        else
            sed -i '/\[Service\]/a User='"$CURRENT_USER" "$SYSTEMD_DIR/$WATCHDOG_SERVICE"
        fi
        echo -e "${GREEN}Set User to $CURRENT_USER${NC}"
    fi
else
    echo -e "${RED}Error: $WATCHDOG_SERVICE not found in $SYSTEMD_DIR${NC}"
    exit 1
fi

# Step 9: Ensure watchdog log file permissions
echo -e "${YELLOW}Setting permissions for $LOG_FILE...${NC}"
if [[ -f "$LOG_FILE" ]]; then
    chown "$CURRENT_USER:$CURRENT_USER" "$LOG_FILE"
    chmod 644 "$LOG_FILE"
    echo -e "${GREEN}Permissions set for $LOG_FILE${NC}"
else
    touch "$LOG_FILE"
    chown "$CURRENT_USER:$CURRENT_USER" "$LOG_FILE"
    chmod 644 "$LOG_FILE"
    echo -e "${GREEN}Created and set permissions for $LOG_FILE${NC}"
fi

# Step 10: Reload systemd
echo -e "${YELLOW}Reloading systemd daemon...${NC}"
systemctl daemon-reload
echo -e "${GREEN}Systemd daemon reloaded${NC}"

# Step 11: Ask if the user wants to enable the server service on boot
SERVER_ENABLED=$(systemctl is-enabled "$SERVER_SERVICE" 2>/dev/null || echo "disabled")
if [[ "$SERVER_ENABLED" == "enabled" ]]; then
    echo -e "${GREEN}React server service is already enabled to start on boot.${NC}"
else
    echo -e "${YELLOW}Do you want to enable the $SERVER_SERVICE to start automatically on boot? (y/n)${NC}"
    read -r ENABLE_SERVER
    if [[ "$ENABLE_SERVER" =~ ^[Yy]$ ]]; then
        systemctl enable "$SERVER_SERVICE"
        echo -e "${GREEN}React server service enabled to start on boot${NC}"
    else
        echo -e "${YELLOW}React server service will not start automatically on boot. You can enable it later with:${NC}"
        echo "  sudo systemctl enable $SERVER_SERVICE"
    fi
fi

# Step 12: Ask if the user wants to enable the watchdog service on boot
WATCHDOG_ENABLED=$(systemctl is-enabled "$WATCHDOG_SERVICE" 2>/dev/null || echo "disabled")
if [[ "$WATCHDOG_ENABLED" == "enabled" ]]; then
    echo -e "${GREEN}Watchdog service is already enabled to start on boot.${NC}"
else
    echo -e "${YELLOW}Do you want to enable the $WATCHDOG_SERVICE to start automatically on boot? (y/n)${NC}"
    read -r ENABLE_WATCHDOG
    if [[ "$ENABLE_WATCHDOG" =~ ^[Yy]$ ]]; then
        systemctl enable "$WATCHDOG_SERVICE"
        echo -e "${GREEN}Watchdog service enabled to start on boot${NC}"
    else
        echo -e "${YELLOW}Watchdog service will not start automatically on boot. You can enable it later with:${NC}"
        echo "  sudo systemctl enable $WATCHDOG_SERVICE"
    fi
fi

# Step 13: Start or restart services
echo -e "${YELLOW}Starting or restarting $SERVER_SERVICE...${NC}"
if systemctl is-active "$SERVER_SERVICE" >/dev/null; then
    systemctl restart "$SERVER_SERVICE"
    echo -e "${GREEN}React server service restarted${NC}"
else
    systemctl start "$SERVER_SERVICE"
    echo -e "${GREEN}React server service started${NC}"
fi

echo -e "${YELLOW}Starting or restarting $WATCHDOG_SERVICE...${NC}"
if systemctl is-active "$WATCHDOG_SERVICE" >/dev/null; then
    systemctl restart "$WATCHDOG_SERVICE"
    echo -e "${GREEN}Watchdog service restarted${NC}"
else
    systemctl start "$WATCHDOG_SERVICE"
    echo -e "${GREEN}Watchdog service started${NC}"
fi

# Step 14: Verify service status
echo -e "${YELLOW}Checking service status...${NC}"
if systemctl is-active "$SERVER_SERVICE" >/dev/null; then
    echo -e "${GREEN}$SERVER_SERVICE is running successfully!${NC}"
else
    echo -e "${RED}Error: $SERVER_SERVICE failed to start. Check logs with:${NC}"
    echo "  journalctl -u $SERVER_SERVICE -f"
    exit 1
fi
if systemctl is-active "$WATCHDOG_SERVICE" >/dev/null; then
    echo -e "${GREEN}$WATCHDOG_SERVICE is running successfully!${NC}"
else
    echo -e "${RED}Error: $WATCHDOG_SERVICE failed to start. Check logs with:${NC}"
    echo "  journalctl -u $WATCHDOG_SERVICE -f"
    exit 1
fi

# Step 15: Final user instructions
echo -e "${GREEN}Installation and configuration complete!${NC}"
echo -e "${BLUE}=== Important Usage Instructions ===${NC}"
echo -e "${YELLOW}1. Web App Access:${NC} The web app is running at http://localhost:3000"
echo -e "${YELLOW}2. Audio Output Folder:${NC} Audio files are saved to $WATCHDOG_FOLDER"
echo -e "${YELLOW}3. Web App Configuration:${NC} In the web app, set the audio output folder to $WATCHDOG_FOLDER"
echo -e "${YELLOW}4. Important Note:${NC} Do not move or delete $WATCHDOG_FOLDER, as the watchdog service relies on it to detect new .webm files, and the web app must use this folder for output."
echo -e "${YELLOW}5. Service Management:${NC}"
echo "   - Check status: sudo systemctl status $SERVER_SERVICE"
echo "                   sudo systemctl status $WATCHDOG_SERVICE"
echo "   - View logs:   journalctl -u $SERVER_SERVICE -f"
echo "                  journalctl -u $WATCHDOG_SERVICE -f"
echo "   - Restart:     sudo systemctl restart $SERVER_SERVICE"
echo "                  sudo systemctl restart $WATCHDOG_SERVICE"
echo -e "${YELLOW}6. Watchdog Logs:${NC} Check watchdog activity in $LOG_FILE"
echo -e "${BLUE}==================================${NC}"