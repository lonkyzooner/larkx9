#!/bin/bash
# LARK v1.2 Deployment Script
# Transfers LARK files to the UniHiker and creates a desktop shortcut

# Configuration
UNIHIKER_IP="10.1.2.3"  # Replace with your UniHiker's IP address
UNIHIKER_USER="root"
LARK_DIR="/root/lark"
DESKTOP_DIR="/root/Desktop"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Print banner
echo -e "${GREEN}"
echo "====================================="
echo "  LARK v1.2 Deployment Script"
echo "  Law Enforcement Assistance and Response Kit"
echo "====================================="
echo -e "${NC}"

# Check if UniHiker is reachable
echo -e "${YELLOW}Checking connection to UniHiker...${NC}"
ping -c 1 $UNIHIKER_IP > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Cannot reach UniHiker at $UNIHIKER_IP${NC}"
    echo "Please make sure the UniHiker is powered on and connected to the same network."
    exit 1
fi
echo -e "${GREEN}UniHiker is reachable.${NC}"

# Create LARK directory on UniHiker
echo -e "${YELLOW}Creating LARK directory on UniHiker...${NC}"
ssh $UNIHIKER_USER@$UNIHIKER_IP "mkdir -p $LARK_DIR"
if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Failed to create directory on UniHiker.${NC}"
    exit 1
fi
echo -e "${GREEN}LARK directory created.${NC}"

# Transfer LARK files to UniHiker
echo -e "${YELLOW}Transferring LARK files to UniHiker...${NC}"
scp unihiker/lark_v1.2_integrated.py $UNIHIKER_USER@$UNIHIKER_IP:$LARK_DIR/lark.py
if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Failed to transfer files to UniHiker.${NC}"
    exit 1
fi
echo -e "${GREEN}LARK files transferred successfully.${NC}"

# Make scripts executable
echo -e "${YELLOW}Making scripts executable...${NC}"
ssh $UNIHIKER_USER@$UNIHIKER_IP "chmod +x $LARK_DIR/*.py"
if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Failed to make scripts executable.${NC}"
    exit 1
fi
echo -e "${GREEN}Scripts are now executable.${NC}"

# Install required packages
echo -e "${YELLOW}Installing required packages on UniHiker...${NC}"
ssh $UNIHIKER_USER@$UNIHIKER_IP "apt-get update && apt-get install -y espeak alsa-utils"
if [ $? -ne 0 ]; then
    echo -e "${RED}Warning: Failed to install some packages. LARK may have limited functionality.${NC}"
else
    echo -e "${GREEN}Required packages installed.${NC}"
fi

# Create desktop shortcut
echo -e "${YELLOW}Creating desktop shortcut...${NC}"
ssh $UNIHIKER_USER@$UNIHIKER_IP "mkdir -p $DESKTOP_DIR"
ssh $UNIHIKER_USER@$UNIHIKER_IP "cat > $DESKTOP_DIR/LARK.desktop << EOF
[Desktop Entry]
Type=Application
Name=LARK v1.2
Comment=Law Enforcement Assistance and Response Kit
Exec=python $LARK_DIR/lark.py
Icon=utilities-terminal
Terminal=false
Categories=Utility;
EOF"
if [ $? -ne 0 ]; then
    echo -e "${RED}Warning: Failed to create desktop shortcut.${NC}"
else
    ssh $UNIHIKER_USER@$UNIHIKER_IP "chmod +x $DESKTOP_DIR/LARK.desktop"
    echo -e "${GREEN}Desktop shortcut created.${NC}"
fi

# Create autostart entry
echo -e "${YELLOW}Setting up autostart...${NC}"
ssh $UNIHIKER_USER@$UNIHIKER_IP "mkdir -p /root/.config/autostart"
ssh $UNIHIKER_USER@$UNIHIKER_IP "cp $DESKTOP_DIR/LARK.desktop /root/.config/autostart/"
if [ $? -ne 0 ]; then
    echo -e "${RED}Warning: Failed to set up autostart.${NC}"
else
    echo -e "${GREEN}Autostart configured.${NC}"
fi

# Test LARK installation
echo -e "${YELLOW}Testing LARK installation...${NC}"
ssh $UNIHIKER_USER@$UNIHIKER_IP "cd $LARK_DIR && python -c 'import os; print(\"LARK files exist:\", os.path.exists(\"lark.py\"))'" > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo -e "${RED}Warning: LARK installation test failed. There may be issues with the installation.${NC}"
else
    echo -e "${GREEN}LARK installation test passed.${NC}"
fi

echo -e "${GREEN}"
echo "====================================="
echo "  LARK v1.2 Deployment Complete!"
echo "====================================="
echo -e "${NC}"
echo "To start LARK, either:"
echo "1. Click the LARK desktop shortcut on the UniHiker"
echo "2. SSH into the UniHiker and run: python $LARK_DIR/lark.py"
echo ""
echo "LARK will also start automatically when the UniHiker boots up."
echo ""
echo "Enjoy using LARK v1.2!"
