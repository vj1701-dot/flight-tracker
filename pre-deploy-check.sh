#!/bin/bash

# Pre-deployment check script for West Sant Transportation
# Verifies all requirements are met before deployment

echo "🔍 Pre-deployment verification for West Sant Transportation"
echo "============================================================"

# Check if required tools are installed
echo "📋 Checking required tools..."

if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI not found. Please install: https://cloud.google.com/sdk/docs/install"
    exit 1
fi
echo "✅ gcloud CLI found"

if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install: https://docker.com"
    exit 1
fi
echo "✅ Docker found"

if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+"
    exit 1
fi
echo "✅ Node.js found ($(node --version))"

# Check Node.js version
NODE_VERSION=$(node --version | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version must be 18 or higher. Current: $(node --version)"
    exit 1
fi
echo "✅ Node.js version is compatible"

# Check if Dockerfile exists
if [ ! -f "Dockerfile" ]; then
    echo "❌ Dockerfile not found in current directory"
    exit 1
fi
echo "✅ Dockerfile found"

# Check if package.json files exist
if [ ! -f "server/package.json" ]; then
    echo "❌ server/package.json not found"
    exit 1
fi
echo "✅ Server package.json found"

if [ ! -f "client/package.json" ]; then
    echo "❌ client/package.json not found"
    exit 1
fi
echo "✅ Client package.json found"

# Check if required source files exist
if [ ! -f "server/index.js" ]; then
    echo "❌ server/index.js not found"
    exit 1
fi
echo "✅ Server entry point found"

if [ ! -f "server/telegram-bot.js" ]; then
    echo "❌ server/telegram-bot.js not found"
    exit 1
fi
echo "✅ Telegram bot service found"

if [ ! -f "server/flight-info-service.js" ]; then
    echo "❌ server/flight-info-service.js not found"
    exit 1
fi
echo "✅ Flight info service found"

if [ ! -f "server/data/airports.json" ]; then
    echo "❌ server/data/airports.json not found"
    exit 1
fi
echo "✅ Airports database found"

# Check if gcloud is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "❌ Not authenticated with gcloud. Run: gcloud auth login"
    exit 1
fi
echo "✅ gcloud authenticated"

# Check Docker daemon
if ! docker info &> /dev/null; then
    echo "❌ Docker daemon not running. Please start Docker"
    exit 1
fi
echo "✅ Docker daemon running"

echo ""
echo "🎯 Environment Variables Check:"
echo "==============================================="

# Check environment variables
if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
    echo "⚠️  TELEGRAM_BOT_TOKEN not set (can be provided as deployment argument)"
else
    echo "✅ TELEGRAM_BOT_TOKEN set: ${TELEGRAM_BOT_TOKEN:0:10}...${TELEGRAM_BOT_TOKEN: -4}"
fi

if [ -z "$AVIATION_STACK_API_KEY" ]; then
    echo "⚠️  AVIATION_STACK_API_KEY not set (will use fallback - limited functionality)"
else
    echo "✅ AVIATION_STACK_API_KEY set: ${AVIATION_STACK_API_KEY:0:8}...${AVIATION_STACK_API_KEY: -4}"
fi

if [ -z "$JWT_SECRET" ]; then
    echo "⚠️  JWT_SECRET not set (will be auto-generated during deployment)"
else
    echo "✅ JWT_SECRET set: ${JWT_SECRET:0:8}...${JWT_SECRET: -4}"
fi

echo ""
echo "📊 Project Structure Verification:"
echo "=================================="

# Count important files
AIRPORTS_COUNT=$(jq length server/data/airports.json 2>/dev/null || echo "0")
echo "✅ Airports in database: $AIRPORTS_COUNT"

if [ -f "server/flights.json" ]; then
    FLIGHTS_COUNT=$(jq length server/flights.json 2>/dev/null || echo "0")
    echo "✅ Existing flights: $FLIGHTS_COUNT"
fi

if [ -f "server/users.json" ]; then
    USERS_COUNT=$(jq length server/users.json 2>/dev/null || echo "0")
    echo "✅ Existing users: $USERS_COUNT"
fi

echo ""
echo "🚀 Ready for Deployment!"
echo "======================="
echo ""
echo "To deploy, run:"
echo "./deploy.sh [PROJECT_ID] [REGION] [TELEGRAM_BOT_TOKEN] [AVIATION_STACK_API_KEY] [JWT_SECRET]"
echo ""
echo "Example:"
echo "./deploy.sh west-sant-transport us-central1 123456789:ABCdef... abc123def456... $(openssl rand -hex 32)"
echo ""
echo "Or set environment variables and run:"
echo "export TELEGRAM_BOT_TOKEN='your_bot_token'"
echo "export AVIATION_STACK_API_KEY='your_api_key'"
echo "export JWT_SECRET='your_jwt_secret'"
echo "./deploy.sh west-sant-transport us-central1"