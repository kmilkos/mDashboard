#!/usr/bin/env bash

# mDash - Debian Host Automated Installation Script
# This script installs Node.js, configures dependencies, builds the frontend, and registers mDash as a systemd service.

set -euo pipefail

# Text colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0;0m' # No Color

echo -e "${BLUE}=========================================================================${NC}"
echo -e "${BLUE}               mDash Automated Debian Installer                         ${NC}"
echo -e "${BLUE}=========================================================================${NC}"

# 1. Ensure running as root/sudo
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Error: This script must be run as root or with sudo.${NC}"
  echo "Please run: sudo ./install.sh"
  exit 1
fi

# Determine the non-root user who invoked sudo (to run systemd service securely)
TARGET_USER="${SUDO_USER:-}"
if [ -z "$TARGET_USER" ] || [ "$TARGET_USER" = "root" ]; then
  # Fallback to normal user detection if SUDO_USER is empty
  TARGET_USER=$(logname 2>/dev/null || echo "")
  if [ -z "$TARGET_USER" ]; then
    TARGET_USER="nobody"
  fi
fi

TARGET_DIR="$(pwd)"
echo -e "Detecting target directory: ${GREEN}${TARGET_DIR}${NC}"
echo -e "Systemd service will run under user: ${GREEN}${TARGET_USER}${NC}"

# Verify we have package.json in the folder
if [ ! -f "${TARGET_DIR}/package.json" ]; then
  echo -e "${RED}Error: package.json not found in the current directory.${NC}"
  echo "Please run this installer from inside the mDash repository directory."
  exit 1
fi

# 2. Check Debian host compatibility
if [ ! -f /etc/debian_version ]; then
  echo -e "${YELLOW}Warning: This script is designed for Debian-based systems (Debian, Ubuntu, Linux Mint).${NC}"
  read -p "Do you want to proceed anyway? (y/N): " proceed
  if [[ ! "$proceed" =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# 3. Install Debian dependencies
echo -e "\n${BLUE}[1/5] Updating packages and installing dependencies...${NC}"
apt-get update -y
apt-get install -y curl git build-essential

# 4. Install Node.js v22 (LTS)
if ! command -v node &> /dev/null || [ "$(node -v | cut -d'.' -f1 | tr -d 'v')" -lt 18 ]; then
  echo -e "\n${BLUE}[2/5] Node.js is missing or outdated. Installing Node.js 22.x LTS...${NC}"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
else
  echo -e "\n${GREEN}✓ Node.js is already installed ($(node -v)). Skipping installation.${NC}"
fi

# 5. Configure environment variables
echo -e "\n${BLUE}[3/5] Setting up environment configuration...${NC}"
ENV_FILE="${TARGET_DIR}/.env"

if [ -f "$ENV_FILE" ]; then
  echo -e "${YELLOW}Existing .env file detected. Keeping previous configurations.${NC}"
else
  # Prompt for admin password
  read -sp "Enter the desired mDash admin password (MDASH_PASSWORD): " mdash_pw
  echo ""
  # Prompt for port
  read -p "Enter port for mDash server [default: 3080]: " mdash_port
  mdash_port="${mdash_port:-3080}"

  cat <<EOF > "$ENV_FILE"
# mDash Configuration Environment Variables
MDASH_PASSWORD=${mdash_pw}
PORT=${mdash_port}
NODE_ENV=production
EOF
  # Secure the .env file so only the owner can read it
  chown "${TARGET_USER}:${TARGET_USER}" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  echo -e "${GREEN}✓ Created configuration file: ${ENV_FILE}${NC}"
fi

# Ensure port is read for systemd messaging
PORT_VAL=$(grep -oP '^PORT=\K\d+' "$ENV_FILE" || echo "3080")

# 6. Install dependencies and compile production assets
echo -e "\n${BLUE}[4/5] Installing npm dependencies and building frontend...${NC}"
# Adjust folder permissions to ensure the target user owns it
chown -R "${TARGET_USER}:${TARGET_USER}" "${TARGET_DIR}"

# Run npm install and build as the target non-root user
sudo -u "$TARGET_USER" npm install
sudo -u "$TARGET_USER" npm run build

# 7. Set up Systemd daemon service
echo -e "\n${BLUE}[5/5] Registering mDash as a systemd service...${NC}"

SERVICE_FILE="/etc/systemd/system/mdash.service"

cat <<EOF > "$SERVICE_FILE"
[Unit]
Description=mDash Personal Dashboard
After=network.target

[Service]
Type=simple
User=${TARGET_USER}
WorkingDirectory=${TARGET_DIR}
EnvironmentFile=${ENV_FILE}
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Reload and start service
systemctl daemon-reload
systemctl enable mdash.service
systemctl restart mdash.service

# Check service status
if systemctl is-active --quiet mdash.service; then
  # Detect host local IP address
  PRIMARY_IP=$(hostname -I | awk '{print $1}' || echo "localhost")
  echo -e "\n${GREEN}=========================================================================${NC}"
  echo -e "${GREEN}               mDash Installation Completed Successfully!               ${NC}"
  echo -e "${GREEN}=========================================================================${NC}"
  echo -e "You can now access your dashboard at: ${BLUE}http://${PRIMARY_IP}:${PORT_VAL}${NC}"
  echo -e "Systemd Service status: ${GREEN}Active & Running${NC}"
  echo ""
  echo "Manage the service using the following commands:"
  echo -e "  - View service logs:  ${YELLOW}sudo journalctl -u mdash -f${NC}"
  echo -e "  - Restart dashboard:  ${YELLOW}sudo systemctl restart mdash${NC}"
  echo -e "  - Stop dashboard:     ${YELLOW}sudo systemctl stop mdash${NC}"
  echo -e "${GREEN}=========================================================================${NC}"
else
  echo -e "\n${RED}Warning: mDash service registered but failed to start successfully.${NC}"
  echo "Please check service logs by running: sudo journalctl -u mdash -n 50"
fi
