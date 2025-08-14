const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

class GoogleSheetsDataManager {
  constructor() {
    // Initialize Google Sheets with service account authentication
    this.spreadsheetId = process.env.GOOGLE_SHEETS_ID || null;
    this.serviceAccountAuth = null;
    this.doc = null;
    this.initialized = false;
    this.initializationPromise = null;
    
    // Sheet names for different data types
    this.sheetNames = {
      flights: 'Flights',
      passengers: 'Passengers', 
      users: 'Users',
      volunteers: 'Volunteers',
      auditLog: 'Audit Log'
    };
    
    console.log('📊 Google Sheets Data Manager initialized');
    
    if (this.spreadsheetId) {
      this.initializationPromise = this.initializeSheets();
    } else {
      console.log('⚠️  GOOGLE_SHEETS_ID not set - Google Sheets integration disabled');
    }
  }

  async createAuth() {
    // Only use GOOGLE_CREDENTIALS_JSON method
    if (process.env.GOOGLE_CREDENTIALS_JSON) {
      try {
        console.log('🔑 Using GOOGLE_CREDENTIALS_JSON authentication...');
        const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
        const auth = new JWT({
          email: credentials.client_email,
          key: credentials.private_key,
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        console.log('✅ GOOGLE_CREDENTIALS_JSON authentication successful');
        return auth;
      } catch (error) {
        console.error('❌ GOOGLE_CREDENTIALS_JSON authentication failed:', error.message);
        throw error;
      }
    }

    throw new Error('GOOGLE_CREDENTIALS_JSON environment variable is required');
  }

  async initializeSheets() {
    try {
      this.serviceAccountAuth = await this.createAuth();

      // Initialize the spreadsheet document
      this.doc = new GoogleSpreadsheet(this.spreadsheetId, this.serviceAccountAuth);
      await this.doc.loadInfo();
      
      console.log(`✅ Connected to Google Sheet: ${this.doc.title}`);
      
      // Ensure all required sheets exist
      await this.ensureSheetsExist();
      
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Google Sheets:', error.message);
      console.error('Ensure GOOGLE_CREDENTIALS_JSON environment variable is set correctly');
      this.initialized = false;
      return false;
    }
  }

  async ensureInitialized() {
    if (this.initialized) {
      return true;
    }
    
    if (this.initializationPromise) {
      await this.initializationPromise;
      return this.initialized;
    }
    
    throw new Error('Google Sheets not initialized');
  }

  async ensureSheetsExist() {
    for (const [key, sheetName] of Object.entries(this.sheetNames)) {
      try {
        // Try to get the sheet
        this.doc.sheetsByTitle[sheetName];
        console.log(`✅ Sheet "${sheetName}" exists`);
      } catch (error) {
        // Create the sheet if it doesn't exist
        console.log(`📄 Creating sheet: ${sheetName}`);
        const sheet = await this.doc.addSheet({ title: sheetName });
        
        // Set up headers based on sheet type
        await this.setupSheetHeaders(sheet, key);
      }
    }
  }

  async setupSheetHeaders(sheet, sheetType) {
    const headers = {
      flights: [
        'id', 'flightNumber', 'airline', 'from', 'to', 
        'departureDateTime', 'arrivalDateTime', 'passengerIds', 
        'pickupVolunteerName', 'pickupVolunteerPhone', 
        'dropoffVolunteerName', 'dropoffVolunteerPhone',
        'status', 'notes', 'createdAt', 'updatedAt'
      ],
      passengers: [
        'id', 'name', 'legalName', 'phone', 'telegramChatId', 
        'flightCount', 'extractedNames', 'createdAt', 'updatedAt'
      ],
      users: [
        'id', 'username', 'name', 'email', 'password', 
        'role', 'allowedAirports', 'createdAt', 'updatedAt'
      ],
      volunteers: [
        'id', 'name', 'phone', 'email', 'createdAt', 'updatedAt'
      ],
      auditLog: [
        'id', 'timestamp', 'action', 'entityType', 'entityId', 
        'userId', 'username', 'changes', 'oldData', 'newData'
      ]
    };

    if (headers[sheetType]) {
      await sheet.setHeaderRow(headers[sheetType]);
      console.log(`📝 Set headers for ${sheetType} sheet`);
    }
  }

  async getSheet(sheetType) {
    if (!this.doc) {
      const initialized = await this.initializeSheets();
      if (!initialized) throw new Error('Failed to initialize Google Sheets');
    }

    // Ensure document info is loaded
    await this.doc.loadInfo();

    const sheetName = this.sheetNames[sheetType];
    const sheet = this.doc.sheetsByTitle[sheetName];
    
    if (!sheet) {
      throw new Error(`Sheet "${sheetName}" not found`);
    }
    
    return sheet;
  }

  // Generic CRUD operations
  async readAll(sheetType) {
    try {
      await this.ensureInitialized();
      const sheet = await this.getSheet(sheetType);
      const rows = await sheet.getRows();
      
      return rows.map(row => {
        const data = {};
        sheet.headerValues.forEach(header => {
          let value = row.get(header);
          
          // Parse JSON fields
          if (['passengerIds', 'extractedNames', 'allowedAirports', 'changes', 'oldData', 'newData'].includes(header)) {
            try {
              value = value ? JSON.parse(value) : (header === 'allowedAirports' ? [] : null);
            } catch (e) {
              value = header === 'allowedAirports' ? [] : null;
            }
          }
          
          // Parse numeric fields
          if (header === 'flightCount') {
            value = parseInt(value) || 0;
          }
          
          data[header] = value;
        });
        return data;
      });
    } catch (error) {
      console.error(`Error reading ${sheetType}:`, error.message);
      return [];
    }
  }

  async writeAll(sheetType, data) {
    try {
      await this.ensureInitialized();
      const sheet = await this.getSheet(sheetType);
      
      // Clear existing data (keep headers) - clear from row 2 onwards
      if (sheet.rowCount > 1) {
        await sheet.clearRows({
          startIndex: 1, // 0-based index, so row 2 (keep headers in row 1)
          endIndex: sheet.rowCount
        });
      }
      
      // Prepare data for insertion
      const processedData = data.map(item => {
        const processedItem = { ...item };
        
        // Convert arrays and objects to JSON strings
        ['passengerIds', 'extractedNames', 'allowedAirports', 'changes', 'oldData', 'newData'].forEach(field => {
          if (processedItem[field] !== undefined) {
            processedItem[field] = JSON.stringify(processedItem[field] || []);
          }
        });
        
        return processedItem;
      });
      
      // Add rows
      if (processedData.length > 0) {
        await sheet.addRows(processedData);
      }
      
      console.log(`✅ Wrote ${data.length} records to ${sheetType} sheet`);
      return { success: true };
    } catch (error) {
      console.error(`Error writing ${sheetType}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async create(sheetType, item) {
    try {
      const sheet = await this.getSheet(sheetType);
      
      // Process the item for storage
      const processedItem = { ...item };
      ['passengerIds', 'extractedNames', 'allowedAirports', 'changes', 'oldData', 'newData'].forEach(field => {
        if (processedItem[field] !== undefined) {
          processedItem[field] = JSON.stringify(processedItem[field] || []);
        }
      });
      
      await sheet.addRow(processedItem);
      console.log(`✅ Created new ${sheetType} record: ${item.id}`);
      return { success: true };
    } catch (error) {
      console.error(`Error creating ${sheetType}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async update(sheetType, id, updates) {
    try {
      const sheet = await this.getSheet(sheetType);
      const rows = await sheet.getRows();
      
      const row = rows.find(r => r.get('id') === id);
      if (!row) {
        throw new Error(`Record with id ${id} not found in ${sheetType}`);
      }
      
      // Apply updates
      Object.keys(updates).forEach(key => {
        let value = updates[key];
        
        // Convert arrays and objects to JSON strings
        if (['passengerIds', 'extractedNames', 'allowedAirports', 'changes', 'oldData', 'newData'].includes(key)) {
          value = JSON.stringify(value || []);
        }
        
        row.set(key, value);
      });
      
      await row.save();
      console.log(`✅ Updated ${sheetType} record: ${id}`);
      return { success: true };
    } catch (error) {
      console.error(`Error updating ${sheetType}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async delete(sheetType, id) {
    try {
      const sheet = await this.getSheet(sheetType);
      const rows = await sheet.getRows();
      
      const row = rows.find(r => r.get('id') === id);
      if (!row) {
        throw new Error(`Record with id ${id} not found in ${sheetType}`);
      }
      
      await row.delete();
      console.log(`✅ Deleted ${sheetType} record: ${id}`);
      return { success: true };
    } catch (error) {
      console.error(`Error deleting ${sheetType}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  // Specific data type methods
  async readFlights() {
    return await this.readAll('flights');
  }

  async writeFlights(flights) {
    return await this.writeAll('flights', flights);
  }

  async readPassengers() {
    return await this.readAll('passengers');
  }

  async writePassengers(passengers) {
    return await this.writeAll('passengers', passengers);
  }

  async readUsers() {
    return await this.readAll('users');
  }

  async writeUsers(users) {
    return await this.writeAll('users', users);
  }

  async readVolunteers() {
    return await this.readAll('volunteers');
  }

  async writeVolunteers(volunteers) {
    return await this.writeAll('volunteers', volunteers);
  }

  async readAuditLog() {
    return await this.readAll('auditLog');
  }

  async writeAuditLog(auditLog) {
    return await this.writeAll('auditLog', auditLog);
  }

  // Health check
  async healthCheck() {
    try {
      if (!this.doc) {
        const initialized = await this.initializeSheets();
        if (!initialized) return { status: 'error', message: 'Failed to initialize' };
      }
      
      await this.doc.loadInfo();
      return { 
        status: 'healthy', 
        spreadsheetTitle: this.doc.title,
        sheetCount: this.doc.sheetCount,
        lastAccess: new Date().toISOString()
      };
    } catch (error) {
      return { 
        status: 'error', 
        message: error.message 
      };
    }
  }
}

// Create a singleton instance
const googleSheetsDataManager = new GoogleSheetsDataManager();

module.exports = {
  GoogleSheetsDataManager,
  googleSheets: googleSheetsDataManager
};