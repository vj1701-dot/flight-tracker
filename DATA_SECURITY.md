# Data Security & Backup Guide
## West Sant Transportation System

### 🔒 Data Security Overview

Your West Sant Transportation system implements multiple layers of security to protect sensitive flight and passenger data:

#### **Authentication & Access Control**
- **JWT Token Security**: 24-hour token expiration with secure signing
- **Password Encryption**: bcrypt hashing with salt (10 rounds)
- **Role-Based Access**: Superadmin, Admin, and User roles with specific permissions
- **Airport Restrictions**: Users can only access flights for their assigned airports
- **Rate Limiting**: 100 requests per 15 minutes per IP address

#### **Data Protection**
- **HTTPS Encryption**: All data transmitted over secure connections (in production)
- **Security Headers**: XSS protection, content type sniffing prevention, frame options
- **Input Validation**: Server-side validation for all user inputs
- **SQL Injection Prevention**: No SQL database; using JSON with proper parsing
- **Cross-Site Scripting (XSS) Protection**: Content sanitization and security headers

#### **Enhanced Audit Trail System**
- **Flight-specific Audit Trail**: Superadmin can view complete change history for any flight
- **Complete Activity Logging**: All user actions logged with timestamps
- **User Attribution**: Every change tracked with exact user details
- **Field-level Tracking**: Before/after values for all modifications
- **IP Address Tracking**: Source IP recorded for all operations
- **User Agent Logging**: Browser/device information captured
- **Immutable Records**: Audit logs cannot be modified by users

---

### 🗄️ Automated Backup System

#### **Production Deployment Backups**
- **Pre-deployment**: Automatic backup before each deployment
- **Post-deployment**: Automatic data restoration after deployment
- **Cross-deployment continuity**: Passenger, volunteer, user, and flight data persists
- **Storage**: Google Cloud Storage with enterprise-grade security
- **Files Backed Up**:
  - `flights.json` - All flight data and passenger information
  - `users.json` - User accounts and permissions (passwords encrypted)
  - `passengers.json` - Passenger database with contact information
  - `volunteers.json` - Volunteer database with contact information
  - `audit_log.json` - Complete audit trail history

#### **Manual Backups**
- **On-Demand**: Admins can create manual backups via web interface
- **Deployment Script**: Command-line backup management via `./deploy-backup.sh`
- **Permanent Retention**: Manual backups are preserved until manually deleted
- **Pre-Restore Backup**: System automatically creates backup before any restore operation
- **Naming Convention**: 
  - Automatic: `auto-YYYY-MM-DDTHH-MM-SS-sssZ`
  - Manual: `manual-YYYY-MM-DDTHH-MM-SS-sssZ`

#### **Backup Storage Security**
- **Google Cloud Storage**: Enterprise-grade security and redundancy
- **Access Control**: Only your GCP project has access to backup bucket
- **Encryption**: Data encrypted at rest and in transit
- **Geographic Redundancy**: Data replicated across multiple data centers
- **Bucket Lifecycle**: Automatic cleanup of old backups

---

### 🛡️ Data Location & Compliance

#### **Data Storage Locations**
- **Application Data**: Stored on Google App Engine (US region)
- **Backup Data**: Google Cloud Storage (US region)
- **In-Transit**: All data encrypted with TLS 1.2+
- **At-Rest**: Encrypted using Google's default encryption

#### **Data Types Handled**
- **Personal Information**: Passenger names and contact details
- **Volunteer Information**: Volunteer names and phone numbers
- **Flight Details**: Travel itineraries and logistics
- **User Accounts**: Administrative access credentials
- **Audit Records**: System activity logs

#### **Compliance Considerations**
- **Data Minimization**: Only necessary data is collected and stored
- **Access Logging**: All data access is logged and auditable
- **Data Retention**: Configurable retention policies for different data types
- **User Rights**: Super admins can export or delete user data as needed

---

### 🔧 Backup Management

#### **Creating Backups**

**Via Web Interface (Recommended):**
1. Login as Super Admin
2. Navigate to "Backup Management" in sidebar
3. Click "Create Backup"
4. Backup will be created with timestamp

**Via Deployment Script:**
```bash
# Create manual backup
./deploy-backup.sh backup

# Deploy with automatic backup and restore
./deploy-backup.sh deploy
```

#### **Restoring Backups**

**Via Web Interface:**
1. Go to Backup Management
2. Select backup from list
3. Click "Restore Backup"
4. Confirm the operation
5. Current data will be backed up first
6. Selected backup will be restored

**Via Deployment Script:**
```bash
# List available backups
./deploy-backup.sh list

# Restore specific backup
./deploy-backup.sh restore manual-2024-01-15T10-30-00-000Z
```

#### **Backup Monitoring**

