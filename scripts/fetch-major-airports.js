const fs = require('fs');
const path = require('path');

/**
 * Simplified script to fetch major USA & Canada airports from FlightAware AeroAPI
 * Uses known major airport codes to avoid rate limiting issues
 */

const FLIGHTAWARE_API_KEY = process.env.FLIGHTAWARE_API_KEY;

if (!FLIGHTAWARE_API_KEY) {
  console.error('❌ ERROR: FLIGHTAWARE_API_KEY environment variable is required');
  console.log('Usage: FLIGHTAWARE_API_KEY=your_key_here node scripts/fetch-major-airports.js');
  process.exit(1);
}
const BASE_URL = 'https://aeroapi.flightaware.com/aeroapi';

class MajorAirportFetcher {
  constructor() {
    this.airports = [];
  }

  /**
   * List of major airports in USA and Canada
   */
  getMajorAirportCodes() {
    return {
      // Major US Airports
      usa: [
        // Major Hubs
        'LAX', 'JFK', 'ORD', 'DFW', 'DEN', 'SFO', 'SEA', 'LAS', 'PHX', 'IAH',
        'CLT', 'MIA', 'MCO', 'BOS', 'MSP', 'DTW', 'PHL', 'LGA', 'FLL', 'BWI',
        'MDW', 'DCA', 'SLC', 'HNL', 'SAN', 'TPA', 'PDX', 'STL', 'BNA', 'AUS',
        'MSY', 'RDU', 'SMF', 'SJC', 'OAK', 'BUR', 'ONT', 'SNA', 'JAX', 'MKE',
        
        // Additional Major Cities
        'ATL', 'EWR', 'IAD', 'PIT', 'CVG', 'IND', 'CMH', 'MCI', 'OMA', 'DSM',
        'CLE', 'BUF', 'ROC', 'SYR', 'ALB', 'BGR', 'PWM', 'BTV', 'MHT', 'ORF',
        'RIC', 'CLT', 'GSO', 'RDU', 'CHS', 'CAE', 'MYR', 'SAV', 'JAX', 'TLH',
        'TPA', 'RSW', 'PBI', 'FLL', 'MIA', 'KEY', 'ATL', 'SAV', 'AGS', 'CSG',
        'BHM', 'HSV', 'MOB', 'MEM', 'BNA', 'TYS', 'TRI', 'CHA', 'GSP', 'CAE',
        
        // West Coast - California
        'SFO', 'SJC', 'OAK', 'SMF', 'LAX', 'BUR', 'ONT', 'SNA', 'SAN', 'FAT',
        'SBA', 'PSP', 'MRY', 'MOD', 'RDD', 'CEC', 'ACV', 'EUG', 'MFR', 'LMT',
        'TVL', 'WDC', 'MMV', 'BFL', 'IYK', 'VIS', 'CIC', 'IPL', 'TRM', 'EMT',
        
        // Pacific Northwest
        'SEA', 'BFI', 'PAE', 'BLI', 'YKM', 'PSC', 'ALW', 'PUW', 'CLM', 'PDX',
        'HIO', 'EUG', 'MFR', 'LMT', 'RDM', 'BOI', 'TWF', 'LWS', 'COE', 'SUN',
        
        // Nevada & Utah
        'LAS', 'RNO', 'ELY', 'SLC', 'OGD', 'PVU', 'CDC', 'CNY', 'VEL',
        
        // Arizona
        'PHX', 'TUS', 'FLG', 'YUM', 'GCN', 'PRC', 'IWA', 'INW', 'IGM',
        
        // New Mexico
        'ABQ', 'SAF', 'ROW', 'CVN', 'HOB', 'RUI', 'FMN', 'GNT',
        
        // Colorado & Mountain States
        'DEN', 'COS', 'ASE', 'EGE', 'GJT', 'HDN', 'MTJ', 'PUB', 'AKR', 'CEZ',
        'DRO', 'GUC', 'LAR', 'CPR', 'RIW', 'COD', 'JAC', 'IDA', 'PIH', 'HLN',
        'BTM', 'BZN', 'MSO', 'GTF', 'GGW', 'BIL', 'COD', 'JAC',
        
        // Alaska (Western USA territory)
        'ANC', 'FAI', 'JNU', 'KTN', 'SIT', 'YAK', 'BET', 'OME', 'ADK', 'ADQ',
        'AKN', 'ANI', 'ARC', 'ATK', 'BRW', 'CDB', 'CDV', 'CEM', 'CGA', 'CLP',
        'CYF', 'DLG', 'DUT', 'EAA', 'EHM', 'EII', 'GAL', 'GAM', 'GKN', 'GLL',
        'HNS', 'HOM', 'HUS', 'HYG', 'HYL', 'IAN', 'IGG', 'ILI', 'KCC', 'KCL',
        'KGK', 'KGX', 'KKA', 'KLG', 'KLL', 'KPN', 'KPR', 'KSM', 'KTS', 'KTB',
        'KVC', 'KWF', 'KWK', 'KWN', 'LUR', 'MCG', 'MDO', 'MLL', 'MOU', 'NUL',
        'OOK', 'ORV', 'OTZ', 'PDB', 'PEC', 'PGV', 'PIP', 'PKA', 'PLG', 'PTH',
        'PTU', 'PWE', 'SCM', 'SDP', 'SGY', 'SHG', 'SHH', 'SHX', 'SKK', 'SOV',
        'SVA', 'TKE', 'TNC', 'TOG', 'UNK', 'VAK', 'VDZ', 'VEE', 'WBQ', 'WMO',
        'WTK', 'WWP',
        
        // Hawaii (Western USA territory)  
        'HNL', 'OGG', 'KOA', 'ITO', 'LIH', 'MKK', 'LNY', 'JHM', 'HDH', 'MUE',
        
        // Texas
        'DFW', 'IAH', 'HOU', 'AUS', 'SAT', 'ELP', 'LBB', 'AMA', 'MAF', 'CRP',
        
        // Florida
        'MIA', 'FLL', 'PBI', 'MCO', 'TPA', 'RSW', 'SRQ', 'PIE', 'DAB', 'JAX',
        'TLH', 'PNS', 'VPS', 'ECP', 'GNV', 'KEY',
        
        // Alaska & Hawaii
        'ANC', 'FAI', 'JNU', 'KTN', 'HNL', 'OGG', 'KOA', 'ITO', 'LIH'
      ],
      
      // Major Canadian Airports
      canada: [
        // Major Cities
        'YYZ', 'YVR', 'YUL', 'YYC', 'YOW', 'YEG', 'YHZ', 'YWG', 'YQB', 'YXE',
        'YYJ', 'YKF', 'YHM', 'YXU', 'YQR', 'YQT', 'YQX', 'YDF', 'YQY', 'YKA',
        'YPG', 'YBR', 'YTH', 'YZF', 'YXY', 'YXS', 'YFB', 'YQD', 'YCD', 'YGR'
      ]
    };
  }

