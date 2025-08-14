const { google } = require('googleapis');
const path = require('path');

class GoogleDriveStorage {
  constructor() {
    this.folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    this.backupFolderId = null;
    this.drive = null;
    this.initialized = false;
    
    if (!this.folderId) {
      console.log('⚠️  GOOGLE_DRIVE_FOLDER_ID not set. Google Drive storage will be disabled.');
      return;
    }

    this.init();
  }

  async init() {
    try {
      // Use Google Cloud default credentials (service account on Cloud Run)
      const auth = new google.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/drive']
      });
      
      const authClient = await auth.getClient();
      this.drive = google.drive({ version: 'v3', auth: authClient });
      
      // Initialize backup folder
      await this.ensureBackupFolder();
      
      this.initialized = true;
      console.log('✅ GOOGLE_DRIVE: Initialized successfully');
    } catch (error) {
      console.error('❌ GOOGLE_DRIVE: Initialization failed:', error.message);
    }
  }

  async ensureBackupFolder() {
    try {
      // Check if backup folder exists
      const response = await this.drive.files.list({
        q: `name='backup' and parents in '${this.folderId}' and mimeType='application/vnd.google-apps.folder'`,
        fields: 'files(id, name)'
      });

      if (response.data.files.length > 0) {
        this.backupFolderId = response.data.files[0].id;
        console.log('📁 GOOGLE_DRIVE: Found existing backup folder');
      } else {
        // Create backup folder
        const folderResponse = await this.drive.files.create({
          requestBody: {
            name: 'backup',
            mimeType: 'application/vnd.google-apps.folder',
            parents: [this.folderId]
          }
        });
        this.backupFolderId = folderResponse.data.id;
        console.log('📁 GOOGLE_DRIVE: Created backup folder');
      }
    } catch (error) {
      console.error('❌ GOOGLE_DRIVE: Error setting up backup folder:', error.message);
      throw error;
    }
  }

  isAvailable() {
    return this.initialized && this.drive && this.folderId;
  }

  async readFile(fileName) {
    if (!this.isAvailable()) {
      throw new Error('Google Drive storage not available');
    }

    try {
      // Find the file in the main folder
      const response = await this.drive.files.list({
        q: `name='${fileName}' and parents in '${this.folderId}'`,
        fields: 'files(id, name)'
      });

      if (response.data.files.length === 0) {
        // File not found, return empty array
        console.log(`📄 GOOGLE_DRIVE: File ${fileName} not found, returning empty array`);
        return [];
      }

      const fileId = response.data.files[0].id;
      
      // Download file content
      const fileResponse = await this.drive.files.get({
        fileId: fileId,
        alt: 'media'
      });

      const content = fileResponse.data;
      return JSON.parse(content);
    } catch (error) {
      console.error(`❌ GOOGLE_DRIVE: Error reading ${fileName}:`, error.message);
      if (error.message.includes('Unexpected token') || error.message.includes('JSON')) {
        console.log(`📄 GOOGLE_DRIVE: File ${fileName} contains invalid JSON, returning empty array`);
        return [];
      }
      throw error;
    }
  }

  async writeFile(fileName, data) {
    if (!this.isAvailable()) {
      throw new Error('Google Drive storage not available');
    }

    try {
      const content = JSON.stringify(data, null, 2);
      
      // Check if file exists
      const response = await this.drive.files.list({
        q: `name='${fileName}' and parents in '${this.folderId}'`,
        fields: 'files(id, name)'
      });

      if (response.data.files.length > 0) {
        // Update existing file
        const fileId = response.data.files[0].id;
        
        // Create backup first
        await this.createBackup(fileName, fileId);
        
        // Update the file
        await this.drive.files.update({
          fileId: fileId,
          media: {
            mimeType: 'application/json',
            body: content
          }
        });
        
        console.log(`✅ GOOGLE_DRIVE: Updated ${fileName}`);
      } else {
        // Create new file
        await this.drive.files.create({
          requestBody: {
            name: fileName,
            parents: [this.folderId]
          },
          media: {
            mimeType: 'application/json',
            body: content
          }
        });
        
        console.log(`✅ GOOGLE_DRIVE: Created ${fileName}`);
      }
    } catch (error) {
      console.error(`❌ GOOGLE_DRIVE: Error writing ${fileName}:`, error.message);
      throw error;
    }
  }

  async createBackup(fileName, fileId) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = `${fileName.replace('.json', '')}_${timestamp}.json`;
      
      // Copy the file to backup folder
      await this.drive.files.copy({
        fileId: fileId,
        requestBody: {
          name: backupName,
          parents: [this.backupFolderId]
        }
      });
      
      console.log(`💾 GOOGLE_DRIVE: Created backup ${backupName}`);
    } catch (error) {
      console.error(`❌ GOOGLE_DRIVE: Error creating backup for ${fileName}:`, error.message);
      // Don't throw - backup failure shouldn't stop the main operation
    }
  }

  async listBackups() {
    if (!this.isAvailable()) {
      throw new Error('Google Drive storage not available');
    }

    try {
      const response = await this.drive.files.list({
        q: `parents in '${this.backupFolderId}'`,
        fields: 'files(id, name, createdTime, size)',
        orderBy: 'createdTime desc'
      });

      return response.data.files.map(file => ({
        id: file.id,
        name: file.name,
        createdTime: file.createdTime,
        size: file.size
      }));
    } catch (error) {
      console.error('❌ GOOGLE_DRIVE: Error listing backups:', error.message);
      throw error;
    }
  }

  async restoreBackup(backupId, originalFileName) {
    if (!this.isAvailable()) {
      throw new Error('Google Drive storage not available');
    }

    try {
      // Get backup file content
      const fileResponse = await this.drive.files.get({
        fileId: backupId,
        alt: 'media'
      });

      const backupData = JSON.parse(fileResponse.data);
      
      // Write it back as the original file
      await this.writeFile(originalFileName, backupData);
      
      console.log(`🔄 GOOGLE_DRIVE: Restored ${originalFileName} from backup`);
      return true;
    } catch (error) {
      console.error(`❌ GOOGLE_DRIVE: Error restoring backup:`, error.message);
      throw error;
    }
  }

  async deleteBackup(backupId) {
    if (!this.isAvailable()) {
      throw new Error('Google Drive storage not available');
    }

    try {
      await this.drive.files.delete({
        fileId: backupId
      });
      
      console.log(`🗑️ GOOGLE_DRIVE: Deleted backup ${backupId}`);
      return true;
    } catch (error) {
      console.error(`❌ GOOGLE_DRIVE: Error deleting backup:`, error.message);
      throw error;
    }
  }
}

