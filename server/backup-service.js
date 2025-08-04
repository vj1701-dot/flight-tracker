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

  async createBackup(manual = false) {
    try {
      await this.initializeStorage();
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFolder = manual ? `manual-${timestamp}` : `auto-${timestamp}`;
      
      console.log(`📦 Creating backup: ${backupFolder}`);
      
      return await this.createGCSBackup(backupFolder, manual, timestamp);
    } catch (error) {
      console.error('Backup failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  async createGCSBackup(backupFolder, manual, timestamp) {
    const bucket = this.storage.bucket(this.bucketName);
    const uploadPromises = [];

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
          })
        );
      } catch (error) {
        console.log(`⚠️  File ${fileName} not found, skipping...`);
      }
    }

    await Promise.all(uploadPromises);
    
    // Create backup manifest
    const manifest = {
      timestamp,
      backupType: manual ? 'manual' : 'automatic',
      environment: process.env.NODE_ENV || 'development',
      files: this.dataFiles,
      created: new Date().toISOString()
    };

    await bucket.file(`${backupFolder}/manifest.json`).save(JSON.stringify(manifest, null, 2));
    
    console.log(`✅ GCS Backup created successfully: ${backupFolder}`);
    
    // Clean up old automatic backups (keep last 30)
    if (!manual) {
      await this.cleanupOldBackups();
    }
    
    return { success: true, backupFolder };
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
    const bucket = this.storage.bucket(this.bucketName);
    
    // Check if backup exists
    const [manifestExists] = await bucket.file(`${backupFolder}/manifest.json`).exists();
    if (!manifestExists) {
      throw new Error(`Backup ${backupFolder} not found`);
    }

    // Download manifest
    const [manifestContent] = await bucket.file(`${backupFolder}/manifest.json`).download();
    const manifest = JSON.parse(manifestContent.toString());
    
    console.log(`📋 Backup created: ${manifest.created}`);
    console.log(`📋 Backup type: ${manifest.backupType}`);

    // Create restore backup of current data
    await this.createBackup(true);

    // Download and restore each file
    for (const fileName of manifest.files) {
      const sourceFile = `${backupFolder}/${fileName}`;
      const localPath = path.join(__dirname, fileName);
      
      try {
        const [exists] = await bucket.file(sourceFile).exists();
        if (exists) {
          await bucket.file(sourceFile).download({ destination: localPath });
          console.log(`✅ Restored: ${fileName}`);
        }
      } catch (error) {
        console.log(`⚠️  Could not restore ${fileName}: ${error.message}`);
      }
    }
    
    console.log(`✅ GCS Restore completed: ${backupFolder}`);
    return { success: true };
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
      
      const [files] = await bucket.getFiles({ prefix: '', delimiter: '/' });
      
      const backups = new Set();
      files.forEach(file => {
        const parts = file.name.split('/');
        if (parts.length > 1 && (parts[0].startsWith('auto-') || parts[0].startsWith('manual-'))) {
          backups.add(parts[0]);
        }
      });

      const backupList = Array.from(backups).sort().reverse();
      console.log(`Found ${backupList.length} backups in GCS bucket`);
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