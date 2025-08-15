const { Storage } = require('@google-cloud/storage');

class CloudStorageDataManager {
  constructor() {
    // Initialize Google Cloud Storage with custom service account if provided
    const storageOptions = {};
    
    // If service account key is provided via environment variable
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      try {
        const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
        storageOptions.credentials = credentials;
        console.log('📋 Using custom service account from GOOGLE_APPLICATION_CREDENTIALS_JSON');
      } catch (error) {
        console.warn('⚠️  Invalid GOOGLE_APPLICATION_CREDENTIALS_JSON, falling back to default authentication');
      }
    }
    
    this.storage = new Storage(storageOptions);
    
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
      airlines: 'data/airlines.json',
      audit_log: 'data/audit_log.json',
      registrationStates: 'data/registration-states.json',
      processedMessages: 'data/processed-messages.json'
    };
    
    // Initialize bucket and data structures on startup
    this.initializeStorage();
  }

  async initializeStorage() {
    try {
      await this.initializeBucket();
      // Only initialize empty data if bucket was successfully initialized
      await this.initializeEmptyData();
    } catch (error) {
      console.error('❌ Failed to initialize Cloud Storage:', error.message);
      console.log('📂 Falling back to local file storage mode');
    }
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
        console.log(`✅ Data bucket ready: ${this.bucketName}`);
      }
      
      // Test bucket access
      await bucket.getMetadata();
      console.log('✅ Cloud Storage bucket access confirmed');
      return true;
    } catch (error) {
      console.error('❌ Error initializing data bucket:', error.message);
      throw error; // Don't fall back, let the application handle the error
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

  // Airline operations
  async readAirlines() {
    const data = await this.readFromStorage(this.files.airlines);
    return data || [];
  }

  async writeAirlines(airlines) {
    await this.writeToStorage(this.files.airlines, airlines);
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

  // Initialize empty data structures in Cloud Storage (only if they don't exist)
  async initializeEmptyData() {
    console.log('🚀 Initializing empty data structures in Cloud Storage...');
    
    const emptyDataStructures = {
      flights: [],
      users: [],
      passengers: [],
      volunteers: [],
      audit_log: [],
      registrationStates: {},
      processedMessages: []
    };

    let initialized = 0;
    for (const [name, emptyData] of Object.entries(emptyDataStructures)) {
      try {
        // Check if file already exists
        const existingData = await this.readFromStorage(this.files[name]);
        if (existingData === null) {
          // File doesn't exist, create it with empty structure
          await this.writeToStorage(this.files[name], emptyData);
          console.log(`✅ Initialized ${name}: empty ${Array.isArray(emptyData) ? 'array' : 'object'}`);
          initialized++;
        } else {
          console.log(`ℹ️  ${name} already exists in Cloud Storage (${Array.isArray(existingData) ? existingData.length : 'object'} items)`);
        }
      } catch (error) {
        console.error(`❌ Error initializing ${name}:`, error.message);
      }
    }

    // Initialize airports data (only if it doesn't exist)
    try {
      const existingAirports = await this.readFromStorage(this.files.airports);
      if (existingAirports === null) {
        // Create empty array since we removed local files
        await this.writeToStorage(this.files.airports, []);
        console.log('✅ Initialized airports: empty array');
        initialized++;
      } else {
        console.log(`ℹ️  Airports already exist in Cloud Storage (${existingAirports.length} airports)`);
      }
    } catch (error) {
      console.warn('⚠️  Could not initialize airports data:', error.message);
    }

    // Initialize airlines data (only if it doesn't exist)
    try {
      const existingAirlines = await this.readFromStorage(this.files.airlines);
      if (existingAirlines === null) {
        // Create empty array since we removed local files
        await this.writeToStorage(this.files.airlines, []);
        console.log('✅ Initialized airlines: empty array');
        initialized++;
      } else {
        console.log(`ℹ️  Airlines already exist in Cloud Storage (${existingAirlines.length} airlines)`);
      }
    } catch (error) {
      console.warn('⚠️  Could not initialize airlines data:', error.message);
    }
    
    if (initialized > 0) {
      console.log(`🎉 Initialization complete: ${initialized} new data structures created`);
    } else {
      console.log('✅ All data structures already exist in Cloud Storage - no initialization needed');
    }
    
    return initialized;
  }
}

// Create singleton instance
const cloudStorage = new CloudStorageDataManager();

module.exports = {
  CloudStorageDataManager,
  cloudStorage
};