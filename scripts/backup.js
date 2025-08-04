#!/usr/bin/env node

/**
 * Standalone backup script for West Sant Transportation
 * Usage: node scripts/backup.js [create|restore|list|stats] [backup-folder]
 */

const path = require('path');
process.chdir(path.join(__dirname, '../server'));

const BackupService = require('../server/backup-service');

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'create';
  const backupFolder = args[1];

  const backupService = new BackupService();

  console.log('🔄 West Sant Transportation Backup Tool\n');

  switch (command) {
    case 'create':
      console.log('📦 Creating manual backup...');
      const createResult = await backupService.createBackup(true);
      if (createResult.success) {
        console.log(`✅ Backup created: ${createResult.backupFolder}`);
      } else {
        console.error(`❌ Backup failed: ${createResult.error}`);
        process.exit(1);
      }
      break;

    case 'restore':
      if (!backupFolder) {
        console.error('❌ Please specify a backup folder to restore');
        console.log('Usage: node scripts/backup.js restore <backup-folder>');
        process.exit(1);
      }
      console.log(`🔄 Restoring backup: ${backupFolder}`);
      const restoreResult = await backupService.restoreBackup(backupFolder);
      if (restoreResult.success) {
        console.log('✅ Backup restored successfully');
        console.log('⚠️  Please restart the application to reload data');
      } else {
        console.error(`❌ Restore failed: ${restoreResult.error}`);
        process.exit(1);
      }
      break;

    case 'list':
      console.log('📋 Available backups:');
      const listResult = await backupService.listBackups();
      if (listResult.success) {
        if (listResult.backups.length === 0) {
          console.log('  No backups found');
        } else {
          listResult.backups.forEach((backup, index) => {
            const type = backup.startsWith('auto-') ? '🤖 Auto' : '👤 Manual';
            const date = backup.split('-').slice(1).join('-').replace(/T/, ' ').replace(/Z$/, ' UTC');
            console.log(`  ${index + 1}. ${type} - ${backup}`);
            console.log(`     Created: ${date}`);
          });
        }
      } else {
        console.error(`❌ Failed to list backups: ${listResult.error}`);
        process.exit(1);
      }
      break;

    case 'stats':
      console.log('📊 Backup statistics:');
      const stats = await backupService.getBackupStats();
      if (stats.error) {
        console.error(`❌ Failed to get stats: ${stats.error}`);
        process.exit(1);
      } else {
        console.log(`  Bucket: ${stats.bucketName}`);
        console.log(`  Total backups: ${stats.totalBackups}`);
        console.log(`  Automatic backups: ${stats.automaticBackups}`);
        console.log(`  Manual backups: ${stats.manualBackups}`);
        console.log(`  Total size: ${stats.totalSizeMB} MB`);
        console.log(`  Latest backup: ${stats.latestBackup}`);
      }
      break;

    case 'cleanup':
      console.log('🧹 Cleaning up old automatic backups...');
      await backupService.cleanupOldBackups(30); // Keep last 30
      console.log('✅ Cleanup completed');
      break;

    default:
      console.log('Available commands:');
      console.log('  create  - Create a manual backup');
      console.log('  restore <folder> - Restore from backup');
      console.log('  list    - List all available backups');
      console.log('  stats   - Show backup statistics');
      console.log('  cleanup - Clean up old automatic backups');
      console.log('');
      console.log('Examples:');
      console.log('  node scripts/backup.js create');
      console.log('  node scripts/backup.js list');
      console.log('  node scripts/backup.js restore manual-2024-01-15T10-30-00-000Z');
      break;
  }
}

main().catch(error => {
  console.error('❌ Script failed:', error.message);
  process.exit(1);
});