#!/usr/bin/env node

/**
 * Google Drive Storage Initialization Script
 * 
 * This script initializes your Google Drive folder with properly formatted empty JSON files
 * to prevent parsing errors on first startup.
 */

const { google } = require('googleapis');

async function initializeDriveStorage() {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  
  if (!folderId) {
    console.error('❌ GOOGLE_DRIVE_FOLDER_ID environment variable not set');
    process.exit(1);
  }

  console.log('🚀 Starting Google Drive storage initialization...');
  console.log(`📁 Target folder ID: ${folderId}`);

  try {
    // Initialize Google Drive API
    let authClient;
    
    if (process.env.GOOGLE_CREDENTIALS_JSON) {
      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
      const auth = new google.auth.GoogleAuth({
        credentials: credentials,
        scopes: ['https://www.googleapis.com/auth/drive']
      });
      authClient = await auth.getClient();
      console.log('🔑 Using hardcoded service account credentials');
    } else {
      const auth = new google.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/drive']
      });
      authClient = await auth.getClient();
      console.log('🔑 Using Google Cloud default credentials');
    }
    
    const drive = google.drive({ version: 'v3', auth: authClient });

    // Validate folder exists
    console.log('🔍 Validating Google Drive folder...');
    const folderInfo = await drive.files.get({
      fileId: folderId,
      fields: 'id, name, mimeType'
    });
    
    if (folderInfo.data.mimeType !== 'application/vnd.google-apps.folder') {
      throw new Error(`ID ${folderId} is not a folder`);
    }
    
    console.log(`✅ Folder validated: "${folderInfo.data.name}"`);

    // Define the JSON files we need to initialize
    const jsonFiles = {
      'flights.json': [],
      'passengers.json': [],
      'users.json': [],
      'volunteers.json': [],
      'audit_log.json': []
    };

    // Initialize each JSON file
    for (const [fileName, initialData] of Object.entries(jsonFiles)) {
      console.log(`📄 Initializing ${fileName}...`);
      
      try {
        // Check if file already exists
        const existingFiles = await drive.files.list({
          q: `name='${fileName}' and parents in '${folderId}'`,
          fields: 'files(id, name)'
        });

        const jsonContent = JSON.stringify(initialData, null, 2);

        if (existingFiles.data.files.length > 0) {
          // Update existing file
          const fileId = existingFiles.data.files[0].id;
          await drive.files.update({
            fileId: fileId,
            media: {
              mimeType: 'application/json',
              body: jsonContent
            }
          });
          console.log(`   ✅ Updated existing ${fileName}`);
        } else {
          // Create new file
          await drive.files.create({
            requestBody: {
              name: fileName,
              parents: [folderId]
            },
            media: {
              mimeType: 'application/json',
              body: jsonContent
            }
          });
          console.log(`   ✅ Created new ${fileName}`);
        }
      } catch (error) {
        console.error(`   ❌ Error with ${fileName}:`, error.message);
        throw error;
      }
    }

    // Create backup folder if it doesn't exist
    console.log('📁 Ensuring backup folder exists...');
    const backupFolders = await drive.files.list({
      q: `name='backup' and parents in '${folderId}' and mimeType='application/vnd.google-apps.folder'`,
      fields: 'files(id, name)'
    });

    if (backupFolders.data.files.length === 0) {
      await drive.files.create({
        requestBody: {
          name: 'backup',
          mimeType: 'application/vnd.google-apps.folder',
          parents: [folderId]
        }
      });
      console.log('   ✅ Created backup folder');
    } else {
      console.log('   ✅ Backup folder already exists');
    }

    console.log('');
    console.log('🎉 Google Drive storage initialization complete!');
    console.log('');
    console.log('📋 Summary:');
    console.log('   - All JSON files initialized with empty arrays');
    console.log('   - Backup folder ready');
    console.log('   - Ready for zero-error application startup');
    console.log('');
    console.log('🚀 You can now deploy your application!');

  } catch (error) {
    console.error('');
    console.error('❌ Initialization failed:', error.message);
    console.error('');
    
    if (error.code === 404) {
      console.error('💡 Possible solutions:');
      console.error('   - Check that the folder ID is correct');
      console.error('   - Ensure the folder is shared with the service account');
      console.error('   - Verify the service account has Editor permissions');
    }
    
    process.exit(1);
  }
}

// Run the initialization
if (require.main === module) {
  initializeDriveStorage().catch(console.error);
}

module.exports = { initializeDriveStorage };