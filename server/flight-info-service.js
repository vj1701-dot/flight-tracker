const axios = require('axios');
const TimezoneService = require('./timezone-service');

/**
 * Flight Information Service using FlightAware AeroAPI
 */
class FlightInfoService {
  constructor() {
    this.apiKey = process.env.FLIGHTAWARE_API_KEY;
    this.baseUrl = 'https://aeroapi.flightaware.com/aeroapi';
    this.timezoneService = new TimezoneService();
    
    // Warn if API key is not configured
    if (!this.apiKey) {
      console.warn('⚠️  WARNING: FLIGHTAWARE_API_KEY environment variable not set. Flight tracking features will be disabled.');
    } else if (process.env.NODE_ENV === 'production' && this.apiKey !== 'YOUR_FLIGHTAWARE_API_KEY') {
      console.log('✅ FlightAware API configured for production');
    }
  }

  /**
   * Fetch flight information from FlightAware AeroAPI
   * @param {string} flightNumber - IATA flight number (e.g., "UA100")
   * @param {string} flightDate - Flight date in YYYY-MM-DD format
   * @returns {Promise<Object>} Flight information or error
   */
  async getFlightInfo(flightNumber, flightDate) {
    // Validate inputs
    const validation = this.validateInputs(flightNumber, flightDate);
    if (validation.error) {
      return validation;
    }

    try {
      console.log(`🔍 Fetching flight info for ${flightNumber} on ${flightDate}...`);
      console.log(`🔑 Using API key: ${this.apiKey.substring(0, 8)}...${this.apiKey.substring(-4)}`);
      console.log(`🌐 Base URL: ${this.baseUrl}`);

      // FlightAware AeroAPI endpoint for flight schedules
      // Note: FlightAware uses flight identifiers in format like "AAL123" not just "123"
      let flightIdent = flightNumber.toUpperCase();
      
      // Ensure flight number has airline code - if it doesn't appear to have one, try to add it
      if (!/^[A-Z]{2,3}\d+$/.test(flightIdent)) {
        console.log(`⚠️ Flight number ${flightIdent} may not be in correct format for FlightAware API`);
      }
      
      const url = `${this.baseUrl}/flights/${flightIdent}`;
      console.log(`📡 Full request URL: ${url}`);
      
      const requestHeaders = {
        'x-apikey': this.apiKey,
        'Accept': 'application/json; charset=UTF-8'
      };
      
      const requestParams = {
        // FlightAware AeroAPI uses 'start' and 'end' parameters in ISO8601 format
        // Note: end date must be later than start date
        start: flightDate,
        end: this.getNextDay(flightDate),
        max_pages: 1
      };
      
      console.log(`📋 Request headers:`, { ...requestHeaders, 'x-apikey': `${this.apiKey.substring(0, 8)}...` });
      console.log(`📋 Request params:`, requestParams);

      const response = await axios.get(url, {
        headers: requestHeaders,
        params: requestParams,
        timeout: 15000
      });

      // Log successful response for debugging
      console.log('✅ FlightAware API Response received');
      console.log('Response structure:', Object.keys(response.data));
      console.log('Full response data:', JSON.stringify(response.data, null, 2));

      // Check if any flights were found
      if (!response.data.flights || response.data.flights.length === 0) {
        return {
          error: true,
          message: `No flight found for ${flightNumber} on ${flightDate}`,
          fallback: this.generateFlightSuggestion(flightNumber, flightDate)
        };
      }

      // If multiple flights found, return them for user selection
      if (response.data.flights.length > 1) {
        console.log(`⚠️ Multiple flights found for ${flightNumber} on ${flightDate}: ${response.data.flights.length} flights`);
        return {
          multipleFlights: true,
          flights: response.data.flights.map((flight, index) => ({
            index,
            ...this.formatFlightAwareData(flight, flightDate)
          }))
        };
      }

      // Get the single flight for the specified date
      const flight = response.data.flights[0];
      console.log('Processing flight data:', JSON.stringify(flight, null, 2));
      return this.formatFlightAwareData(flight, flightDate);

    } catch (error) {
      console.error('FlightAware API Error:', error.message);
      
      // Log additional details for debugging
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', JSON.stringify(error.response.data, null, 2));
        console.error('Request URL:', url);
        console.error('Request params:', JSON.stringify({
          start: flightDate,
          end: this.getNextDay(flightDate),
          max_pages: 1
        }, null, 2));
      }
      
      if (error.code === 'ECONNABORTED') {
        return {
          error: true,
          message: 'Request timeout - API took too long to respond',
          fallback: this.generateFlightSuggestion(flightNumber, flightDate)
        };
      }
      
      if (error.response) {
        const status = error.response.status;
        const statusText = error.response.statusText;
        const responseData = error.response.data;
        
        if (status === 401) {
          return {
            error: true,
            message: 'Invalid FlightAware API key',
            fallback: this.generateFlightSuggestion(flightNumber, flightDate)
          };
        } else if (status === 404) {
          return {
            error: true,
            message: `Flight ${flightNumber} not found for ${flightDate}. API Response: ${JSON.stringify(responseData)}`,
            fallback: this.generateFlightSuggestion(flightNumber, flightDate)
          };
        } else if (status === 400) {
          return {
            error: true,
            message: `Bad request to FlightAware API. Check flight identifier format and parameters. Response: ${JSON.stringify(responseData)}`,
            fallback: this.generateFlightSuggestion(flightNumber, flightDate)
          };
        } else if (status === 429) {
          return {
            error: true,
            message: 'FlightAware API rate limit exceeded',
            fallback: this.generateFlightSuggestion(flightNumber, flightDate)
          };
        }
        
        return {
          error: true,
          message: `FlightAware API Error: ${status} - ${statusText}. Response: ${JSON.stringify(responseData)}`,
          fallback: this.generateFlightSuggestion(flightNumber, flightDate)
        };
      }
      
      return {
        error: true,
        message: `Network error: ${error.message}`,
        fallback: this.generateFlightSuggestion(flightNumber, flightDate)
      };
    }
  }

  /**
   * Validate input parameters
   * @param {string} flightNumber 
   * @param {string} flightDate 
   * @returns {Object} Validation result
   */
  validateInputs(flightNumber, flightDate) {
    // Validate flight number
    if (!flightNumber || typeof flightNumber !== 'string' || flightNumber.length < 3) {
      return {
        error: true,
        message: 'Invalid flight number format. Please use IATA format (e.g., "UA100")'
      };
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!flightDate || !dateRegex.test(flightDate)) {
      return {
        error: true,
        message: 'Invalid date format. Please use YYYY-MM-DD format'
      };
    }

    // Validate that date is valid
    const requestedDate = new Date(flightDate);
    if (isNaN(requestedDate.getTime()) || requestedDate.toISOString().split('T')[0] !== flightDate) {
      return {
        error: true,
        message: 'Invalid date. Please provide a valid date in YYYY-MM-DD format'
      };
    }

    // Validate FlightAware API date limitations
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const maxFutureDate = new Date(today);
    maxFutureDate.setDate(today.getDate() + 2); // FlightAware allows max 2 days in future
    const maxFutureDateStr = maxFutureDate.toISOString().split('T')[0];

    const minPastDate = new Date(today);
    minPastDate.setDate(today.getDate() - 10); // FlightAware allows max 10 days in past
    const minPastDateStr = minPastDate.toISOString().split('T')[0];

    if (flightDate > maxFutureDateStr) {
      return {
        error: true,
        message: `Auto-populate not available for ${flightNumber} on ${flightDate}. Flight date is more than 48 hours in the future - FlightAware API only provides data up to 2 days ahead (maximum date: ${maxFutureDateStr}). Please manually enter flight details.`,
        fallback: this.generateFlightSuggestion(flightNumber, flightDate)
      };
    }

    if (flightDate < minPastDateStr) {
      return {
        error: true,
        message: `Auto-populate not available for ${flightNumber} on ${flightDate}. Flight date is too far in the past - FlightAware API only provides historical data up to 10 days ago (earliest date: ${minPastDateStr}). Please manually enter flight details.`,
        fallback: this.generateFlightSuggestion(flightNumber, flightDate)
      };
    }

    return { error: false };
  }

  /**
   * Format datetime string for display with timezone support
   * @param {string} dtStr - ISO datetime string
   * @param {string} airportCode - Airport code for timezone conversion
   * @returns {string} Formatted datetime with timezone
   */
  formatDateTime(dtStr, airportCode = null) {
    if (!dtStr) return 'Not available';
    
    try {
      if (airportCode && this.timezoneService.hasTimezoneData(airportCode)) {
        const airportTime = this.timezoneService.convertToAirportTime(dtStr, airportCode);
        return `${airportTime.localTime} ${airportTime.timezoneAbbr}`;
      }
      
      const date = new Date(dtStr);
      return date.toISOString().replace('T', ' ').replace('.000Z', ' UTC');
    } catch (error) {
      return dtStr;
    }
  }

  /**
   * Convert ISO datetime to format suitable for HTML datetime-local input
   * @param {string} dtStr - ISO datetime string
   * @returns {string} Datetime string in YYYY-MM-DDTHH:MM format
   */
  formatDateTimeForInput(dtStr, airportCode = null) {
    if (!dtStr) return '';
    
    try {
      // If airport code provided, use airport's timezone for accurate local time
      if (airportCode && this.timezoneService.hasTimezoneData(airportCode)) {
        const airportInfo = this.timezoneService.getAirportInfo(airportCode);
        if (airportInfo && airportInfo.timezone) {
          // Create date object and format in airport's timezone
          const date = new Date(dtStr);
          const options = {
            timeZone: airportInfo.timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          };
          
          const formatter = new Intl.DateTimeFormat('en-CA', options);
          const parts = formatter.formatToParts(date);
          
          const year = parts.find(p => p.type === 'year').value;
          const month = parts.find(p => p.type === 'month').value;
          const day = parts.find(p => p.type === 'day').value;
          const hour = parts.find(p => p.type === 'hour').value;
          const minute = parts.find(p => p.type === 'minute').value;
          
          return `${year}-${month}-${day}T${hour}:${minute}`;
        }
      }
      
      // Fallback: use the original UTC time converted to local
      const date = new Date(dtStr);
      const localISOTime = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString();
      return localISOTime.slice(0, 16); // Remove seconds and timezone info
    } catch (error) {
      console.error('Error formatting datetime for input:', error);
      return '';
    }
  }

  /**
   * Get the next day from a given date string
   * @param {string} dateStr - Date string in YYYY-MM-DD format
   * @returns {string} Next day in YYYY-MM-DD format
   */
  getNextDay(dateStr) {
    try {
      const date = new Date(dateStr);
      date.setDate(date.getDate() + 1);
      return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
    } catch (error) {
      console.error('Error calculating next day:', error);
      return dateStr; // Fallback to original date
    }
  }

  /**
   * Calculate delay information
   * @param {string} scheduled - Scheduled time
   * @param {string} actual - Actual or estimated time
   * @returns {string} Delay information
   */
  getDelayInfo(scheduled, actual) {
    if (!scheduled || !actual) {
      return 'No delay information available';
    }

    try {
      const scheduledDate = new Date(scheduled);
      const actualDate = new Date(actual);
      const delayMinutes = Math.round((actualDate - scheduledDate) / (1000 * 60));

      if (delayMinutes > 0) {
        return `Delayed by ${delayMinutes} minutes`;
      } else if (delayMinutes < 0) {
        return `Early by ${Math.abs(delayMinutes)} minutes`;
      } else {
        return 'On time';
      }
    } catch (error) {
      return 'Unable to calculate delay';
    }
  }

  /**
   * Format FlightAware flight data into a structured object
   * @param {Object} flight - Raw flight data from FlightAware API
   * @param {string} flightDate - Original flight date
   * @returns {Object} Formatted flight information
   */
  formatFlightAwareData(flight, flightDate) {
    // FlightAware data structure
    const origin = flight.origin || {};
    const destination = flight.destination || {};
    const operator = flight.operator || {};

    // Calculate delay notification
    const departureDelay = this.getDelayInfo(
      flight.scheduled_out,
      flight.actual_out || flight.estimated_out
    );

    // Standardize airport and airline data to match our local format
    const standardizedDepartureAirport = this.standardizeAirportInfo(origin);
    const standardizedArrivalAirport = this.standardizeAirportInfo(destination);
    const standardizedAirline = this.standardizeAirlineInfo(operator);

    const result = {
      error: false,
      flightNumber: flight.ident || 'Unknown',
      airlineName: standardizedAirline.name,
      airlineIata: standardizedAirline.iata,
      departureAirport: standardizedDepartureAirport.name,
      departureIata: standardizedDepartureAirport.code,
      arrivalAirport: standardizedArrivalAirport.name,
      arrivalIata: standardizedArrivalAirport.code,
      scheduledDeparture: this.formatDateTime(flight.scheduled_out, origin.code),
      scheduledArrival: this.formatDateTime(flight.scheduled_in, destination.code),
      actualDeparture: this.formatDateTime(flight.actual_out, origin.code),
      estimatedDeparture: this.formatDateTime(flight.estimated_out, origin.code),
      actualArrival: this.formatDateTime(flight.actual_in, destination.code),
      estimatedArrival: this.formatDateTime(flight.estimated_in, destination.code),
      // Raw datetime values for form auto-population (converted to airport timezone)
      scheduledDepartureRaw: this.formatDateTimeForInput(flight.scheduled_out, origin.code),
      scheduledArrivalRaw: this.formatDateTimeForInput(flight.scheduled_in, destination.code),
      actualDepartureRaw: this.formatDateTimeForInput(flight.actual_out, origin.code),
      estimatedDepartureRaw: this.formatDateTimeForInput(flight.estimated_out, origin.code),
      actualArrivalRaw: this.formatDateTimeForInput(flight.actual_in, destination.code),
      estimatedArrivalRaw: this.formatDateTimeForInput(flight.estimated_in, destination.code),
      flightStatus: flight.status || 'unknown',
      delayNotification: departureDelay,
      flightDate: flightDate,
      rawData: flight // Include raw data for debugging
    };

    // Add timezone information if available
    if (origin.code) {
      const depAirport = this.timezoneService.getAirportInfo(origin.code);
      if (depAirport) {
        result.departureTimezone = depAirport.timezone;
        result.departureCity = depAirport.city;
        result.departureState = depAirport.state;
      }
    }

    if (destination.code) {
      const arrAirport = this.timezoneService.getAirportInfo(destination.code);
      if (arrAirport) {
        result.arrivalTimezone = arrAirport.timezone;
        result.arrivalCity = arrAirport.city;
        result.arrivalState = arrAirport.state;
      }
    }

    // Calculate flight duration if both times are available
    if (flight.scheduled_out && flight.scheduled_in) {
      const duration = this.timezoneService.getFlightDuration(flight.scheduled_out, flight.scheduled_in);
      if (!duration.error) {
        result.duration = duration.formatted;
        result.durationMinutes = duration.totalMinutes;
      }
    }

    return result;
  }

  /**
   * Format flight information as a readable string
   * @param {Object} flightData - Formatted flight data
   * @returns {string} Human-readable flight information
   */
  formatFlightInfoString(flightData) {
    if (flightData.error) {
      return `❌ Error: ${flightData.message}`;
    }

    const lines = [
      '✈️  FLIGHT INFORMATION',
      '='.repeat(50),
      `Flight: ${flightData.flightNumber}`,
      `Airline: ${flightData.airlineName} (${flightData.airlineIata})`,
      `Date: ${flightData.flightDate}`,
      `Status: ${flightData.flightStatus.toUpperCase()}`,
      '',
      '🛫 DEPARTURE',
      `Airport: ${flightData.departureAirport} (${flightData.departureIata})`,
      `Scheduled: ${flightData.scheduledDeparture}`,
    ];

    if (flightData.actualDeparture !== 'Not available') {
      lines.push(`Actual: ${flightData.actualDeparture}`);
    }
    if (flightData.estimatedDeparture !== 'Not available') {
      lines.push(`Estimated: ${flightData.estimatedDeparture}`);
    }

    lines.push('');
    lines.push('🛬 ARRIVAL');
    lines.push(`Airport: ${flightData.arrivalAirport} (${flightData.arrivalIata})`);
    lines.push(`Scheduled: ${flightData.scheduledArrival}`);

    if (flightData.actualArrival !== 'Not available') {
      lines.push(`Actual: ${flightData.actualArrival}`);
    }
    if (flightData.estimatedArrival !== 'Not available') {
      lines.push(`Estimated: ${flightData.estimatedArrival}`);
    }

    lines.push('');
    lines.push('⏰ DELAY STATUS');
    lines.push(flightData.delayNotification);

    return lines.join('\n');
  }

  /**
   * Generate helpful flight suggestions when API lookup fails
   * @param {string} flightNumber - IATA flight number
   * @param {string} flightDate - Flight date
   * @returns {Object} Suggested flight information
   */
  generateFlightSuggestion(flightNumber, flightDate) {
    // Extract airline code from flight number
    const airlineCode = flightNumber.replace(/[0-9]/g, '').toUpperCase();
    
    // Common airline mappings
    const airlineNames = {
      'AA': 'American Airlines',
      'UA': 'United Airlines', 
      'DL': 'Delta Air Lines',
      'WN': 'Southwest Airlines',
      'AS': 'Alaska Airlines',
      'B6': 'JetBlue Airways',
      'NK': 'Spirit Airlines',
      'F9': 'Frontier Airlines',
      'G4': 'Allegiant Air',
      'HA': 'Hawaiian Airlines'
    };

    const suggestion = {
      airline: airlineNames[airlineCode] || `${airlineCode} Airlines`,
      message: `Auto-populate not available for ${flightNumber}. Please manually enter flight details.`,
      tips: [
        'Check the airline\'s website for accurate flight times',
        'Verify departure and arrival airports',
        'Consider time zone differences for scheduling'
      ]
    };

    return suggestion;
  }

  /**
   * Standardize airport information to match our local format
   * @param {Object} flightAwareAirport - Airport data from FlightAware API
   * @returns {Object} Standardized airport information
   */
  standardizeAirportInfo(flightAwareAirport) {
    if (!flightAwareAirport || !flightAwareAirport.code) {
      return { name: 'Unknown Airport', code: 'Unknown', display: 'Unknown Airport' };
    }

    // First try to get airport info from our local data
    const localAirport = this.timezoneService.getAirportInfo(flightAwareAirport.code);
    
    if (localAirport) {
      // Use our local airport data format with new display format
      return {
        name: localAirport.display || localAirport.name, // Use display format (CODE, City, State, Country)
        code: localAirport.code,
        city: localAirport.city,
        state: localAirport.state,
        timezone: localAirport.timezone,
        display: localAirport.display || `${localAirport.code}, ${localAirport.city}${localAirport.state ? `, ${localAirport.state}` : ''}, ${localAirport.country}`
      };
    }

    // Fallback to FlightAware data if not in our local database
    const state = flightAwareAirport.state || null;
    const stateDisplay = state ? `, ${state}` : '';
    const fallbackDisplay = `${flightAwareAirport.code}, ${flightAwareAirport.city || 'Unknown'}${stateDisplay}, ${flightAwareAirport.country || 'Unknown'}`;
    
    return {
      name: fallbackDisplay,
      code: flightAwareAirport.code || 'Unknown',
      city: flightAwareAirport.city || 'Unknown',
      state: state,
      timezone: null,
      display: fallbackDisplay
    };
  }

  /**
   * Standardize airline information to match our local format
   * @param {Object} flightAwareOperator - Operator data from FlightAware API
   * @returns {Object} Standardized airline information
   */
  standardizeAirlineInfo(flightAwareOperator) {
    if (!flightAwareOperator) {
      return { name: 'Unknown Airline', iata: 'Unknown' };
    }

    // Read our local airlines data to get standardized names
    const fs = require('fs');
    const path = require('path');
    
    try {
      const airlinesPath = path.join(__dirname, 'data', 'airlines.json');
      const airlinesData = JSON.parse(fs.readFileSync(airlinesPath, 'utf8'));
      
      // Our airlines.json is an array of strings, so find matching airline by name
      const flightAwareName = flightAwareOperator.name?.toLowerCase() || '';
      const localAirline = airlinesData.find(airline => 
        airline.toLowerCase().includes(flightAwareName) ||
        flightAwareName.includes(airline.toLowerCase())
      );
      
      if (localAirline) {
        // Use our local airline name with FlightAware's IATA code
        return {
          name: localAirline,
          iata: flightAwareOperator.iata || 'Unknown',
          icao: flightAwareOperator.icao || 'Unknown'
        };
      }

      // Create mappings for common airlines by both name and IATA code
      const airlineMapping = {
        'alaska airlines': 'Alaska Airlines',
        'american airlines': 'American Airlines', 
        'delta air lines': 'Delta Air Lines',
        'united airlines': 'United Airlines',
        'southwest airlines': 'Southwest Airlines',
        'jetblue airways': 'JetBlue Airways',
        'spirit airlines': 'Spirit Airlines',
        'frontier airlines': 'Frontier Airlines',
        'hawaiian airlines': 'Hawaiian Airlines',
        'british airways': 'British Airways',
        'lufthansa': 'Lufthansa',
        'emirates': 'Emirates',
        'qatar airways': 'Qatar Airways',
        'air india': 'Air India'
      };

      // IATA code to airline name mapping
      const iataMapping = {
        'AS': 'Alaska Airlines',
        'AA': 'American Airlines',
        'DL': 'Delta Air Lines',
        'UA': 'United Airlines',
        'WN': 'Southwest Airlines',
        'B6': 'JetBlue Airways',
        'NK': 'Spirit Airlines',
        'F9': 'Frontier Airlines',
        'HA': 'Hawaiian Airlines',
        'BA': 'British Airways',
        'LH': 'Lufthansa',
        'EK': 'Emirates',
        'QR': 'Qatar Airways',
        'AI': 'Air India'
      };

      // First try IATA code mapping (more reliable)
      if (flightAwareOperator.iata && iataMapping[flightAwareOperator.iata]) {
        return {
          name: iataMapping[flightAwareOperator.iata],
          iata: flightAwareOperator.iata,
          icao: flightAwareOperator.icao || 'Unknown'
        };
      }

      // Then try name mapping
      const mappedAirline = airlineMapping[flightAwareName];
      if (mappedAirline) {
        return {
          name: mappedAirline,
          iata: flightAwareOperator.iata || 'Unknown',
          icao: flightAwareOperator.icao || 'Unknown'
        };
      }

    } catch (error) {
      console.warn('Could not read local airlines data:', error.message);
    }

    // Fallback to FlightAware data if not in our local database
    return {
      name: flightAwareOperator.name || 'Unknown Airline',
      iata: flightAwareOperator.iata || 'Unknown',
      icao: flightAwareOperator.icao || 'Unknown'
    };
  }
}

// Example usage
async function testFlightService() {
  const flightService = new FlightInfoService();
  
  console.log('Testing FlightAware Flight Information Service');
  console.log('='.repeat(50));
  
  const testCases = [
    ['UA100', '2025-08-04'],
    ['AA1', '2025-08-04'],
    ['INVALID', '2025-08-04'], // Invalid flight
    ['UA100', 'invalid-date']   // Invalid date
  ];
  
  for (const [flightNum, date] of testCases) {
    console.log(`\n🔍 Testing: ${flightNum} on ${date}`);
    console.log('-'.repeat(30));
    
    try {
      const result = await flightService.getFlightInfo(flightNum, date);
      const formatted = flightService.formatFlightInfoString(result);
      console.log(formatted);
    } catch (error) {
      console.error('Test error:', error.message);
    }
    
    console.log('\n' + '='.repeat(50));
  }
}

module.exports = FlightInfoService;

// Run tests if this file is executed directly
if (require.main === module) {
  testFlightService();
}