**Check Backup Status:**
- View backup statistics via web interface (Backup Management)
- Monitor deployment backup/restore via deployment script logs

**Monitor via Web Interface:**
- Backup Management dashboard shows:
  - Total number of backups
  - Storage usage
  - Latest backup timestamp
  - Backup success/failure status

---

### 🚨 Security Best Practices

#### **For Administrators**

1. **Strong Passwords**: Use complex passwords with 12+ characters
2. **Regular Updates**: Change default admin password immediately
3. **Limited Access**: Only grant necessary permissions to users
4. **Monitor Activity**: Regularly review audit trail for suspicious activity
5. **Backup Verification**: Test restore procedures periodically

#### **For Deployment**

1. **Environment Variables**: Never commit secrets to version control
2. **JWT Secret**: Use strong, unique secret for production
3. **HTTPS Only**: Ensure production deployment uses HTTPS
4. **Regular Updates**: Keep dependencies updated for security patches
5. **Access Control**: Restrict GCP project access to necessary personnel

#### **For Users**

1. **Secure Sessions**: Tokens expire after 24 hours automatically
2. **Clean Data**: Only enter necessary, accurate information
3. **Report Issues**: Notify administrators of any suspicious activity
4. **Access Review**: Regularly verify your access permissions are appropriate

---

### 🔍 Incident Response

#### **Data Breach Response**
1. **Immediate Actions**:
   - Review audit trail for unauthorized access
   - Identify scope of potential data exposure
   - Create immediate backup of current state
   - Reset affected user passwords

2. **Investigation**:
   - Check server logs for unusual activity
   - Review recent backup integrity
   - Identify root cause of breach
   - Document all findings

3. **Recovery**:
   - Restore from clean backup if necessary
   - Update security measures to prevent recurrence
   - Notify affected users if required
   - Update access credentials

#### **Data Recovery Scenarios**

**Accidental Deletion:**
1. Stop using the system immediately
2. Create backup of current state
3. Restore from most recent backup before deletion
4. Verify data integrity after restore

**System Corruption:**
1. Assess extent of corruption
2. Identify last known good backup
3. Restore from backup
4. Implement measures to prevent recurrence

**Hardware Failure:**
1. System automatically fails over in Google Cloud
2. Data is protected by Google's redundancy
3. Backups remain accessible in Cloud Storage
4. Redeploy application if necessary

---

### 📊 Backup Schedule & Retention

#### **Automatic Backup Schedule**
- **Production**: Every 24 hours at 2:00 AM UTC
- **Development**: Manual backups only
- **Trigger**: Automatic after application startup (5 seconds delay)

#### **Retention Policies**
- **Automatic Backups**: 90 days (configurable)
- **Manual Backups**: Permanent until manually deleted
- **Cleanup**: Runs automatically with each new backup
- **Storage Limit**: No hard limit, but monitored for cost optimization

#### **Backup Verification**
- **Manifest Files**: Each backup includes metadata and file list
- **Integrity Checks**: Backup process verifies file completeness
- **Test Restores**: Recommended monthly test of restore process
- **Monitoring**: Backup success/failure logged in audit trail

---

### 🔐 Environment Variables Security

#### **Required Production Variables**
```bash
NODE_ENV=production
JWT_SECRET=your-unique-secure-secret-32-chars-minimum
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
FLIGHTAWARE_API_KEY=your-flightaware-api-key
BACKUP_BUCKET_NAME=your-project-id-backups
```

#### **Security Requirements**
- **JWT_SECRET**: Minimum 32 characters, cryptographically random
- **TELEGRAM_BOT_TOKEN**: Obtained from @BotFather on Telegram
- **FLIGHTAWARE_API_KEY**: FlightAware AeroAPI key for real-time flight data
- **BACKUP_BUCKET_NAME**: Unique bucket name in your GCP project
- **Never commit secrets**: Use environment-specific configuration

---

### 📞 Support & Troubleshooting

#### **Common Issues**

**Backup Fails:**
1. Check GCP project permissions
2. Verify backup bucket exists and is accessible
3. Check Google Cloud Storage API is enabled
4. Review application logs for specific errors

**Restore Fails:**
1. Verify backup exists in Cloud Storage
2. Check backup manifest file integrity
3. Ensure sufficient disk space for restore
4. Review file permissions on server

**Access Denied:**
1. Verify user role and permissions
2. Check JWT token validity (24-hour expiration)
3. Confirm airport assignments for users
4. Review audit trail for access attempts

#### **Getting Help**
- **Application Logs**: `gcloud app logs tail -s default`
- **Backup Logs**: Check Cloud Storage access logs
- **Audit Trail**: Review system activity in web interface
- **GCP Console**: Monitor resource usage and errors

---

**🔒 Remember: Your data security is only as strong as your weakest link. Regularly review and update your security practices.**