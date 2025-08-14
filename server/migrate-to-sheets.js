/**
 * Migration script to transfer data from Cloud Storage to Google Sheets
 * Run this script once to migrate your existing data
 */

const { cloudStorage } = require('./cloud-storage-helpers');
const { googleSheets } = require('./google-sheets-helpers');

async function migrateToGoogleSheets() {
  console.log('🚀 Starting migration from Cloud Storage to Google Sheets...');
  
  try {
    // Check Google Sheets connectivity
    const healthCheck = await googleSheets.healthCheck();
    if (healthCheck.status !== 'healthy') {
      throw new Error(`Google Sheets not accessible: ${healthCheck.message}`);
    }
    
    console.log(`✅ Connected to Google Sheet: ${healthCheck.spreadsheetTitle}`);
    
    // Read all data from Cloud Storage
    console.log('📥 Reading data from Cloud Storage...');
    const [flights, passengers, users, volunteers, auditLog] = await Promise.all([
      cloudStorage.readFlights(),
      cloudStorage.readPassengers(), 
      cloudStorage.readUsers(),
      cloudStorage.readVolunteers(),
      cloudStorage.readAuditLog()
    ]);
    
    console.log(`📊 Data summary:`);
    console.log(`   • ${flights.length} flights`);
    console.log(`   • ${passengers.length} passengers`);
    console.log(`   • ${users.length} users`);
    console.log(`   • ${volunteers.length} volunteers`);
    console.log(`   • ${auditLog.length} audit log entries`);
    
    // Migrate each data type to Google Sheets
    console.log('📤 Migrating to Google Sheets...');
    
    const migrationResults = await Promise.allSettled([
      googleSheets.writeFlights(flights),
      googleSheets.writePassengers(passengers),
      googleSheets.writeUsers(users),
      googleSheets.writeVolunteers(volunteers),
      googleSheets.writeAuditLog(auditLog)
    ]);
    
    // Report results
    const dataTypes = ['flights', 'passengers', 'users', 'volunteers', 'auditLog'];
    migrationResults.forEach((result, index) => {
      const dataType = dataTypes[index];
      if (result.status === 'fulfilled' && result.value.success) {
        console.log(`✅ ${dataType} migrated successfully`);
      } else {
        console.error(`❌ ${dataType} migration failed:`, result.reason || result.value.error);
      }
    });
    
    const successCount = migrationResults.filter(r => r.status === 'fulfilled' && r.value.success).length;
    
    if (successCount === migrationResults.length) {
      console.log('\n🎉 Migration completed successfully!');
      console.log('✅ All data has been transferred to Google Sheets');
      console.log('💡 You can now update your application to use Google Sheets as the primary data store');
      console.log('🗑️  Cloud Storage data can be safely archived after verification');
      
      return { success: true, migratedDataTypes: successCount };
    } else {
      console.log(`\n⚠️  Migration partially completed: ${successCount}/${migrationResults.length} data types migrated`);
      return { success: false, migratedDataTypes: successCount, totalDataTypes: migrationResults.length };
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nPlease check:');
    console.error('1. GOOGLE_SHEETS_ID environment variable is set');
    console.error('2. GOOGLE_SHEETS_CLIENT_EMAIL environment variable is set');
    console.error('3. GOOGLE_SHEETS_PRIVATE_KEY environment variable is set');
    console.error('4. Service account has edit access to the Google Sheet');
    console.error('5. Google Sheets API is enabled in your Google Cloud project');
    
    return { success: false, error: error.message };
  }
}

// Function to create a new Google Sheet with proper setup
async function createNewSpreadsheet() {
  console.log('📊 Creating new Google Spreadsheet for Flight Tracker...');
  
  try {
    // This would require OAuth2 authentication to create sheets
    // For now, we'll provide instructions for manual creation
    console.log('\n📋 To create a new Google Sheet for your Flight Tracker:');
    console.log('1. Go to https://sheets.google.com');
    console.log('2. Create a new spreadsheet');
    console.log('3. Name it "Flight Tracker Database"');
    console.log('4. Copy the spreadsheet ID from the URL (between /d/ and /edit)');
    console.log('5. Share the sheet with your service account email with Editor permissions');
    console.log('6. Set the GOOGLE_SHEETS_ID environment variable to the spreadsheet ID');
    console.log('\nExample URL: https://docs.google.com/spreadsheets/d/1ABC123-DEF456/edit');
    console.log('Spreadsheet ID: 1ABC123-DEF456');
    
  } catch (error) {
    console.error('Error providing setup instructions:', error.message);
  }
}

// Test function to verify Google Sheets setup
async function testGoogleSheetsSetup() {
  console.log('🧪 Testing Google Sheets setup...');
  
  try {
    const healthCheck = await googleSheets.healthCheck();
    
    if (healthCheck.status === 'healthy') {
      console.log('✅ Google Sheets setup is working!');
      console.log(`📊 Spreadsheet: ${healthCheck.spreadsheetTitle}`);
      console.log(`📄 Sheets: ${healthCheck.sheetCount}`);
      
      // Test write/read operations
      const testData = [{
        id: 'test-123',
        name: 'Test User',
        email: 'test@example.com',
        createdAt: new Date().toISOString()
      }];
      
      console.log('🧪 Testing write operation...');
      const writeResult = await googleSheets.writeUsers(testData);
      
      if (writeResult.success) {
        console.log('✅ Write test successful');
        
        console.log('🧪 Testing read operation...');
        const readResult = await googleSheets.readUsers();
        
        if (readResult.length > 0) {
          console.log('✅ Read test successful');
          console.log('🎉 Google Sheets integration is fully functional!');
          return true;
        } else {
          console.log('❌ Read test failed - no data returned');
          return false;
        }
      } else {
        console.log('❌ Write test failed:', writeResult.error);
        return false;
      }
      
    } else {
      console.log('❌ Google Sheets health check failed:', healthCheck.message);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Google Sheets test failed:', error.message);
    return false;
  }
}

// Export functions for use
module.exports = {
  migrateToGoogleSheets,
  createNewSpreadsheet,
  testGoogleSheetsSetup
};

// If run directly, execute migration
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--test')) {
    testGoogleSheetsSetup();
  } else if (args.includes('--setup')) {
    createNewSpreadsheet();
  } else {
    migrateToGoogleSheets();
  }
}