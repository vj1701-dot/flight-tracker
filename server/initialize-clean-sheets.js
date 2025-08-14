const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

/**
 * Initialize clean Google Sheets with only sheet names, no predefined columns or data
 * This creates a completely fresh start with empty sheets
 */
class CleanSheetsInitializer {
  constructor() {
    this.spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    if (!this.spreadsheetId) {
      throw new Error('GOOGLE_SHEETS_ID environment variable is required');
    }
    
    this.sheetNames = [
      'Flights',
      'Passengers', 
      'Users',
      'Volunteers',
      'Audit Log'
    ];
  }

  async createAuth() {
    if (!process.env.GOOGLE_CREDENTIALS_JSON) {
      throw new Error('GOOGLE_CREDENTIALS_JSON environment variable is required');
    }

    try {
      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
      const auth = new JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      return auth;
    } catch (error) {
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  async initializeCleanSheets() {
    try {
      console.log('🧹 Starting clean Google Sheets initialization...');
      
      const auth = await this.createAuth();
      const doc = new GoogleSpreadsheet(this.spreadsheetId, auth);
      
      await doc.loadInfo();
      console.log(`📊 Connected to Google Sheet: "${doc.title}"`);
      
      // Get existing sheets
      const existingSheets = Object.keys(doc.sheetsByTitle);
      console.log(`📋 Found ${existingSheets.length} existing sheets:`, existingSheets);
      
      // Delete all existing sheets except the first one (we'll rename it)
      const sheetsToDelete = Object.values(doc.sheetsByTitle);
      if (sheetsToDelete.length > 1) {
        console.log('🗑️ Deleting existing sheets...');
        for (let i = 1; i < sheetsToDelete.length; i++) {
          await sheetsToDelete[i].delete();
          console.log(`   ❌ Deleted: ${sheetsToDelete[i].title}`);
        }
      }
      
      // Clear and rename the first sheet
      const firstSheet = sheetsToDelete[0];
      if (firstSheet) {
        await firstSheet.clear();
        await firstSheet.updateProperties({ title: this.sheetNames[0] });
        console.log(`   ✅ Cleaned and renamed to: ${this.sheetNames[0]}`);
      }
      
      // Create remaining sheets (completely empty, no headers)
      for (let i = 1; i < this.sheetNames.length; i++) {
        const sheetName = this.sheetNames[i];
        await doc.addSheet({ title: sheetName });
        console.log(`   ✅ Created clean sheet: ${sheetName}`);
      }
      
      console.log('🎉 Clean Google Sheets initialization completed successfully!');
      console.log(`📋 Created ${this.sheetNames.length} clean sheets:`);
      this.sheetNames.forEach((name, index) => {
        console.log(`   ${index + 1}. ${name}`);
      });
      
      console.log('');
      console.log('ℹ️  All sheets are completely empty - no columns or headers have been added.');
      console.log('ℹ️  The application will automatically add headers when data is first written.');
      
      return {
        success: true,
        spreadsheetTitle: doc.title,
        sheetsCreated: this.sheetNames
      };
      
    } catch (error) {
      console.error('❌ Clean sheets initialization failed:', error.message);
      throw error;
    }
  }
}

// Run the initialization if this script is called directly
if (require.main === module) {
  const initializer = new CleanSheetsInitializer();
  
  initializer.initializeCleanSheets()
    .then((result) => {
      console.log('✅ Clean sheets setup completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Clean sheets setup failed:', error.message);
      process.exit(1);
    });
}

module.exports = CleanSheetsInitializer;