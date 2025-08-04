const fs = require('fs').promises;
const path = require('path');
const { readFlights, readUsers, readPassengers } = require('./data-helpers');

const { Storage } = require('@google-cloud/storage');

class BackupService {
  constructor() {
    // Initialize Google Cloud Storage
    this.storage = new Storage();
    
    // Use project-specific bucket name if available
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || 'flight-tracker';
    this.bucketName = process.env.BACKUP_BUCKET_NAME || `${projectId}-backups`;
    
    console.log(`✅ Using Google Cloud Storage for backups: ${this.bucketName}`);
    console.log(`Project ID: ${projectId}`);
    
    this.dataFiles = [
      'flights.json',
      'users.json', 
      'passengers.json',
      'volunteers.json',
      'audit_log.json'
    ];
  }

  async initializeStorage() {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const [exists] = await bucket.exists();
      
      if (!exists) {
        console.log(`Creating backup bucket: ${this.bucketName}`);
        try {
          await this.storage.createBucket(this.bucketName, {
            location: 'US',
            storageClass: 'STANDARD',
            uniformBucketLevelAccess: true
          });
          console.log(`✅ Backup bucket created: ${this.bucketName}`);
        } catch (createError) {
          if (createError.code === 409) {
            console.log(`Bucket ${this.bucketName} already exists (created by another process)`);
          } else {
            throw createError;
          }
        }
      } else {
        console.log(`✅ Backup bucket already exists: ${this.bucketName}`);
      }
      
      // Test bucket access
      await bucket.getMetadata();
      return true;
    } catch (error) {
      console.error('Error initializing backup bucket:', error.message);
      console.error('Make sure your Google Cloud credentials are properly configured.');
      console.error('You may need to set GOOGLE_APPLICATION_CREDENTIALS or run gcloud auth application-default login');
      return false;
    }
  }

  generateTimestamp() {
    // Use West Coast timezone (Pacific Time)
    const now = new Date();
    const pacificTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
    return pacificTime.toISOString().replace(/[:.]/g, '-');
  }

  async createBackup(manual = false, skipPreBackup = false) {
    try {
      const storageReady = await this.initializeStorage();
      if (!storageReady) {
        throw new Error('Could not initialize backup storage');
      }
      
      const timestamp = this.generateTimestamp();
      const backupFolder = manual ? `manual-${timestamp}` : `auto-${timestamp}`;
      
      console.log(`📦 Creating backup: ${backupFolder}`);
      
      const result = await this.createGCSBackup(backupFolder, manual, timestamp, skipPreBackup);
      console.log(`✅ Backup creation completed: ${result.success ? 'SUCCESS' : 'FAILED'}`);
      return result;
    } catch (error) {
      console.error('Backup creation failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  async createGCSBackup(backupFolder, manual, timestamp, skipPreBackup = false) {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const uploadPromises = [];
      const uploadedFiles = [];

      console.log(`📋 Backing up ${this.dataFiles.length} data files...`);

      // Backup each data file
      for (const fileName of this.dataFiles) {
        const filePath = path.join(__dirname, fileName);
        
        try {
          await fs.access(filePath);
          const destination = `${backupFolder}/${fileName}`;
          
          uploadPromises.push(
            bucket.upload(filePath, {
              destination,
              metadata: {
                metadata: {
                  backupType: manual ? 'manual' : 'automatic',
                  timestamp,
                  environment: process.env.NODE_ENV || 'development'
                }
              }
            }).then(() => {
              uploadedFiles.push(fileName);
              console.log(`✅ Uploaded: ${fileName}`);
            })
          );
        } catch (error) {
          console.log(`⚠️  File ${fileName} not found, skipping...`);
        }
      }

      await Promise.all(uploadPromises);
      console.log(`📁 Successfully uploaded ${uploadedFiles.length} files`);
      
      // Create backup manifest with Pacific timezone
      const pacificTime = new Date().toLocaleString("en-US", {
        timeZone: "America/Los_Angeles",
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });

      const manifest = {
        timestamp,
        backupType: manual ? 'manual' : 'automatic',
        environment: process.env.NODE_ENV || 'development',
        files: uploadedFiles,
        totalFiles: uploadedFiles.length,
        created: new Date().toISOString(),
        createdPacific: pacificTime,
        backupFolder
      };

      await bucket.file(`${backupFolder}/manifest.json`).save(JSON.stringify(manifest, null, 2));
      console.log(`📋 Manifest created for backup: ${backupFolder}`);
      
      // Clean up old automatic backups (keep last 30) - but skip during restore operations
      if (!manual && !skipPreBackup) {
        try {
          await this.cleanupOldBackups();
        } catch (cleanupError) {
          console.warn('Cleanup warning:', cleanupError.message);
          // Don't fail the backup if cleanup fails
        }
      }
      
      console.log(`✅ GCS Backup completed successfully: ${backupFolder}`);
      return { success: true, backupFolder, filesBackedUp: uploadedFiles.length };
    } catch (error) {
      console.error('GCS Backup creation failed:', error.message);
      throw error;
    }
  }


  async restoreBackup(backupFolder) {
    try {
      console.log(`🔄 Restoring backup: ${backupFolder}`);
      
      return await this.restoreGCSBackup(backupFolder);
    } catch (error) {
      console.error('Restore failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  async restoreGCSBackup(backupFolder) {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      
      console.log(`🔍 Checking backup: ${backupFolder}`);
      
      // Check if backup exists
      const [manifestExists] = await bucket.file(`${backupFolder}/manifest.json`).exists();
      if (!manifestExists) {
        throw new Error(`Backup ${backupFolder} not found or manifest missing`);
      }

      // Download manifest
      const [manifestContent] = await bucket.file(`${backupFolder}/manifest.json`).download();
      const manifest = JSON.parse(manifestContent.toString());
      
      console.log(`📋 Found backup created: ${manifest.createdPacific || manifest.created}`);
      console.log(`📋 Backup type: ${manifest.backupType}`);
      console.log(`📋 Files to restore: ${manifest.totalFiles || manifest.files.length}`);

      // Create pre-restore backup of current data (skip pre-backup to avoid recursion)
      console.log(`💾 Creating pre-restore backup...`);
      const preRestoreResult = await this.createBackup(true, true); // skipPreBackup = true
      if (preRestoreResult.success) {
        console.log(`✅ Pre-restore backup created: ${preRestoreResult.backupFolder}`);
      } else {
        console.warn(`⚠️  Pre-restore backup failed: ${preRestoreResult.error}`);
      }

      // Download and restore each file
      let restoredCount = 0;
      const filesToRestore = manifest.files || this.dataFiles;
      
      for (const fileName of filesToRestore) {
        const sourceFile = `${backupFolder}/${fileName}`;
        const localPath = path.join(__dirname, fileName);
        
        try {
          const [exists] = await bucket.file(sourceFile).exists();
          if (exists) {
            await bucket.file(sourceFile).download({ destination: localPath });
            console.log(`✅ Restored: ${fileName}`);
            restoredCount++;
          } else {
            console.log(`⚠️  File not found in backup: ${fileName}`);
          }
        } catch (error) {
          console.log(`❌ Could not restore ${fileName}: ${error.message}`);
        }
      }
      
      console.log(`✅ GCS Restore completed: ${backupFolder}`);
      console.log(`📊 Files restored: ${restoredCount}/${filesToRestore.length}`);
      
      return { 
        success: true, 
        backupFolder,
        filesRestored: restoredCount,
        totalFiles: filesToRestore.length,
        preRestoreBackup: preRestoreResult.backupFolder
      };
    } catch (error) {
      console.error('GCS Restore failed:', error.message);
      throw error;
    }
  }


  async listBackups() {
    try {
      console.log(`Attempting to list backups from bucket: ${this.bucketName}`);
      return await this.listGCSBackups();
    } catch (error) {
      console.error('Failed to list backups:', error.message);
      console.error('Full error:', error);
      
      // Provide more helpful error messages
      let userMessage = error.message;
      if (error.code === 403) {
        userMessage = 'Access denied to backup bucket. Please check Google Cloud permissions.';
      } else if (error.code === 404) {
        userMessage = 'Backup bucket not found. It will be created automatically on first backup.';
      } else if (error.message.includes('credentials')) {
        userMessage = 'Google Cloud credentials not configured properly.';
      }
      
      return { success: false, error: userMessage };
    }
  }

  async listGCSBackups() {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      
      // Check if bucket exists first
      const [exists] = await bucket.exists();
      if (!exists) {
        console.log(`Backup bucket ${this.bucketName} does not exist, creating...`);
        await this.initializeStorage();
        return { success: true, backups: [] };
      }
      
      console.log(`🔍 Scanning bucket for backups: ${this.bucketName}`);
      const [files] = await bucket.getFiles();
      
      const backupFolders = new Set();
      const backupDetails = new Map();
      
      // Process all files to find backup folders and manifests
      for (const file of files) {
        const parts = file.name.split('/');
        if (parts.length >= 2) {
          const folderName = parts[0];
          
          // Only include folders that match backup naming pattern
          if (folderName.startsWith('auto-') || folderName.startsWith('manual-')) {
            backupFolders.add(folderName);
            
            // If this is a manifest file, get additional details
            if (parts[1] === 'manifest.json') {
              try {
                const [manifestContent] = await file.download();
                const manifest = JSON.parse(manifestContent.toString());
                backupDetails.set(folderName, {
                  folder: folderName,
                  type: manifest.backupType,
                  created: manifest.createdPacific || manifest.created,
                  createdISO: manifest.created,
                  filesCount: manifest.totalFiles || manifest.files?.length || 0,
                  environment: manifest.environment
                });
              } catch (manifestError) {
                console.warn(`Could not read manifest for ${folderName}:`, manifestError.message);
                // Add basic info even if manifest can't be read
                backupDetails.set(folderName, {
                  folder: folderName,
                  type: folderName.startsWith('manual-') ? 'manual' : 'automatic',
                  created: 'Unknown',
                  createdISO: null,
                  filesCount: 0,
                  environment: 'unknown'
                });
              }
            }
          }
        }
      }

      // Convert to sorted array with details
      const backupList = Array.from(backupFolders)
        .sort()
        .reverse()
        .map(folder => backupDetails.get(folder) || {
          folder,
          type: folder.startsWith('manual-') ? 'manual' : 'automatic',
          created: 'Unknown',
          createdISO: null,
          filesCount: 0,
          environment: 'unknown'
        });

      console.log(`✅ Found ${backupList.length} backups in GCS bucket`);
      console.log(`📊 Manual: ${backupList.filter(b => b.type === 'manual').length}, Auto: ${backupList.filter(b => b.type === 'automatic').length}`);
      
      return { success: true, backups: backupList };
    } catch (error) {
      console.error('Error listing GCS backups:', error.message);
      
      // If it's a permission or bucket issue, try to initialize
      if (error.code === 'ENOENT' || error.code === 403 || error.code === 404) {
        console.log('Attempting to initialize backup storage...');
        const initialized = await this.initializeStorage();
        if (initialized) {
          return { success: true, backups: [] };
        }
      }
      
      throw error;
    }
  }


  async cleanupOldBackups(keepCount = 30) {
    try {
      const { success, backups } = await this.listBackups();
      if (!success) return;

      const autoBackups = backups.filter(b => b.startsWith('auto-')).sort().reverse();
      
      if (autoBackups.length > keepCount) {
        const toDelete = autoBackups.slice(keepCount);
        await this.cleanupGCSBackups(toDelete);
      }
    } catch (error) {
      console.error('Cleanup failed:', error.message);
    }
  }

  async cleanupGCSBackups(toDelete) {
    const bucket = this.storage.bucket(this.bucketName);
    
    for (const backupFolder of toDelete) {
      const [files] = await bucket.getFiles({ prefix: `${backupFolder}/` });
      await Promise.all(files.map(file => file.delete()));
      console.log(`🗑️  Deleted old GCS backup: ${backupFolder}`);
    }
  }


  // Schedule automatic backups
  startAutomaticBackups(intervalHours = 24) {
    console.log(`⏰ Starting automatic backups every ${intervalHours} hours`);
    
    // Initial backup
    setTimeout(() => this.createBackup(false), 5000); // 5 seconds after startup
    
    // Recurring backups
    setInterval(() => {
      this.createBackup(false);
    }, intervalHours * 60 * 60 * 1000);
  }

  // Get backup statistics
  async getBackupStats() {
    try {
      const { success, backups } = await this.listBackups();
      if (!success) return { error: 'Failed to get stats' };

      const autoBackups = backups.filter(b => b.startsWith('auto-'));
      const manualBackups = backups.filter(b => b.startsWith('manual-'));
      
      let totalSize = 0;
      
      const bucket = this.storage.bucket(this.bucketName);
      const [files] = await bucket.getFiles();
      for (const file of files) {
        const [metadata] = await file.getMetadata();
        totalSize += parseInt(metadata.size || 0);
      }

      return {
        totalBackups: backups.length,
        automaticBackups: autoBackups.length,
        manualBackups: manualBackups.length,
        totalSizeBytes: totalSize,
        totalSizeMB: Math.round(totalSize / 1024 / 1024 * 100) / 100,
        latestBackup: backups[0] || 'None',
        bucketName: this.bucketName,
        storageType: 'Google Cloud Storage'
      };
    } catch (error) {
      return { error: error.message };
    }
  }
}

module.exports = BackupService;