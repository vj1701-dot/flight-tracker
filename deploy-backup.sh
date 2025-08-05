#!/bin/bash

# Deployment Backup & Restore Script for Flight Tracker
# This script creates backups before deployment and restores data after deployment

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKUP_BUCKET_NAME="${BACKUP_BUCKET_NAME:-flight-tracker-backups}"
PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-flight-tracker}"
SERVICE_NAME="${SERVICE_NAME:-flight-tracker}"
REGION="${REGION:-us-central1}"

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_requirements() {
    log_info "Checking requirements..."
    
    if ! command -v gcloud &> /dev/null; then
        log_error "gcloud CLI is not installed. Please install it first."
        exit 1
    fi
    
    if ! command -v curl &> /dev/null; then
        log_error "curl is not installed. Please install it first."
        exit 1
    fi
    
    # Check if authenticated with gcloud
    if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -n1 > /dev/null 2>&1; then
        log_error "Please authenticate with Google Cloud: gcloud auth login"
        exit 1
    fi
    
    log_success "All requirements satisfied"
}

# Setup GCS bucket and permissions
setup_bucket_permissions() {
    log_info "Setting up GCS bucket and permissions..."
    
    # Get project number
    local project_number
    project_number=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)" 2>/dev/null)
    
    if [ -z "$project_number" ]; then
        log_error "Could not get project number for $PROJECT_ID"
        return 1
    fi
    
    # Cloud Run default service account
    local service_account="${project_number}-compute@developer.gserviceaccount.com"
    
    # Create bucket if it doesn't exist
    if ! gsutil ls -b "gs://$BACKUP_BUCKET_NAME" > /dev/null 2>&1; then
        log_info "Creating backup bucket: $BACKUP_BUCKET_NAME"
        gsutil mb -p "$PROJECT_ID" "gs://$BACKUP_BUCKET_NAME"
    fi
    
    # Grant storage admin permissions to Cloud Run service account
    log_info "Granting storage permissions to Cloud Run service account..."
    gcloud projects add-iam-policy-binding "$PROJECT_ID" \
        --member="serviceAccount:$service_account" \
        --role="roles/storage.admin" \
        --quiet > /dev/null 2>&1 || true
    
    log_success "Bucket and permissions configured"
}

# Get the URL of the currently deployed service
get_service_url() {
    local url
    url=$(gcloud run services describe "$SERVICE_NAME" --region="$REGION" --format="value(status.url)" 2>/dev/null || echo "")
    
    if [ -z "$url" ]; then
        log_warning "Service $SERVICE_NAME not found in region $REGION"
        return 1
    fi
    
    echo "$url"
}

# Create a pre-deployment backup
create_backup() {
    log_info "Creating pre-deployment backup..."
    
    local service_url
    service_url=$(get_service_url)
    
    if [ -z "$service_url" ]; then
        log_warning "Cannot create backup - service not deployed yet"
        return 0
    fi
    
    # Check if service is healthy
    if ! curl -sf "$service_url/health" > /dev/null 2>&1; then
        log_warning "Service appears to be unhealthy, backup may not be complete"
    fi
    
    # Create backup via API endpoint
    local backup_response
    backup_response=$(curl -sf -X POST "$service_url/api/backup/create" \
        -H "Content-Type: application/json" \
        -d '{"manual": true, "reason": "pre-deployment"}' 2>/dev/null || echo "")
    
    if [ -n "$backup_response" ]; then
        local backup_id
        backup_id=$(echo "$backup_response" | grep -o '"backupFolder":"[^"]*"' | cut -d'"' -f4 2>/dev/null || echo "")
        
        if [ -n "$backup_id" ]; then
            log_success "Pre-deployment backup created: $backup_id"
            echo "$backup_id" > .last-backup-id
            return 0
        fi
    fi
    
    log_warning "Could not create backup via API, service may not be responding"
    return 1
}

# Restore data after deployment
restore_data() {
    local backup_id="$1"
    
    if [ -z "$backup_id" ]; then
        if [ -f ".last-backup-id" ]; then
            backup_id=$(cat .last-backup-id)
            log_info "Using backup ID from .last-backup-id: $backup_id"
        else
            log_warning "No backup ID provided and no .last-backup-id file found"
            return 1
        fi
    fi
    
    log_info "Waiting for service to be ready after deployment..."
    
    local service_url
    service_url=$(get_service_url)
    
    if [ -z "$service_url" ]; then
        log_error "Cannot get service URL after deployment"
        return 1
    fi
    
    # Wait for service to be healthy (up to 5 minutes)
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        log_info "Checking service health (attempt $attempt/$max_attempts)..."
        
        if curl -sf "$service_url/health" > /dev/null 2>&1; then
            log_success "Service is healthy"
            break
        fi
        
        if [ $attempt -eq $max_attempts ]; then
            log_error "Service did not become healthy within 5 minutes"
            return 1
        fi
        
        sleep 10
        ((attempt++))
    done
    
    # Restore data
    log_info "Restoring data from backup: $backup_id"
    
    local restore_response
    restore_response=$(curl -sf -X POST "$service_url/api/backup/restore" \
        -H "Content-Type: application/json" \
        -d "{\"backupFolder\": \"$backup_id\"}" 2>/dev/null || echo "")
    
    if echo "$restore_response" | grep -q '"success":true'; then
        log_success "Data restored successfully from backup: $backup_id"
        rm -f .last-backup-id
        return 0
    else
        log_error "Failed to restore data from backup: $backup_id"
        log_error "Response: $restore_response"
        return 1
    fi
}

