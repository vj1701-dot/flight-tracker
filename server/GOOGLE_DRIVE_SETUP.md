# Google Drive JSON Storage Setup

This guide explains how to set up and initialize Google Drive JSON storage for the Flight Tracker application.

## 🚀 Quick Start

### 1. Run the Initialization Script

After deploying to Cloud Run with the proper environment variables, run this once:

```bash
# Using npm script
npm run init-drive

# Or directly
node initialize-drive-storage.js
```

### 2. Environment Variables Required

```bash
GOOGLE_DRIVE_FOLDER_ID=your_google_drive_folder_id_here
GOOGLE_CREDENTIALS_JSON={"type":"service_account",...}
```

## 📁 What Gets Created

The initialization script creates these files in your Google Drive folder:

```
📂 Your Google Drive Folder
├── 📄 flights.json        (empty array: [])
├── 📄 passengers.json     (empty array: [])
├── 📄 users.json         (empty array: [])
├── 📄 volunteers.json    (empty array: [])
├── 📄 audit_log.json     (empty array: [])
└── 📂 backup/           (backup folder for automatic backups)
```

## ✅ Zero-Error Startup Process

1. **Deploy** your application with environment variables
2. **Initialize** Google Drive storage: `npm run init-drive`
3. **Restart** the application - it will now start with zero JSON parsing errors
4. **Verify** by checking logs for: `✅ GOOGLE_DRIVE: Initialized successfully`

## 🔧 Troubleshooting

### "File not found" Error
- Verify folder ID is correct
- Check folder is shared with your service account email
- Ensure service account has "Editor" permissions

### "Invalid JSON" Errors  
- Run the initialization script to overwrite corrupted files
- Check that files contain proper JSON arrays, not text

### "Google Drive API not enabled"
- Enable Google Drive API in your Google Cloud project
- Wait a few minutes for propagation

## 📊 Manual Verification

You can manually check your Google Drive folder after initialization:

1. Go to: https://drive.google.com
2. Navigate to your folder (or use the folder ID in URL)
3. Verify all JSON files exist and contain `[]`
4. Confirm backup folder exists

## 🔄 Re-initialization

Safe to run multiple times - it will update existing files without data loss for empty arrays.

For production data, the script will overwrite existing files, so backup important data first.