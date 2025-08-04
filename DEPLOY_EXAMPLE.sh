#!/bin/bash

# Example deployment script with placeholder tokens
# REPLACE THE TOKENS BELOW WITH YOUR ACTUAL VALUES

# Your GCP Project ID
PROJECT_ID="west-sant-transport"

# Deployment region (us-central1 is recommended)
REGION="us-central1"

# Your Telegram Bot Token (get from @BotFather on Telegram)
# Example: 123456789:ABCdefGHIjklMNOpqrSTUvwxYZ
TELEGRAM_BOT_TOKEN="YOUR_TELEGRAM_BOT_TOKEN_HERE"

# Your AviationStack API Key (get from https://aviationstack.com/)
# Example: abc123def456ghi789
AVIATION_STACK_API_KEY="YOUR_AVIATION_STACK_API_KEY_HERE"

# JWT Secret (generate with: openssl rand -hex 32)
# Example: 6bd97da76755724e20dc5a5b2a16214d2e14ebc69d2f4e7e1b42156738154318
JWT_SECRET="YOUR_JWT_SECRET_HERE"

echo "🚀 Deploying West Sant Transportation with the following configuration:"
echo "   Project ID: $PROJECT_ID"
echo "   Region: $REGION"
echo "   Telegram Bot Token: ${TELEGRAM_BOT_TOKEN:0:10}...${TELEGRAM_BOT_TOKEN: -4}"
echo "   Aviation Stack API Key: ${AVIATION_STACK_API_KEY:0:8}...${AVIATION_STACK_API_KEY: -4}"
echo "   JWT Secret: ${JWT_SECRET:0:8}...${JWT_SECRET: -4}"
echo ""

# Validate that tokens have been replaced
if [[ "$TELEGRAM_BOT_TOKEN" == "YOUR_TELEGRAM_BOT_TOKEN_HERE" ]]; then
    echo "❌ Please replace YOUR_TELEGRAM_BOT_TOKEN_HERE with your actual Telegram bot token"
    echo "💡 Get your bot token from @BotFather on Telegram"
    exit 1
fi

if [[ "$AVIATION_STACK_API_KEY" == "YOUR_AVIATION_STACK_API_KEY_HERE" ]]; then
    echo "⚠️  Please replace YOUR_AVIATION_STACK_API_KEY_HERE with your actual AviationStack API key"
    echo "💡 Get your API key from https://aviationstack.com/ (optional but recommended)"
    echo "🔄 Continuing with fallback API key..."
    AVIATION_STACK_API_KEY="fallback"
fi

if [[ "$JWT_SECRET" == "YOUR_JWT_SECRET_HERE" ]]; then
    echo "🔐 Generating new JWT secret..."
    JWT_SECRET=$(openssl rand -hex 32)
    echo "   Generated JWT Secret: $JWT_SECRET"
    echo "💾 Save this JWT secret for future deployments!"
fi

# Run the deployment
./deploy.sh "$PROJECT_ID" "$REGION" "$TELEGRAM_BOT_TOKEN" "$AVIATION_STACK_API_KEY" "$JWT_SECRET"