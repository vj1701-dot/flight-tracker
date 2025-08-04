#!/bin/bash

# Simple Environment Variable Generator for Flight Tracker
# Generates secure JWT secret and provides environment variable template

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🔐 Flight Tracker Environment Variable Generator${NC}"
echo -e "${BLUE}===============================================${NC}\n"

# Generate JWT secret
echo -e "${BLUE}Generating secure JWT secret...${NC}"
if command -v openssl &> /dev/null; then
    JWT_SECRET=$(openssl rand -hex 32)
elif command -v node &> /dev/null; then
    JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
elif command -v python3 &> /dev/null; then
    JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")
else
    echo -e "${YELLOW}⚠️  Could not generate JWT secret automatically${NC}"
    echo -e "${YELLOW}Please generate manually with: openssl rand -hex 32${NC}"
    JWT_SECRET="GENERATE_WITH_OPENSSL_RAND_HEX_32"
fi

echo -e "${GREEN}✅ JWT secret generated!${NC}\n"

# Create environment variables template
cat > .env.generated << EOF
# Generated Environment Variables for Flight Tracker
# Copy these to your GCP Cloud Run environment variables

NODE_ENV=production
JWT_SECRET=$JWT_SECRET
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
FLIGHTAWARE_API_KEY=your_flightaware_api_key_here
EOF

# Display instructions
echo -e "${BLUE}📋 Environment Variables Generated:${NC}"
echo -e "${BLUE}====================================${NC}\n"

echo -e "${GREEN}JWT_SECRET:${NC} $JWT_SECRET"
echo -e "\n${YELLOW}📄 Complete environment variables saved to: .env.generated${NC}"

echo -e "\n${BLUE}🚀 For GCP Cloud Build/Cloud Run:${NC}"
echo -e "1. Copy the JWT_SECRET above"
echo -e "2. Get your Telegram Bot Token from @BotFather"
echo -e "3. Get your FlightAware API Key from https://flightaware.com/commercial/aeroapi/"
echo -e "4. Set these in Cloud Run environment variables"

echo -e "\n${BLUE}📋 Environment Variables to Set in GCP:${NC}"
echo -e "${GREEN}NODE_ENV${NC}=production"
echo -e "${GREEN}JWT_SECRET${NC}=$JWT_SECRET"
echo -e "${GREEN}TELEGRAM_BOT_TOKEN${NC}=your_actual_bot_token"
echo -e "${GREEN}FLIGHTAWARE_API_KEY${NC}=your_actual_api_key"

echo -e "\n${YELLOW}💡 Pro tip: Keep the JWT_SECRET secure and never commit it to git!${NC}"