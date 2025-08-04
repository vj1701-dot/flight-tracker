# Deployment Guide - West Sant Transportation

## Google Cloud Platform (GCP) - Cloud Run Deployment

### Prerequisites

1. **Google Cloud Account**: Create a Google Cloud Platform account at [cloud.google.com](https://cloud.google.com)
2. **gcloud CLI**: Install the Google Cloud CLI from [cloud.google.com/sdk/docs/install](https://cloud.google.com/sdk/docs/install)
3. **Docker**: Install Docker from [docker.com](https://docker.com)
4. **Node.js**: Ensure you have Node.js 18+ installed locally

### Step 1: Setup GCP Project

```bash
# Login to Google Cloud
gcloud auth login

# Create a new project (replace 'west-sant-transport' with your desired project ID)
gcloud projects create west-sant-transport --name="West Sant Transportation"

# Set the project as default
gcloud config set project west-sant-transport

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
```

### Step 2: Configure Environment Variables

1. **JWT Secret**: Generate a secure JWT secret
   ```bash
   # Generate a random 32-character string
   openssl rand -hex 32
   ```

2. **Telegram Bot Token**: 
   - Message @BotFather on Telegram
   - Create a new bot with `/newbot`
   - Copy the token provided

3. **FlightAware API Key**: (Recommended for production)
   - Sign up at https://flightaware.com/commercial/aeroapi/
   - Get your API key for real-time flight data
   - Free tier includes limited requests for testing

4. **Environment Variables**: Set these during deployment or use the deployment script

### Step 3: Deploy the Application

```bash
# Option 1: Use the deployment script (recommended)
# With command line arguments:
./deploy.sh your-project-id us-central1 YOUR_TELEGRAM_BOT_TOKEN YOUR_FLIGHTAWARE_API_KEY YOUR_JWT_SECRET

# Or with environment variables:
export TELEGRAM_BOT_TOKEN="your_telegram_bot_token"
export FLIGHTAWARE_API_KEY="your_flightaware_api_key"
export JWT_SECRET="your_jwt_secret"
./deploy.sh your-project-id us-central1

# Option 2: Manual deployment
# Build Docker image
docker build -t gcr.io/your-project-id/west-sant-transport .

# Push to Container Registry
docker push gcr.io/your-project-id/west-sant-transport

# Deploy to Cloud Run
gcloud run deploy west-sant-transport \
  --image gcr.io/your-project-id/west-sant-transport \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3333 \
  --memory 1Gi \
  --set-env-vars NODE_ENV=production,JWT_SECRET=your-jwt-secret,TELEGRAM_BOT_TOKEN=your-bot-token,FLIGHTAWARE_API_KEY=your-flightaware-api-key
```

### Step 4: Post-Deployment Setup

1. **Access the Application**: 
   - Navigate to your Cloud Run service URL
   - Default login: `username: superadmin`, `password: admin123`
   - **IMPORTANT**: Change the default password immediately!

2. **Create Users**:
   - Go to User Management (superadmin only)
   - Create admin and regular user accounts
   - Set appropriate airport permissions

3. **Configure Telegram Bot**:
   - Users can register with the bot using:
     - `/register_passenger Full Name` (for flight passengers)
     - `/register_volunteer username` (for pickup/dropoff volunteers)
     - `/register_user dashboard_username` (for dashboard users)

4. **Verify Automated Monitoring**:
   - The flight monitoring system starts automatically
   - Check the Flight Monitoring dashboard (admin/superadmin access)
   - System monitors flights 6 hours before departure automatically

### Security Considerations

1. **Change Default Credentials**: Immediately change the default superadmin password
2. **Environment Variables**: Never commit real tokens/secrets to version control
3. **HTTPS**: Cloud Run automatically provides HTTPS
4. **Rate Limiting**: Built-in rate limiting (100 requests per 15 minutes per IP)
5. **JWT Expiration**: Tokens expire after 24 hours

### Monitoring and Logs

```bash
# View application logs
gcloud run logs read west-sant-transport --region us-central1

# View service status
gcloud run services list
```

### Scaling

The application is configured with automatic scaling:
- **Minimum instances**: 1
- **Maximum instances**: 10
- **Memory**: 1Gi
- **CPU**: 1 vCPU

### Data Storage

- **Data Files**: Stored in the application directory
- **Backup**: Data persists between deployments
- **Manual Backup**: Download data files via GCP Console if needed

### Updating the Application

```bash
# Make your changes locally
# Test thoroughly

# Option 1: Use deployment script
./deploy.sh your-project-id us-central1

# Option 2: Manual update
docker build -t gcr.io/your-project-id/west-sant-transport .
docker push gcr.io/your-project-id/west-sant-transport
gcloud run deploy west-sant-transport --image gcr.io/your-project-id/west-sant-transport --region us-central1

# Cloud Run will create a new revision and automatically route traffic
```

### Troubleshooting

1. **Build Errors**: 
   ```bash
   # Check Node.js version
   node --version  # Should be 18+
   
   # Clear caches and reinstall
   rm -rf node_modules client/node_modules server/node_modules
   npm run install:all
   ```

2. **Authentication Issues**:
   - Verify JWT_SECRET is set correctly
   - Check that tokens haven't expired (24-hour limit)

3. **Telegram Bot Issues**:
   - Verify TELEGRAM_BOT_TOKEN is correct
   - Check bot permissions with @BotFather

4. **Permission Errors**:
   - Ensure GCP APIs are enabled (Cloud Run, Cloud Build)
   - Check IAM permissions

### Cost Estimation

- **Free Tier**: GCP provides free Cloud Run quotas (2 million requests per month)
- **Typical Usage**: Should stay within free tier for small-medium organizations
- **Scaling Costs**: Only pay for CPU/memory usage and requests above free tier limits

### Support

For deployment issues:
1. Check GCP Console logs
2. Review application logs with `gcloud run logs read west-sant-transport --region us-central1`
3. Verify all environment variables are set correctly

---

**Ready to deploy!** 🚀

The application includes:
- ✅ User authentication & role-based access
- ✅ Flight management & coordination
- ✅ **NEW**: Fully automated flight monitoring system
- ✅ **Enhanced**: Multi-user Telegram bot integration
- ✅ **NEW**: Real-time flight delay detection and alerts
- ✅ **Enhanced**: Flight-specific audit trail system
- ✅ Responsive design for mobile/desktop
- ✅ FlightAware API integration for live flight data
- ✅ 24/7 automatic monitoring with zero manual intervention