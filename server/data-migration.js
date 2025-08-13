const { readFlights, writeFlights, readPassengers } = require('./data-helpers');

/**
 * Data Migration Utility for Flight Tracker
 * Handles migration from name-based passenger references to ID-based references
 */

class DataMigration {
  /**
   * Migrate flights from name-based passenger references to ID-based references
   * @param {Array} flights - Array of flight objects
   * @param {Array} passengers - Array of passenger objects
   * @returns {Object} - Migration results
   */
  static async migrateFlightPassengerReferences(flights = null, passengers = null) {
    console.log('🔄 Starting flight passenger reference migration...');
    
    try {
      // Load data if not provided
      if (!flights) flights = await readFlights();
      if (!passengers) passengers = await readPassengers();
      
      let migratedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      const migrationLog = [];
      
      for (const flight of flights) {
        if (!flight.passengers || !Array.isArray(flight.passengers)) {
          skippedCount++;
          continue;
        }
        
        let flightModified = false;
        const newPassengers = [];
        
        for (const flightPassenger of flight.passengers) {
          try {
            // Check if already migrated (has passengerId)
            if (flightPassenger.passengerId) {
              newPassengers.push(flightPassenger);
              continue;
            }
            
            // Find matching passenger by name or legalName
            const matchedPassenger = this.findPassengerByName(
              flightPassenger.name, 
              passengers
            );
            
            if (matchedPassenger) {
              // Create new passenger reference structure
              const newPassengerRef = {
                passengerId: matchedPassenger.id,
                // Preserve any flight-specific data
                ...(flightPassenger.seatNumber && { seatNumber: flightPassenger.seatNumber }),
                ...(flightPassenger.notes && { notes: flightPassenger.notes })
              };
              
              newPassengers.push(newPassengerRef);
              flightModified = true;
              
              migrationLog.push({
                flightId: flight.id,
                flightNumber: flight.flightNumber,
                oldName: flightPassenger.name,
                newPassengerId: matchedPassenger.id,
                passengerName: matchedPassenger.name,
                matched: true
              });
            } else {
              // Keep original structure if no match found
              newPassengers.push(flightPassenger);
              
              migrationLog.push({
                flightId: flight.id,
                flightNumber: flight.flightNumber,
                oldName: flightPassenger.name,
                matched: false,
                reason: 'No matching passenger found'
              });
            }
          } catch (error) {
            console.error(`Error migrating passenger in flight ${flight.id}:`, error);
            newPassengers.push(flightPassenger); // Keep original on error
            errorCount++;
          }
        }
        
        if (flightModified) {
          flight.passengers = newPassengers;
          migratedCount++;
        } else {
          skippedCount++;
        }
      }
      
      console.log(`✅ Migration completed: ${migratedCount} flights migrated, ${skippedCount} skipped, ${errorCount} errors`);
      
      return {
        success: true,
        migratedFlights: migratedCount,
        skippedFlights: skippedCount,
        errors: errorCount,
        migrationLog,
        flights: flights
      };
      
    } catch (error) {
      console.error('❌ Migration failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Find passenger by name or legal name
   * Uses both display name and legal name for matching
   */
  static findPassengerByName(searchName, passengers) {
    if (!searchName || !passengers) return null;
    
    const searchLower = searchName.toLowerCase().trim();
    
    // Try exact match on name first
    let match = passengers.find(p => 
      p.name && p.name.toLowerCase().trim() === searchLower
    );
    
    if (match) return match;
    
    // Try exact match on legal name
    match = passengers.find(p => 
      p.legalName && p.legalName.toLowerCase().trim() === searchLower
    );
    
    if (match) return match;
    
    // Try partial matching for flexibility
    match = passengers.find(p => {
      const name = p.name?.toLowerCase().trim() || '';
      const legalName = p.legalName?.toLowerCase().trim() || '';
      
      // Check if search name contains passenger name or vice versa
      return name.includes(searchLower) || 
             searchLower.includes(name) ||
             legalName.includes(searchLower) || 
             searchLower.includes(legalName);
    });
    
    return match || null;
  }
  
  /**
   * Run migration and save to file
   */
  static async runMigration() {
    console.log('🚀 Running flight passenger migration...');
    
    const result = await this.migrateFlightPassengerReferences();
    
    if (result.success && result.migratedFlights > 0) {
      // Save migrated flights
      await writeFlights(result.flights);
      console.log('💾 Migrated flights saved to file');
      
      // Log migration details
      console.log('\n📋 Migration Summary:');
      console.log(`✅ Successfully migrated: ${result.migratedFlights} flights`);
      console.log(`⏭️  Skipped (already migrated): ${result.skippedFlights} flights`);
      console.log(`❌ Errors encountered: ${result.errors}`);
      
      if (result.migrationLog.length > 0) {
        console.log('\n📝 Migration Details:');
        result.migrationLog.forEach(log => {
          if (log.matched) {
            console.log(`  ✅ ${log.flightNumber}: "${log.oldName}" → ID: ${log.newPassengerId} (${log.passengerName})`);
          } else {
            console.log(`  ❌ ${log.flightNumber}: "${log.oldName}" - ${log.reason}`);
          }
        });
      }
    }
    
    return result;
  }
}

module.exports = DataMigration;