const fs = require('fs');
const path = require('path');

/**
 * Script to fetch ALL airports from FlightAware AeroAPI
 * Then filter for USA and Canada airports
 */

const FLIGHTAWARE_API_KEY = process.env.FLIGHTAWARE_API_KEY || '7kV9GnO2seq9fMY0p1pgQM800BLoRPX6';
const BASE_URL = 'https://aeroapi.flightaware.com/aeroapi';

class AirportFetcher {
  constructor() {
    this.allAirports = [];
    this.filteredAirports = [];
  }

  /**
   * Fetch ALL airports from FlightAware AeroAPI using the /airports endpoint
   */
  async fetchAllAirports() {
    try {
      console.log('🌍 Fetching ALL airports from FlightAware AeroAPI...');
      console.log('📡 Using /airports endpoint for comprehensive data\n');
      
      let hasMore = true;
      let cursor = null;
      let pageCount = 0;
      const maxPages = 50; // Safety limit
      
      while (hasMore && pageCount < maxPages) {
        pageCount++;
        console.log(`📄 Fetching page ${pageCount}...`);
        
        // Build URL with pagination
        let url = `${BASE_URL}/airports?max_pages=1`;
        if (cursor) {
          url += `&cursor=${encodeURIComponent(cursor)}`;
        }
        
        const response = await fetch(url, {
          headers: {
            'x-apikey': FLIGHTAWARE_API_KEY,
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        if (data.airports && Array.isArray(data.airports)) {
          console.log(`   ✅ Found ${data.airports.length} airports on page ${pageCount}`);
          
          // Process each airport - get detailed info
          for (const airport of data.airports) {
            if (airport.code) {
              await this.fetchAirportDetails(airport.code);
              await this.delay(200); // Small delay to be respectful
            }
          }
        }
        
        // Check if there are more pages
        hasMore = data.links && data.links.next;
        cursor = hasMore ? this.extractCursor(data.links.next) : null;
        
        if (hasMore) {
          console.log(`   📄 More pages available, continuing...`);
          await this.delay(1000); // Delay between pages
        }
      }
      
      console.log(`\n✅ Total airports processed: ${this.allAirports.length}`);
      return this.allAirports;

    } catch (error) {
      console.error('❌ Error fetching airports:', error);
      throw error;
    }
  }

  /**
   * Extract cursor from next link URL
   */
  extractCursor(nextUrl) {
    try {
      const url = new URL(nextUrl);
      return url.searchParams.get('cursor');
    } catch (error) {
      console.warn('⚠️ Could not extract cursor from next URL');
      return null;
    }
  }

  /**
   * Fetch detailed information for a specific airport
   */
  async fetchAirportDetails(code) {
    try {
      const response = await fetch(`${BASE_URL}/airports/${code}`, {
        headers: {
          'x-apikey': FLIGHTAWARE_API_KEY,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status !== 404) {
          console.warn(`⚠️ Could not fetch details for ${code}: ${response.status}`);
        }
        return;
      }

      const airport = await response.json();
      this.addAirport(airport);

    } catch (error) {
      console.warn(`⚠️ Error fetching details for ${code}:`, error.message);
    }
  }

  /**
   * Filter airports for USA and Canada only
   */
  filterNorthAmericaAirports() {
    console.log('\n🇺🇸🇨🇦 Filtering for USA and Canada airports...');
    
    this.filteredAirports = this.allAirports.filter(airport => {
      const country = airport.country?.toUpperCase();
      return country === 'USA' || country === 'US' || 
             country === 'CANADA' || country === 'CA' ||
             country === 'UNITED STATES' || country === 'UNITED STATES OF AMERICA';
    });

    console.log(`✅ Filtered ${this.filteredAirports.length} airports from USA and Canada`);
    
    // Sort by country, then by state, then by city
    this.filteredAirports.sort((a, b) => {
      if (a.country !== b.country) {
        return a.country.localeCompare(b.country);
      }
      if (a.state !== b.state) {
        return (a.state || '').localeCompare(b.state || '');
      }
      return a.city.localeCompare(b.city);
    });

    return this.filteredAirports;
  }

  /**
   * Add airport to list with standardized format
   */
  addAirport(airportData) {
    if (!airportData || !airportData.code) return;

    const airport = {
      code: airportData.code,
      name: airportData.name || 'Unknown Airport',
      city: airportData.city || 'Unknown',
      state: airportData.state || null,
      country: this.getCountryCode(airportData.country_code || airportData.country),
      timezone: airportData.timezone || null,
      type: airportData.airport_type || 'airport',
      lat: airportData.latitude || null,
      lon: airportData.longitude || null
    };

    // Only add if we don't already have this airport
    if (!this.allAirports.find(a => a.code === airport.code)) {
      this.allAirports.push(airport);
    }
  }

  /**
   * Convert country code to standard format
   */
  getCountryCode(country) {
    if (!country) return 'Unknown';
    
    const countryMap = {
      'US': 'USA',
      'CA': 'Canada', 
      'MX': 'Mexico'
    };

    return countryMap[country] || country;
  }

  /**
   * Save airports to JSON file
   */
  async saveAirports() {
    try {
      const outputPath = path.join(__dirname, '..', 'server', 'data', 'airports-north-america.json');
      
      await fs.promises.writeFile(
        outputPath, 
        JSON.stringify(this.filteredAirports, null, 2), 
        'utf8'
      );

      console.log(`✅ Saved ${this.filteredAirports.length} North America airports to ${outputPath}`);
      
      // Also create a backup of existing airports.json
      const currentAirportsPath = path.join(__dirname, '..', 'server', 'data', 'airports.json');
      const backupPath = path.join(__dirname, '..', 'server', 'data', 'airports-backup.json');
      
      try {
        await fs.promises.copyFile(currentAirportsPath, backupPath);
        console.log(`📋 Backed up existing airports.json to airports-backup.json`);
      } catch (error) {
        console.warn('⚠️ Could not backup existing airports.json:', error.message);
      }

      return outputPath;

    } catch (error) {
      console.error('❌ Error saving airports:', error);
      throw error;
    }
  }

  /**
   * Display statistics
   */
  displayStats() {
    const stats = {};
    const stateStats = {};
    
    this.filteredAirports.forEach(airport => {
      stats[airport.country] = (stats[airport.country] || 0) + 1;
      
      if (airport.state) {
        const key = `${airport.country} - ${airport.state}`;
        stateStats[key] = (stateStats[key] || 0) + 1;
      }
    });

    console.log('\n📊 Airport Statistics by Country:');
    Object.entries(stats)
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

  /**
   * Delay function for rate limiting
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Main execution
async function main() {
  try {
    console.log('🚀 Starting USA & Canada airport data fetch...');
    console.log('📡 Using FlightAware AeroAPI /airports endpoint\n');

    const fetcher = new AirportFetcher();
    
    // Fetch all airports first
    await fetcher.fetchAllAirports();
    
    // Filter for North America (USA & Canada)
    fetcher.filterNorthAmericaAirports();
    
    // Display statistics
    fetcher.displayStats();
    
    // Save the filtered airports
    const outputFile = await fetcher.saveAirports();
    
    console.log('\n✅ Airport fetch completed successfully!');
    console.log(`📄 Output file: ${outputFile}`);
    console.log('\n💡 Next steps:');
    console.log('   1. Review the generated airports-north-america.json file');
    console.log('   2. Replace airports.json with the new data if satisfied');
    console.log('   3. Update the Add Flight page to use the comprehensive airport list');

  } catch (error) {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = AirportFetcher;