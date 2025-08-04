#!/bin/bash

# West Sant Transportation Deployment Script
# Cloud Run deployment only
# Usage: ./deploy.sh [PROJECT_ID] [REGION] [TELEGRAM_BOT_TOKEN] [AVIATION_STACK_API_KEY] [JWT_SECRET]

set -e

PROJECT_ID=${1:-"west-sant-transport"}
REGION=${2:-"us-central1"}
SERVICE_NAME="west-sant-transport"
BACKUP_BUCKET="${PROJECT_ID}-backups"

# Check for required environment variables or command line arguments
TELEGRAM_BOT_TOKEN=${3:-$TELEGRAM_BOT_TOKEN}
AVIATION_STACK_API_KEY=${4:-$AVIATION_STACK_API_KEY}
JWT_SECRET=${5:-$JWT_SECRET}

# Generate JWT secret if not provided
if [ -z "$JWT_SECRET" ]; then
  JWT_SECRET=$(openssl rand -hex 32)
  echo "🔐 Generated new JWT secret: $JWT_SECRET"
  echo "💾 Save this JWT secret for future deployments!"
fi

# Validate required tokens
if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
  echo "❌ TELEGRAM_BOT_TOKEN is required!"
  echo "💡 Get your bot token from @BotFather on Telegram"
  echo "Usage: ./deploy.sh PROJECT_ID REGION TELEGRAM_BOT_TOKEN [AVIATION_STACK_API_KEY] [JWT_SECRET]"
  echo "   or set environment variables: TELEGRAM_BOT_TOKEN, AVIATION_STACK_API_KEY, JWT_SECRET"
  exit 1
fi

if [ -z "$AVIATION_STACK_API_KEY" ]; then
  echo "⚠️  AVIATION_STACK_API_KEY not provided - will use fallback API key with limited functionality"
  echo "💡 Get your API key from https://aviationstack.com/"
  AVIATION_STACK_API_KEY="fallback"
fi

echo "🚀 Deploying West Sant Transportation to Cloud Run"
echo "Project ID: $PROJECT_ID"
echo "Region: $REGION"
echo "Telegram Bot Token: ${TELEGRAM_BOT_TOKEN:0:10}...${TELEGRAM_BOT_TOKEN: -4}"
echo "Aviation Stack API Key: ${AVIATION_STACK_API_KEY:0:8}...${AVIATION_STACK_API_KEY: -4}"
echo "JWT Secret: ${JWT_SECRET:0:8}...${JWT_SECRET: -4}"
echo ""

# Set the project
echo "🔧 Setting up Google Cloud project..."
gcloud config set project $PROJECT_ID

# Setup backup storage bucket
echo "🗄️ Setting up backup storage..."
if ! gsutil ls -b gs://$BACKUP_BUCKET >/dev/null 2>&1; then
    echo "Creating backup bucket: $BACKUP_BUCKET"
    gsutil mb -p $PROJECT_ID -c STANDARD -l $REGION gs://$BACKUP_BUCKET
    
    # Set bucket lifecycle policy to auto-delete old backups after 90 days
    cat > backup-lifecycle.json << EOF
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {"age": 90}
      }
    ]
  }
}
EOF
    gsutil lifecycle set backup-lifecycle.json gs://$BACKUP_BUCKET
    rm backup-lifecycle.json
    echo "✅ Backup bucket created with 90-day retention policy"
else
    echo "✅ Backup bucket already exists: $BACKUP_BUCKET"
fi

echo "☁️ Deploying to Cloud Run..."

# Check if Dockerfile exists
if [ ! -f "Dockerfile" ]; then
    echo "❌ Dockerfile not found! Please ensure you have the Docker configuration file."
    exit 1
fi

IMAGE_NAME="gcr.io/$PROJECT_ID/$SERVICE_NAME"

# Build and push Docker image
echo "📦 Building Docker image..."
docker build --platform linux/amd64 -t $IMAGE_NAME:latest .

echo "📤 Pushing to Google Container Registry..."
docker push $IMAGE_NAME:latest

# Deploy to Cloud Run
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image $IMAGE_NAME:latest \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 1 \
  --max-instances 10 \
  --concurrency 100 \
  --timeout 300 \
  --set-env-vars NODE_ENV=production,BACKUP_BUCKET_NAME=$BACKUP_BUCKET,JWT_SECRET=$JWT_SECRET,TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN,AVIATION_STACK_API_KEY=$AVIATION_STACK_API_KEY \
  --project $PROJECT_ID

# Get service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)' --project $PROJECT_ID)
echo ""
echo "✅ Cloud Run deployment complete!"
echo "🌐 Service URL: $SERVICE_URL"

echo ""
echo "🎉 Deployment successful!"
echo ""
echo "🔐 Environment Variables Set:"
echo "   JWT_SECRET: ${JWT_SECRET:0:8}...${JWT_SECRET: -4}"
echo "   TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN:0:10}...${TELEGRAM_BOT_TOKEN: -4}"
echo "   AVIATION_STACK_API_KEY: ${AVIATION_STACK_API_KEY:0:8}...${AVIATION_STACK_API_KEY: -4}"
echo ""
echo "📋 Next steps:"
echo "1. Access your application at the URL above"
echo "2. Login with: username=superadmin, password=admin123"
echo "3. ⚠️  IMPORTANT: Change the default password immediately!"
echo "4. Test Telegram bot functionality with your bot token"
echo "5. Create additional users and configure permissions"
echo "6. Configure Telegram webhook by accessing: $SERVICE_URL/telegram/setup-webhook"
echo ""
echo "💾 IMPORTANT: Save these tokens for future deployments:"
echo "   JWT_SECRET=$JWT_SECRET"
echo "   TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN"
echo "   AVIATION_STACK_API_KEY=$AVIATION_STACK_API_KEY"
echo ""
echo "📚 For more information, see DEPLOYMENT.md"