#!/bin/bash

# Scanny Keycloak Theme Installation Script
# This script installs the custom Scanny theme to your Keycloak installation

set -e

echo "🎨 Scanny Keycloak Theme Installer"
echo "=================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Find Keycloak installation
KEYCLOAK_PATHS=(
  "/opt/homebrew/opt/keycloak/libexec"
  "/usr/local/opt/keycloak/libexec"
  "/opt/keycloak"
  "/usr/local/keycloak"
  "$HOME/keycloak"
)

KEYCLOAK_HOME=""
for path in "${KEYCLOAK_PATHS[@]}"; do
  if [ -d "$path/themes" ]; then
    KEYCLOAK_HOME="$path"
    break
  fi
done

if [ -z "$KEYCLOAK_HOME" ]; then
  echo -e "${RED}❌ Could not find Keycloak installation${NC}"
  echo ""
  echo "Please enter your Keycloak installation path:"
  read -p "Keycloak path: " KEYCLOAK_HOME
  
  if [ ! -d "$KEYCLOAK_HOME/themes" ]; then
    echo -e "${RED}❌ Invalid path: $KEYCLOAK_HOME/themes not found${NC}"
    exit 1
  fi
fi

echo -e "${GREEN}✓ Found Keycloak at: $KEYCLOAK_HOME${NC}"
echo ""

# Check if theme directory exists
if [ ! -d "keycloak-theme/scanny" ]; then
  echo -e "${RED}❌ Theme directory not found: keycloak-theme/scanny${NC}"
  echo "Please run this script from the project root directory"
  exit 1
fi

echo -e "${YELLOW}📦 Installing Scanny theme...${NC}"

# Copy theme to Keycloak
THEME_DEST="$KEYCLOAK_HOME/themes/scanny"

if [ -d "$THEME_DEST" ]; then
  echo -e "${YELLOW}⚠️  Theme already exists. Overwriting...${NC}"
  rm -rf "$THEME_DEST"
fi

cp -r keycloak-theme/scanny "$THEME_DEST"

if [ -d "$THEME_DEST" ]; then
  echo -e "${GREEN}✓ Theme installed successfully!${NC}"
else
  echo -e "${RED}❌ Failed to install theme${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}✨ Installation Complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Restart Keycloak:"
echo -e "   ${YELLOW}brew services restart keycloak${NC}"
echo ""
echo "2. Open Keycloak Admin Console:"
echo -e "   ${YELLOW}http://localhost:8080${NC}"
echo ""
echo "3. Activate the theme:"
echo "   - Login as admin"
echo "   - Select realm: scanny"
echo "   - Go to: Realm Settings → Themes"
echo "   - Set Login Theme: scanny"
echo "   - Click Save"
echo ""
echo -e "${GREEN}🎉 Done! Your login pages will now use the Scanny theme.${NC}"