  /**
   * Fetch all major airports
   */
  async fetchMajorAirports() {
    try {
      console.log('🇺🇸🇨🇦 Fetching major USA & Canada airports...');
      
      const airportCodes = this.getMajorAirportCodes();
      const totalAirports = airportCodes.usa.length + airportCodes.canada.length;
      console.log(`📍 Processing ${totalAirports} major airports (${airportCodes.usa.length} USA, ${airportCodes.canada.length} Canada)`);
      
      let processed = 0;
      
      // Process USA airports
      console.log('\n🇺🇸 Processing USA airports...');
      for (const code of airportCodes.usa) {
        await this.fetchAirportDetails(code);
        processed++;
        if (processed % 10 === 0) {
          console.log(`   ✅ Processed ${processed}/${totalAirports} airports`);
        }
        await this.delay(500); // Conservative delay
      }
      
      // Process Canada airports
      console.log('\n🇨🇦 Processing Canada airports...');
      for (const code of airportCodes.canada) {
        await this.fetchAirportDetails(code);
        processed++;
        if (processed % 10 === 0) {
          console.log(`   ✅ Processed ${processed}/${totalAirports} airports`);
        }
        await this.delay(500); // Conservative delay
      }
      
      console.log(`\n✅ Successfully processed ${this.airports.length} airports`);
      return this.airports;

    } catch (error) {
      console.error('❌ Error fetching airports:', error);
      throw error;
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
        if (response.status === 429) {
          console.warn(`⚠️ Rate limited on ${code}, waiting longer...`);
          await this.delay(5000); // Wait 5 seconds on rate limit
          return this.fetchAirportDetails(code); // Retry
        }
        if (response.status !== 404) {
          console.warn(`⚠️ Could not fetch ${code}: ${response.status}`);
        }
        return;
      }

      const airportData = await response.json();
      this.addAirport(airportData);

    } catch (error) {
      console.warn(`⚠️ Error fetching ${code}:`, error.message);
    }
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
      country: this.getCountryName(airportData.country_code || airportData.country),
      timezone: airportData.timezone || null,
      lat: airportData.latitude || null,
      lon: airportData.longitude || null,
      type: airportData.airport_type || 'airport'
    };

    // Only add if we don't already have this airport
    if (!this.airports.find(a => a.code === airport.code)) {
      this.airports.push(airport);
    }
  }

  /**
   * Convert country code to full name
   */
  getCountryName(country) {
    if (!country) return 'Unknown';
    
    const countryMap = {
      'US': 'USA',
      'CA': 'Canada'
    };

    return countryMap[country] || country;
  }

  /**
   * Save airports to JSON file
   */
  async saveAirports() {
    try {
      // Sort airports by country, then state, then city
      this.airports.sort((a, b) => {
        if (a.country !== b.country) {
          return a.country.localeCompare(b.country);
        }
        if (a.state !== b.state) {
          return (a.state || '').localeCompare(b.state || '');
        }
        return a.city.localeCompare(b.city);
      });

      const outputPath = path.join(__dirname, '..', 'server', 'data', 'airports-major-na.json');
      
      await fs.promises.writeFile(
        outputPath, 
        JSON.stringify(this.airports, null, 2), 
        'utf8'
      );

      console.log(`✅ Saved ${this.airports.length} major North America airports to ${outputPath}`);
      
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
    
    this.airports.forEach(airport => {
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
      .slice(0, 15)
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
    console.log('🚀 Starting major USA & Canada airport fetch...');
    console.log('📡 Using FlightAware AeroAPI with conservative rate limiting\n');

    const fetcher = new MajorAirportFetcher();
    
    await fetcher.fetchMajorAirports();
    fetcher.displayStats();
    
    const outputFile = await fetcher.saveAirports();
    
    console.log('\n✅ Major airport fetch completed successfully!');
    console.log(`📄 Output file: ${outputFile}`);
    console.log('\n💡 Next steps:');
    console.log('   1. Review the generated airports-major-na.json file');
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

module.exports = MajorAirportFetcher;