# List available backups
list_backups() {
    log_info "Listing available backups..."
    
    local service_url
    service_url=$(get_service_url)
    
    if [ -z "$service_url" ]; then
        log_error "Cannot get service URL"
        return 1
    fi
    
    local backups_response
    backups_response=$(curl -sf "$service_url/api/backup/list" 2>/dev/null || echo "")
    
    if [ -n "$backups_response" ]; then
        echo "$backups_response" | jq -r '.backups[]' 2>/dev/null || echo "$backups_response"
    else
        log_error "Could not retrieve backup list"
        return 1
    fi
}

# Deploy with backup and restore
deploy_with_backup() {
    log_info "Starting deployment with backup and restore..."
    
    # Step 1: Setup bucket and permissions
    setup_bucket_permissions
    
    # Step 2: Create backup
    create_backup
    
    # Step 3: Deploy the service
    log_info "Deploying service..."
    
    log_info "Checking for required deployment secrets..."
    if [[ -z "$JWT_SECRET" || -z "$TELEGRAM_BOT_TOKEN" ]]; then
        log_error "Required environment variables JWT_SECRET and TELEGRAM_BOT_TOKEN are not set."
        log_error "You can generate a JWT_SECRET by running: ./generate-env.sh"
        log_error "Then export the variables before deploying:"
        log_error "  export JWT_SECRET=..."
        log_error "  export TELEGRAM_BOT_TOKEN=..."
        log_error "  export FLIGHTAWARE_API_KEY=... (optional)"
        return 1
    fi
    log_success "Required secrets found in environment."

    # Build environment variables string
    local ENV_VARS="NODE_ENV=production,BACKUP_BUCKET_NAME=$BACKUP_BUCKET_NAME,JWT_SECRET=$JWT_SECRET,TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN"
    if [[ -n "$FLIGHTAWARE_API_KEY" ]]; then
        ENV_VARS="$ENV_VARS,FLIGHTAWARE_API_KEY=$FLIGHTAWARE_API_KEY"
    fi

    if ! gcloud run deploy "$SERVICE_NAME" \
        --source . \
        --region="$REGION" \
        --platform managed \
        --allow-unauthenticated \
        --set-env-vars="$ENV_VARS" \
        --memory=1Gi \
        --cpu=1000m \
        --timeout=300 \
        --concurrency=100 \
        --max-instances=10; then
        log_error "Deployment failed"
        return 1
    fi
    
    log_success "Service deployed successfully"
    
    # Step 4: Restore data if backup was created
    if [ -f ".last-backup-id" ]; then
        log_info "Restoring data from pre-deployment backup..."
        restore_data
    else
        log_info "No pre-deployment backup found, skipping restore"
    fi
    
    log_success "Deployment with backup and restore completed successfully!"
}

# Show usage
usage() {
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  backup              Create a backup of current data"
    echo "  restore BACKUP_ID   Restore data from specified backup"
    echo "  list                List available backups"
    echo "  deploy              Deploy with automatic backup and restore"
    echo "  help                Show this usage information"
    echo ""
    echo "Environment Variables:"
    echo "  BACKUP_BUCKET_NAME  GCS bucket name for backups (default: flight-tracker-backups)"
    echo "  GOOGLE_CLOUD_PROJECT Project ID (default: flight-tracker)"
    echo "  SERVICE_NAME        Cloud Run service name (default: flight-tracker)"
    echo "  REGION              Cloud Run region (default: us-central1)"
    echo ""
    echo "Examples:"
    echo "  $0 deploy                    # Deploy with backup and restore"
    echo "  $0 backup                    # Create manual backup"
    echo "  $0 restore manual-2024-...   # Restore from specific backup"
    echo "  $0 list                      # List all available backups"
}

# Main script logic
main() {
    check_requirements
    
    case "${1:-help}" in
        "backup")
            create_backup
            ;;
        "restore")
            if [ -z "$2" ]; then
                log_error "Backup ID is required for restore command"
                usage
                exit 1
            fi
            restore_data "$2"
            ;;
        "list")
            list_backups
            ;;
        "deploy")
            deploy_with_backup
            ;;
        "help"|"--help"|"-h")
            usage
            ;;
        *)
            log_error "Unknown command: $1"
            usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"