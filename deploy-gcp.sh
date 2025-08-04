#!/bin/bash

# GCP Deployment Script for Flight Tracker
# This script automates the deployment process including JWT secret generation

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
DEFAULT_REGION="us-central1"
DEFAULT_SERVICE_NAME="flight-tracker"

echo -e "${BLUE}🚀 Flight Tracker GCP Deployment Script${NC}"
echo -e "${BLUE}======================================${NC}\n"

# Function to generate JWT secret
generate_jwt_secret() {
    if command -v openssl &> /dev/null; then
        openssl rand -hex 32
    elif command -v node &> /dev/null; then
        node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
    elif command -v python3 &> /dev/null; then
        python3 -c "import secrets; print(secrets.token_hex(32))"
    else
        echo -e "${RED}❌ Error: No method available to generate JWT secret${NC}"
        echo -e "${YELLOW}Please install openssl, node, or python3${NC}"
        exit 1
    fi
}

# Function to validate required tools
check_prerequisites() {
    echo -e "${BLUE}📋 Checking prerequisites...${NC}"
    
    if ! command -v gcloud &> /dev/null; then
        echo -e "${RED}❌ Google Cloud CLI not found${NC}"
        echo -e "${YELLOW}Please install gcloud: https://cloud.google.com/sdk/docs/install${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Google Cloud CLI found${NC}"
}

# Function to get user inputs
get_deployment_config() {
    echo -e "\n${BLUE}📝 Deployment Configuration${NC}"
    echo -e "${BLUE}===========================${NC}\n"
    
    # Project ID
    read -p "🏷️  Enter GCP Project ID: " PROJECT_ID
    if [[ -z "$PROJECT_ID" ]]; then
        echo -e "${RED}❌ Project ID is required${NC}"
        exit 1
    fi
    
    # Region
    read -p "🌍 Enter region [$DEFAULT_REGION]: " REGION
    REGION=${REGION:-$DEFAULT_REGION}
    
    # Service name
    read -p "🏷️  Enter service name [$DEFAULT_SERVICE_NAME]: " SERVICE_NAME
    SERVICE_NAME=${SERVICE_NAME:-$DEFAULT_SERVICE_NAME}
    
    # Telegram Bot Token
    echo -e "\n${YELLOW}🤖 Get your Telegram bot token from @BotFather${NC}"
    read -p "🔑 Enter Telegram Bot Token: " TELEGRAM_BOT_TOKEN
    if [[ -z "$TELEGRAM_BOT_TOKEN" ]]; then
        echo -e "${RED}❌ Telegram Bot Token is required${NC}"
        exit 1
    fi
    
    # FlightAware API Key
    echo -e "\n${YELLOW}✈️  Get your FlightAware API key from: https://flightaware.com/commercial/aeroapi/${NC}"
    read -p "🔑 Enter FlightAware API Key (optional): " FLIGHTAWARE_API_KEY
    
    # Auto-generate JWT secret
    echo -e "\n${BLUE}🔐 Generating JWT secret...${NC}"
    JWT_SECRET=$(generate_jwt_secret)
    echo -e "${GREEN}✅ JWT secret generated: ${JWT_SECRET:0:16}...${NC}"
}

# Function to set up GCP project
setup_gcp_project() {
    echo -e "\n${BLUE}🔧 Setting up GCP project...${NC}"
    
    # Set project
    gcloud config set project $PROJECT_ID
    
    # Enable required APIs
    echo -e "${BLUE}📡 Enabling required APIs...${NC}"
    gcloud services enable cloudbuild.googleapis.com
    gcloud services enable run.googleapis.com
    gcloud services enable artifactregistry.googleapis.com
    
    echo -e "${GREEN}✅ GCP project setup complete${NC}"
}

# Function to deploy to Cloud Run
deploy_to_cloud_run() {
    echo -e "\n${BLUE}🚀 Deploying to Cloud Run...${NC}"
    
    # Build environment variables
    ENV_VARS="NODE_ENV=production,JWT_SECRET=$JWT_SECRET,TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN"
    
    if [[ -n "$FLIGHTAWARE_API_KEY" ]]; then
        ENV_VARS="$ENV_VARS,FLIGHTAWARE_API_KEY=$FLIGHTAWARE_API_KEY"
    fi
    
    # Deploy using Cloud Build
    gcloud run deploy $SERVICE_NAME \
        --source . \
        --platform managed \
        --region $REGION \
        --allow-unauthenticated \
        --port 8080 \
        --memory 1Gi \
        --cpu 1 \
        --max-instances 10 \
        --set-env-vars "$ENV_VARS" \
        --quiet
}

# Function to display deployment info
show_deployment_info() {
    echo -e "\n${GREEN}🎉 Deployment Complete!${NC}"
    echo -e "${GREEN}=====================${NC}\n"
    
    # Get service URL
    SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.url)")
    
    echo -e "${BLUE}📊 Deployment Details:${NC}"
    echo -e "🌐 Service URL: ${GREEN}$SERVICE_URL${NC}"
    echo -e "🏷️  Service Name: ${GREEN}$SERVICE_NAME${NC}"
    echo -e "🌍 Region: ${GREEN}$REGION${NC}"
    echo -e "🏷️  Project: ${GREEN}$PROJECT_ID${NC}"
    
    echo -e "\n${BLUE}🔐 Environment Variables Set:${NC}"
    echo -e "✅ NODE_ENV=production"
    echo -e "✅ JWT_SECRET=${JWT_SECRET:0:16}..."
    echo -e "✅ TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN:0:16}..."
    if [[ -n "$FLIGHTAWARE_API_KEY" ]]; then
        echo -e "✅ FLIGHTAWARE_API_KEY=${FLIGHTAWARE_API_KEY:0:16}..."
    else
        echo -e "⚠️  FLIGHTAWARE_API_KEY not set (flight tracking disabled)"
    fi
    
    echo -e "\n${BLUE}🚀 Next Steps:${NC}"
    echo -e "1. Visit your application: ${GREEN}$SERVICE_URL${NC}"
    echo -e "2. Login with: ${GREEN}superadmin / admin123${NC}"
    echo -e "3. Change the default password immediately!"
    echo -e "4. Test the Telegram bot functionality"
    
    echo -e "\n${YELLOW}💡 Pro tip: Bookmark your service URL for easy access!${NC}"
}

# Function to save deployment info
save_deployment_info() {
    cat > deployment-info.txt << EOF
Flight Tracker Deployment Information
====================================

Deployment Date: $(date)
Service URL: $SERVICE_URL
Service Name: $SERVICE_NAME
Region: $REGION
Project ID: $PROJECT_ID

Environment Variables:
- NODE_ENV=production
- JWT_SECRET=$JWT_SECRET
- TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN
$(if [[ -n "$FLIGHTAWARE_API_KEY" ]]; then echo "- FLIGHTAWARE_API_KEY=$FLIGHTAWARE_API_KEY"; fi)

Default Login:
- Username: superadmin
- Password: admin123 (CHANGE IMMEDIATELY!)

Important URLs:
- Application: $SERVICE_URL
- GCP Console: https://console.cloud.google.com/run/detail/$REGION/$SERVICE_NAME?project=$PROJECT_ID
EOF
    
    echo -e "\n${GREEN}📄 Deployment info saved to: deployment-info.txt${NC}"
}

# Main execution flow
main() {
    check_prerequisites
    get_deployment_config
    setup_gcp_project
    deploy_to_cloud_run
    show_deployment_info
    save_deployment_info
    
    echo -e "\n${GREEN}🎉 Flight Tracker successfully deployed to GCP!${NC}"
}

# Run main function
main "$@"