// Create singleton instance
const driveStorage = new GoogleDriveStorage();

// Data access functions (same interface as original data-helpers.js)
async function readFlights() {
  return await driveStorage.readFile('flights.json');
}

async function writeFlights(flights) {
  await driveStorage.writeFile('flights.json', flights);
}

async function readUsers() {
  return await driveStorage.readFile('users.json');
}

async function writeUsers(users) {
  await driveStorage.writeFile('users.json', users);
}

async function readPassengers() {
  return await driveStorage.readFile('passengers.json');
}

async function writePassengers(passengers) {
  await driveStorage.writeFile('passengers.json', passengers);
}

async function readVolunteers() {
  return await driveStorage.readFile('volunteers.json');
}

async function writeVolunteers(volunteers) {
  await driveStorage.writeFile('volunteers.json', volunteers);
}

/**
 * Resolve passenger names from passenger IDs for flight display
 * @param {Array} flightPassengers - Array of passenger objects with passengerId
 * @param {Array} passengers - Array of all passengers (optional, will load if not provided)
 * @returns {Array} - Array of passenger objects with resolved names
 */
async function resolveFlightPassengerNames(flightPassengers, passengers = null) {
  if (!flightPassengers || !Array.isArray(flightPassengers)) {
    return [];
  }
  
  // Load passengers if not provided
  if (!passengers) {
    passengers = await readPassengers();
  }
  
  return flightPassengers.map(flightPassenger => {
    // If it's already the old format (has name directly), return as is
    if (flightPassenger.name && !flightPassenger.passengerId) {
      return flightPassenger;
    }
    
    // If it's new format (has passengerId), resolve the name
    if (flightPassenger.passengerId) {
      const passenger = passengers.find(p => p.id === flightPassenger.passengerId);
      if (passenger) {
        return {
          ...flightPassenger,
          id: flightPassenger.passengerId, // For compatibility
          name: passenger.name,
          legalName: passenger.legalName
        };
      } else {
        // Passenger not found, show as unknown
        return {
          ...flightPassenger,
          id: flightPassenger.passengerId,
          name: 'Unknown Passenger',
          legalName: 'Unknown'
        };
      }
    }
    
    // Fallback - return as is
    return flightPassenger;
  });
}

/**
 * Get flights with resolved passenger names for display
 * @param {Array} flights - Array of flight objects (optional, will load if not provided)
 * @returns {Array} - Array of flights with resolved passenger names
 */
