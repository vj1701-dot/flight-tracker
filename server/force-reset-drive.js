#!/usr/bin/env node

/**
 * Force Reset Google Drive Storage
 * 
 * This script forcefully deletes all JSON files and recreates them with proper empty arrays
 */

const { google } = require('googleapis');

async function forceResetDriveStorage() {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  
  if (!folderId) {
    console.error('❌ GOOGLE_DRIVE_FOLDER_ID environment variable not set');
    process.exit(1);
  }

  console.log('🚀 Starting FORCE RESET of Google Drive storage...');
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
    const jsonFiles = [
      'flights.json',
      'passengers.json', 
      'users.json',
      'volunteers.json',
      'audit_log.json'
    ];

    // First, list ALL files in the folder to see what's there
    console.log('📋 Listing all files in folder...');
    const allFiles = await drive.files.list({
      q: `parents in '${folderId}'`,
      fields: 'files(id, name, mimeType)',
      pageSize: 100
    });
    
    console.log(`Found ${allFiles.data.files.length} files in folder:`);
    allFiles.data.files.forEach(file => {
      console.log(`  - ${file.name} (${file.mimeType}) [${file.id}]`);
    });

    // Delete ALL existing JSON files first
    for (const file of allFiles.data.files) {
      if (jsonFiles.includes(file.name)) {
        console.log(`🗑️ Deleting existing ${file.name}...`);
        try {
          await drive.files.delete({
            fileId: file.id
          });
          console.log(`   ✅ Deleted ${file.name}`);
        } catch (deleteError) {
          console.error(`   ❌ Error deleting ${file.name}:`, deleteError.message);
        }
      }
    }

    // Wait a moment for deletion to propagate
    console.log('⏳ Waiting for deletions to propagate...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Now create fresh JSON files with proper empty arrays
    for (const fileName of jsonFiles) {
      console.log(`📄 Creating fresh ${fileName}...`);
      
      try {
        const jsonContent = JSON.stringify([], null, 2);
        
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
        console.log(`   ✅ Created fresh ${fileName} with empty array`);
      } catch (error) {
        console.error(`   ❌ Error creating ${fileName}:`, error.message);
        throw error;
      }
    }

    // Verify the files were created correctly
    console.log('🔍 Verifying created files...');
    for (const fileName of jsonFiles) {
      try {
        const files = await drive.files.list({
          q: `name='${fileName}' and parents in '${folderId}'`,
          fields: 'files(id, name)'
        });
        
        if (files.data.files.length > 0) {
          const fileId = files.data.files[0].id;
          const content = await drive.files.get({
            fileId: fileId,
            alt: 'media'
          });
          
          const parsed = JSON.parse(content.data);
          if (Array.isArray(parsed) && parsed.length === 0) {
            console.log(`   ✅ ${fileName} verified - contains empty array`);
          } else {
            console.log(`   ⚠️ ${fileName} contains: ${JSON.stringify(parsed)}`);
          }
        } else {
          console.log(`   ❌ ${fileName} not found after creation`);
        }
      } catch (error) {
        console.error(`   ❌ Error verifying ${fileName}:`, error.message);
      }
    }

    console.log('');
    console.log('🎉 FORCE RESET completed successfully!');
    console.log('');
    console.log('📋 All JSON files have been forcefully recreated with empty arrays');
    console.log('🚀 Your application should now start without JSON parsing errors');

  } catch (error) {
    console.error('');
    console.error('❌ Force reset failed:', error.message);
    console.error('');
    process.exit(1);
  }
}

// Run the force reset
if (require.main === module) {
  forceResetDriveStorage().catch(console.error);
}

module.exports = { forceResetDriveStorage };