const { Storage } = require('@google-cloud/storage');
const fs = require('fs').promises;
const path = require('path');
const { readFlights, readUsers, readPassengers } = require('./data-helpers');

class BackupService {
  constructor() {
    this.storage = new Storage();
    this.bucketName = process.env.BACKUP_BUCKET_NAME || 'west-sant-transport-backups';
    this.dataFiles = [
      'flights.json',
      'users.json', 
      'passengers.json',
      'volunteers.json',
      'audit_log.json'
    ];
  }

  async initializeBucket() {
    try {
      const [exists] = await this.storage.bucket(this.bucketName).exists();
      if (!exists) {
        console.log(`Creating backup bucket: ${this.bucketName}`);
        await this.storage.createBucket(this.bucketName, {
          location: 'US',
          storageClass: 'STANDARD',
          uniformBucketLevelAccess: true
        });
        console.log(`✅ Backup bucket created: ${this.bucketName}`);
      }
      return true;
    } catch (error) {
      console.error('Error initializing backup bucket:', error.message);
      return false;
    }
  }

  async createBackup(manual = false) {
    try {
      await this.initializeBucket();
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFolder = manual ? `manual-${timestamp}` : `auto-${timestamp}`;
      
      console.log(`📦 Creating backup: ${backupFolder}`);
      
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
      
      console.log(`✅ Backup created successfully: ${backupFolder}`);
      
      // Clean up old automatic backups (keep last 30)
      if (!manual) {
        await this.cleanupOldBackups();
      }
      
      return { success: true, backupFolder };
    } catch (error) {
      console.error('Backup failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  async restoreBackup(backupFolder) {
    try {
      console.log(`🔄 Restoring backup: ${backupFolder}`);
      
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
      
      console.log(`✅ Restore completed: ${backupFolder}`);
      return { success: true };
    } catch (error) {
      console.error('Restore failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  async listBackups() {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const [files] = await bucket.getFiles({ prefix: '', delimiter: '/' });
      
      const backups = new Set();
      files.forEach(file => {
        const parts = file.name.split('/');
        if (parts.length > 1) {
          backups.add(parts[0]);
        }
      });

      const backupList = Array.from(backups).sort().reverse();
      return { success: true, backups: backupList };
    } catch (error) {
      console.error('Failed to list backups:', error.message);
      return { success: false, error: error.message };
    }
  }

  async cleanupOldBackups(keepCount = 30) {
    try {
      const { success, backups } = await this.listBackups();
      if (!success) return;

      const autoBackups = backups.filter(b => b.startsWith('auto-')).sort().reverse();
      
      if (autoBackups.length > keepCount) {
        const toDelete = autoBackups.slice(keepCount);
        const bucket = this.storage.bucket(this.bucketName);
        
        for (const backupFolder of toDelete) {
          const [files] = await bucket.getFiles({ prefix: `${backupFolder}/` });
          await Promise.all(files.map(file => file.delete()));
          console.log(`🗑️  Deleted old backup: ${backupFolder}`);
        }
      }
    } catch (error) {
      console.error('Cleanup failed:', error.message);
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
      
      const bucket = this.storage.bucket(this.bucketName);
      let totalSize = 0;
      
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
        bucketName: this.bucketName
      };
    } catch (error) {
      return { error: error.message };
    }
  }
}

module.exports = BackupService;