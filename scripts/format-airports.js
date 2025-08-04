const fs = require('fs');
const path = require('path');

/**
 * Script to reformat existing airport data to the new format:
 * Code, City, State, Country
 */

class AirportFormatter {
  constructor() {
    this.airports = [];
  }

  /**
   * Read existing airport data and reformat
   */
  async formatAirports() {
    try {
      console.log('📄 Reading existing airport data...');
      
      const airportsPath = path.join(__dirname, '..', 'server', 'data', 'airports.json');
      const data = await fs.promises.readFile(airportsPath, 'utf8');
      const currentAirports = JSON.parse(data);
      
      console.log(`✅ Found ${currentAirports.length} airports in existing data`);
      
      // Transform to new format
      this.airports = currentAirports.map(airport => {
        const state = airport.state || null;
        const stateDisplay = state ? `, ${state}` : '';
        
        return {
          code: airport.code,
          name: airport.name,
          display: `${airport.code}, ${airport.city}${stateDisplay}, ${airport.country}`,
          city: airport.city,
          state: state,
          country: airport.country,
          timezone: airport.timezone,
          lat: airport.lat,
          lon: airport.lon,
          type: airport.type || 'airport'
        };
      });
      
      // Sort by display name for better UX
      this.airports.sort((a, b) => a.display.localeCompare(b.display));
      
      console.log(`✅ Formatted ${this.airports.length} airports with new display format`);
      return this.airports;

    } catch (error) {
      console.error('❌ Error reading airport data:', error);
      throw error;
    }
  }

  /**
   * Save formatted airports
   */
  async saveFormattedAirports() {
    try {
      // Create backup first
      const airportsPath = path.join(__dirname, '..', 'server', 'data', 'airports.json');
      const backupPath = path.join(__dirname, '..', 'server', 'data', 'airports-original-backup.json');
      
      await fs.promises.copyFile(airportsPath, backupPath);
      console.log('📋 Created backup: airports-original-backup.json');
      
      // Save new format
      await fs.promises.writeFile(
        airportsPath,
        JSON.stringify(this.airports, null, 2),
        'utf8'
      );
      
      console.log(`✅ Saved ${this.airports.length} airports with new format to airports.json`);
      
      return airportsPath;

    } catch (error) {
      console.error('❌ Error saving formatted airports:', error);
      throw error;
    }
  }

  /**
   * Display sample of new format
   */
  displaySamples() {
    console.log('\n📝 Sample of new airport format:');
    console.log('Format: CODE, City, State, Country');
    console.log('─'.repeat(50));
    
    this.airports.slice(0, 10).forEach(airport => {
      console.log(`${airport.code.padEnd(4)} → ${airport.display}`);
    });
    
    console.log('─'.repeat(50));
    console.log(`... and ${this.airports.length - 10} more airports`);
  }

  /**
   * Display statistics
   */
  displayStats() {
    const countryStats = {};
    const stateStats = {};
    
    this.airports.forEach(airport => {
      countryStats[airport.country] = (countryStats[airport.country] || 0) + 1;
      
      if (airport.state) {
        const key = `${airport.country} - ${airport.state}`;
        stateStats[key] = (stateStats[key] || 0) + 1;
      }
    });

    console.log('\n📊 Airport Statistics by Country:');
    Object.entries(countryStats)
      .sort(([,a], [,b]) => b - a)
      .forEach(([country, count]) => {
        console.log(`   ${country}: ${count} airports`);
      });

    console.log('\n📊 Top States/Provinces by Airport Count:');
    Object.entries(stateStats)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .forEach(([state, count]) => {
        console.log(`   ${state}: ${count} airports`);
      });
  }
}

// Main execution
async function main() {
  try {
    console.log('🚀 Starting airport format conversion...');
    console.log('📝 Converting to: CODE, City, State, Country format\n');

    const formatter = new AirportFormatter();
    
    await formatter.formatAirports();
    formatter.displaySamples();
    formatter.displayStats();
    
    const outputFile = await formatter.saveFormattedAirports();
    
    console.log('\n✅ Airport format conversion completed successfully!');
    console.log(`📄 Updated file: ${outputFile}`);
    console.log('📋 Original backed up as: airports-original-backup.json');
    console.log('\n💡 Next steps:');
    console.log('   1. Update FlightInfoService to use new format');
    console.log('   2. Update Add Flight page dropdowns');
    console.log('   3. Test flight auto-population with new format');

  } catch (error) {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = AirportFormatter;