async function getFlightsWithResolvedNames(flights = null) {
  if (!flights) {
    flights = await readFlights();
  }
  
  const passengers = await readPassengers();
  
  // Resolve passenger names for each flight
  const resolvedFlights = await Promise.all(
    flights.map(async (flight) => {
      if (flight.passengers) {
        const resolvedPassengers = await resolveFlightPassengerNames(flight.passengers, passengers);
        return {
          ...flight,
          passengers: resolvedPassengers
        };
      }
      return flight;
    })
  );
  
  return resolvedFlights;
}

// Use the existing sophisticated fuzzy matching from flight-processing-service
let fuzzy;
try {
  fuzzy = require('fuzzyset');
} catch (e) {
  console.warn('⚠️  DATA_HELPERS: fuzzyset not installed. Fuzzy matching will be disabled.');
}

/**
 * Normalize name for consistent matching
 */
function normalizeNameForMatching(name) {
  return name?.toLowerCase()
    .replace(/[^\w\s]/g, ' ')  // Replace non-alphanumeric with spaces
    .replace(/\s+/g, ' ')       // Collapse multiple spaces
    .trim() || '';
}

/**
 * Find passenger by name or legal name with advanced fuzzy matching
 * Uses the same sophisticated algorithm as flight-processing-service
 * @param {string} searchName - Name to search for
 * @param {Array} passengers - Array of passengers (optional, will load if not provided)
 * @returns {Object|null} - Found passenger or null
 */
async function findPassengerByName(searchName, passengers = null) {
  if (!searchName) return null;
  
  if (!passengers) {
    passengers = await readPassengers();
  }
  
  const searchLower = searchName.toLowerCase().trim();
  const normalizedSearch = normalizeNameForMatching(searchName);
  
  // 1. Try exact match on name first (highest priority)
  let match = passengers.find(p => 
    p.name && p.name.toLowerCase().trim() === searchLower
  );
  
  if (match) return match;
  
  // 2. Try exact match on legal name
  match = passengers.find(p => 
    p.legalName && p.legalName.toLowerCase().trim() === searchLower
  );
  
  if (match) return match;
  
  // 3. Try partial matching for substrings
  match = passengers.find(p => {
    const name = p.name?.toLowerCase().trim() || '';
    const legalName = p.legalName?.toLowerCase().trim() || '';
    
    return name.includes(searchLower) || 
           searchLower.includes(name) ||
           legalName.includes(searchLower) || 
           searchLower.includes(legalName);
  });
  
  if (match) return match;
  
  // 4. Advanced fuzzy matching (same as flight-processing-service)
  if (fuzzy && passengers.length > 0) {
    // Create fuzzy sets for legal names and display names
    const legalNames = passengers.filter(p => p.legalName).map(p => normalizeNameForMatching(p.legalName));
    const displayNames = passengers.map(p => normalizeNameForMatching(p.name));
    
    if (legalNames.length > 0) {
      const legalFuzzySet = fuzzy(legalNames);
      const legalMatches = legalFuzzySet.get(normalizedSearch);
      
      if (legalMatches && legalMatches.length > 0 && legalMatches[0][0] > 0.6) {
        const matchedLegalName = legalMatches[0][1];
        const passenger = passengers.find(p => normalizeNameForMatching(p.legalName) === matchedLegalName);
        if (passenger) {
          console.log(`🔍 Fuzzy legal name match: "${searchName}" → "${passenger.name}" (${legalMatches[0][0].toFixed(2)})`);
          return passenger;
        }
      }
    }
    
    if (displayNames.length > 0) {
      const displayFuzzySet = fuzzy(displayNames);
      const displayMatches = displayFuzzySet.get(normalizedSearch);
      
      if (displayMatches && displayMatches.length > 0 && displayMatches[0][0] > 0.6) {
        const matchedDisplayName = displayMatches[0][1];
        const passenger = passengers.find(p => normalizeNameForMatching(p.name) === matchedDisplayName);
        if (passenger) {
          console.log(`🔍 Fuzzy display name match: "${searchName}" → "${passenger.name}" (${displayMatches[0][0].toFixed(2)})`);
          return passenger;
        }
      }
    }
  }
  
  return null;
}

// Backup management functions
async function listBackups() {
  return await driveStorage.listBackups();
}

async function restoreBackup(backupId, originalFileName) {
  return await driveStorage.restoreBackup(backupId, originalFileName);
}

async function deleteBackup(backupId) {
  return await driveStorage.deleteBackup(backupId);
}

module.exports = {
  readFlights,
  writeFlights,
  readUsers,
  writeUsers,
  readPassengers,
  writePassengers,
  readVolunteers,
  writeVolunteers,
  resolveFlightPassengerNames,
  getFlightsWithResolvedNames,
  findPassengerByName,
  listBackups,
  restoreBackup,
  deleteBackup,
  driveStorage // Export the storage instance for advanced operations
};