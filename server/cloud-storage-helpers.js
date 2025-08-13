const { Storage } = require('@google-cloud/storage');

class CloudStorageDataManager {
  constructor() {
    this.storage = new Storage();
    
    // Use the same bucket naming convention as backup service
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || 'n8n-projects-460107';
    this.bucketName = process.env.DATA_BUCKET_NAME || `${projectId}-data`;
    
    console.log(`📦 Using Cloud Storage for data persistence: ${this.bucketName}`);
    
    // Data file paths in the bucket
    this.files = {
      flights: 'data/flights.json',
      users: 'data/users.json',
      passengers: 'data/passengers.json',
      volunteers: 'data/volunteers.json',
      airports: 'data/airports.json',
      audit_log: 'data/audit_log.json',
      registrationStates: 'data/registration-states.json',
      processedMessages: 'data/processed-messages.json'
    };
    
    // Initialize bucket on startup
    this.initializeBucket();
  }

  async initializeBucket() {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const [exists] = await bucket.exists();
      
      if (!exists) {
        console.log(`Creating data bucket: ${this.bucketName}`);
        await this.storage.createBucket(this.bucketName, {
          location: 'US',
          storageClass: 'STANDARD',
          uniformBucketLevelAccess: true
        });
        console.log(`✅ Data bucket created: ${this.bucketName}`);
      } else {
        console.log(`✅ Data bucket already exists: ${this.bucketName}`);
      }
      
      // Test bucket access
      await bucket.getMetadata();
      return true;
    } catch (error) {
      console.error('Error initializing data bucket:', error.message);
      console.error('Falling back to local file storage');
      return false;
    }
  }

  async readFromStorage(fileName) {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(fileName);
      
      const [exists] = await file.exists();
      if (!exists) {
        return null; // File doesn't exist
      }
      
      const [contents] = await file.download();
      return JSON.parse(contents.toString());
    } catch (error) {
      console.error(`Error reading ${fileName} from Cloud Storage:`, error.message);
      return null;
    }
  }

  async writeToStorage(fileName, data) {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(fileName);
      
      const jsonData = JSON.stringify(data, null, 2);
      await file.save(jsonData, {
        metadata: {
          contentType: 'application/json',
          metadata: {
            lastModified: new Date().toISOString()
          }
        }
      });
      
      console.log(`✅ Saved ${fileName} to Cloud Storage`);
      return true;
    } catch (error) {
      console.error(`Error writing ${fileName} to Cloud Storage:`, error.message);
      throw error;
    }
  }

  // Flight operations
  async readFlights() {
    const data = await this.readFromStorage(this.files.flights);
    return data || [];
  }

  async writeFlights(flights) {
    await this.writeToStorage(this.files.flights, flights);
  }

  // User operations
  async readUsers() {
    const data = await this.readFromStorage(this.files.users);
    return data || [];
  }

  async writeUsers(users) {
    await this.writeToStorage(this.files.users, users);
  }

  // Passenger operations
  async readPassengers() {
    const data = await this.readFromStorage(this.files.passengers);
    return data || [];
  }

  async writePassengers(passengers) {
    await this.writeToStorage(this.files.passengers, passengers);
  }

  // Volunteer operations
  async readVolunteers() {
    const data = await this.readFromStorage(this.files.volunteers);
    return data || [];
  }

  async writeVolunteers(volunteers) {
    await this.writeToStorage(this.files.volunteers, volunteers);
  }

  // Airport operations
  async readAirports() {
    const data = await this.readFromStorage(this.files.airports);
    return data || [];
  }

  async writeAirports(airports) {
    await this.writeToStorage(this.files.airports, airports);
  }

  // Audit log operations
  async readAuditLog() {
    const data = await this.readFromStorage(this.files.audit_log);
    return data || [];
  }

  async writeAuditLog(auditLog) {
    await this.writeToStorage(this.files.audit_log, auditLog);
  }

  // Registration states operations (for Telegram bot)
  async readRegistrationStates() {
    const data = await this.readFromStorage(this.files.registrationStates);
    return data || {};
  }

  async writeRegistrationStates(states) {
    await this.writeToStorage(this.files.registrationStates, states);
  }

  // Processed messages operations (for Telegram bot)
  async readProcessedMessages() {
    const data = await this.readFromStorage(this.files.processedMessages);
    return data || [];
  }

  async writeProcessedMessages(messages) {
    await this.writeToStorage(this.files.processedMessages, messages);
  }

  // Migration helper - copy local files to Cloud Storage
  async migrateLocalToCloud() {
    const fs = require('fs').promises;
    const path = require('path');
    
    console.log('🚀 Starting migration from local files to Cloud Storage...');
    
    const localFiles = [
      { local: path.join(__dirname, 'flights.json'), cloud: this.files.flights },
      { local: path.join(__dirname, 'users.json'), cloud: this.files.users },
      { local: path.join(__dirname, 'passengers.json'), cloud: this.files.passengers },
      { local: path.join(__dirname, 'volunteers.json'), cloud: this.files.volunteers },
      { local: path.join(__dirname, 'data/airports.json'), cloud: this.files.airports },
      { local: path.join(__dirname, 'audit_log.json'), cloud: this.files.audit_log }
    ];

    let migrated = 0;
    for (const { local, cloud } of localFiles) {
      try {
        const data = await fs.readFile(local, 'utf8');
        const jsonData = JSON.parse(data);
        await this.writeToStorage(cloud, jsonData);
        console.log(`✅ Migrated ${local} → ${cloud}`);
        migrated++;
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.error(`❌ Error migrating ${local}:`, error.message);
        }
      }
    }
    
    console.log(`🎉 Migration complete: ${migrated} files migrated to Cloud Storage`);
    return migrated;
  }
}

// Create singleton instance
const cloudStorage = new CloudStorageDataManager();

module.exports = {
  CloudStorageDataManager,
  cloudStorage
};