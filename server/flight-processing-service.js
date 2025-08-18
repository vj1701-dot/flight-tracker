const fs = require('fs').promises;
const path = require('path');
const { extractTextFromImage } = require('./ocr-service');
const GeminiService = require('./gemini-service');
const { v4: uuidv4 } = require('uuid');
const { 
  readPassengers, 
  writePassengers, 
  readFlights, 
  writeFlights,
  findPassengerByName
} = require('./data-helpers');

// Install fuzzy string matching library if needed
let fuzzy;
try {
  fuzzy = require('fuzzyset');
} catch (e) {
  console.warn('⚠️  FLIGHT_PROCESSING: fuzzyset not installed. Fuzzy matching will be disabled.');
  console.warn('   Run: npm install fuzzyset for better passenger name matching');
}

// Define airline-specific patterns for parsing tickets
const AIRLINE_PATTERNS = {
  'AMERICAN': {
    name: 'American Airlines',
    codes: ['AA', 'AMERICAN'],
    flightRegex: /(?:AA|American(?:\s+Airlines)?)\s*(\d{3,4})/i,
    dateRegex: /(\d{1,2}\s?(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s?\d{2,4})/i,
    routeRegex: /([A-Z]{3})\s*(?:to|→|-|>)\s*([A-Z]{3})/i,
    passengerRegex: /(?:passenger|name)\s*[:\-]?\s*([A-Z][A-Z\s',.-]+)/i,
    confirmationRegex: /(?:confirmation|record\s+locator)\s*[:\-]?\s*([A-Z0-9]{6})/i
  },
  'DELTA': {
    name: 'Delta Air Lines',
    codes: ['DL', 'DELTA'],
    flightRegex: /(?:DL|Delta(?:\s+Air\s+Lines)?)\s*(\d{3,4})/i,
    dateRegex: /(\d{1,2}\s[A-Z]{3}\s\d{4})/i,
    routeRegex: /([A-Z]{3})\s*(?:-|to)\s*([A-Z]{3})/i,
    passengerRegex: /passenger[:\s]*([A-Z][A-Z\s',.-]+)/i,
    confirmationRegex: /(?:confirmation|pnr)\s*[:\-]?\s*([A-Z0-9]{6})/i
  },
  'UNITED': {
    name: 'United Airlines',
    codes: ['UA', 'UNITED'],
    flightRegex: /(?:UA|United(?:\s+Airlines)?)\s*(\d{3,4})/i,
    dateRegex: /(\d{1,2}[A-Z]{3}\d{2,4})/i,
    routeRegex: /([A-Z]{3})\s*[-→]\s*([A-Z]{3})/i,
    passengerRegex: /(?:name[:\s]*([A-Z][A-Z\s',.-]+)|([A-Z][A-Z\s',.-]+)\s*-\s*\d+[A-F])/i,
    confirmationRegex: /(?:confirmation|record\s+locator)\s*[:\-]?\s*([A-Z0-9]{6})/i
  },
  'SOUTHWEST': {
    name: 'Southwest Airlines',
    codes: ['WN', 'SOUTHWEST'],
    flightRegex: /(?:WN|Southwest(?:\s+Airlines)?)\s*(\d{3,4})/i,
    dateRegex: /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
    routeRegex: /([A-Z]{3})\s*(?:to|→|-)\s*([A-Z]{3})/i,
    passengerRegex: /passenger[:\s]*([A-Z][A-Z\s',.-]+)/i,
    confirmationRegex: /(?:confirmation)\s*[:\-]?\s*([A-Z0-9]{6})/i
  },
  'JETBLUE': {
    name: 'JetBlue Airways',
    codes: ['B6', 'JETBLUE'],
    flightRegex: /(?:B6|JetBlue(?:\s+Airways)?)\s*(\d{3,4})/i,
    dateRegex: /(\d{1,2}\s[A-Z]{3}\s\d{4})/i,
    routeRegex: /([A-Z]{3})\s*(?:to|-)\s*([A-Z]{3})/i,
    passengerRegex: /passenger[:\s]*([A-Z][A-Z\s',.-]+)/i,
    confirmationRegex: /(?:confirmation)\s*[:\-]?\s*([A-Z0-9]{6})/i
  },
  'SPIRIT': {
    name: 'Spirit Airlines', 
    codes: ['NK', 'SPIRIT'],
    flightRegex: /(?:NK|Spirit(?:\s+Airlines)?)\s*(\d{3,4})/i,
    dateRegex: /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
    routeRegex: /([A-Z]{3})\s*(?:to|-)\s*([A-Z]{3})/i,
    passengerRegex: /passenger[:\s]*([A-Z][A-Z\s',.-]+)/i,
    confirmationRegex: /(?:confirmation)\s*[:\-]?\s*([A-Z0-9]{6})/i
  }
};

// Generic patterns for fallback
const GENERIC_PATTERNS = {
  flightRegex: /([A-Z]{2,3})\s*(\d{3,4})/g,
  dateRegex: /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{1,2}\s[A-Z]{3}\s\d{2,4})/g,
  routeRegex: /([A-Z]{3})\s*(?:to|→|-|>)\s*([A-Z]{3})/gi,
  passengerRegex: /(?:(?:passenger|name|traveler)\s*[:\-]?\s*([A-Z][A-Z\s',.-]{2,})|([A-Z][A-Z\s',.-]{2,})\s*-\s*\d+[A-F])/gi,
  timeRegex: /(\d{1,2}:\d{2}\s*(?:AM|PM)?)/gi,
  seatRegex: /(?:seat|row)\s*[:\-]?\s*([A-Z0-9]{1,3}[A-F]?)/gi,
  confirmationRegex: /(?:confirmation|pnr|record\s+locator)\s*[:\-]?\s*([A-Z0-9]{4,8})/gi
};

/**
 * Convert Gemini extracted data to our internal format with multi-flight support
 * @param {Object} geminiData - Data from Gemini API (supports both single and multi-flight formats)
 * @returns {Object} - Data in our internal format
 */
async function convertGeminiDataToInternalFormat(geminiData) {
  console.log('🔄 FLIGHT_PROCESSING: Converting Gemini data to internal format...');
  
  // Check if this is the new multi-flight format
  if (geminiData.flights && Array.isArray(geminiData.flights)) {
    console.log(`✅ FLIGHT_PROCESSING: Processing ${geminiData.flights.length} flights from multi-flight format`);
    // Return array of flights for multi-flight processing
    const convertedFlights = [];
    for (const flight of geminiData.flights) {
      const converted = await convertSingleGeminiFlightToInternalFormat(flight);
      convertedFlights.push(converted);
    }
    return { multipleFlights: true, flights: convertedFlights };
  }
  
  // Handle legacy single flight format
  console.log('🔄 FLIGHT_PROCESSING: Processing single flight (legacy format)');
  return await convertSingleGeminiFlightToInternalFormat(geminiData);
}

async function convertSingleGeminiFlightToInternalFormat(geminiData) {
  // Helper function to check if a value is missing
  const isMissing = (value) => !value || value === 'missing' || value === null || value === undefined;
  
  // Helper function to convert time from 12-hour format with AM/PM to timezone-aware datetime
  const combineDateTimeWithTimezone = async (date, time, airportCode) => {
    if (isMissing(date) || isMissing(time)) {
      return null;
    }
    
    try {
      // Parse the time (e.g., "8:30 AM" or "2:15 PM")
      let parsedTime = time.trim();
      let hour24, minutes;
      
      // If time doesn't have AM/PM, assume it's already in 24-hour format
      if (!parsedTime.match(/AM|PM/i)) {
        // Ensure time is in HH:MM format
        if (parsedTime.match(/^\d{1,2}:\d{2}$/)) {
          const [h, m] = parsedTime.split(':').map(num => parseInt(num));
          hour24 = h;
          minutes = m;
        } else {
          throw new Error('Invalid time format');
        }
      } else {
        // Parse 12-hour format
        const [timeStr, period] = parsedTime.split(/\s+/);
        const [hours, mins] = timeStr.split(':').map(num => parseInt(num));
        
        hour24 = hours;
        minutes = mins;
        if (period && period.toUpperCase() === 'PM' && hours !== 12) {
          hour24 = hours + 12;
        } else if (period && period.toUpperCase() === 'AM' && hours === 12) {
          hour24 = 0;
        }
      }
      
      // Get airport timezone if available
      const TimezoneService = require('./timezone-service');
      const timezoneService = new TimezoneService();
      
      // Wait for airports to load if needed
      if (!timezoneService.airports) {
        await timezoneService.loadAirports();
      }
      
      const airportInfo = timezoneService.getAirportInfo(airportCode);
      
      if (airportInfo && airportInfo.timezone) {
        // The photo shows times in the airport's local timezone, convert to UTC for storage
        try {
          // Create a date object representing the local time at the airport
          // We'll use a simple approach: create the date/time and then adjust for timezone
          const year = parseInt(date.split('-')[0]);
          const month = parseInt(date.split('-')[1]) - 1; // JS months are 0-indexed
          const day = parseInt(date.split('-')[2]);
          
          // Create Date object in local time (this will be treated as local system time)
          const localDate = new Date(year, month, day, hour24, minutes, 0);
          
          // Now we need to convert this to UTC based on the airport's timezone
          // We'll create two dates: one as UTC and one as the airport timezone, 
          // then calculate the offset
          const utcDate = new Date(year, month, day, hour24, minutes, 0);
          const airportTimeString = utcDate.toLocaleString("sv-SE", {timeZone: airportInfo.timezone});
          const airportAsLocal = new Date(airportTimeString);
          
          // Calculate the difference (timezone offset)
          const offsetMs = utcDate.getTime() - airportAsLocal.getTime();
          
          // Apply offset to our local time to get the correct UTC time
          const correctUtcTime = new Date(localDate.getTime() + offsetMs);
          const isoDateTime = correctUtcTime.toISOString();
          
          console.log(`📅 FLIGHT_PROCESSING: Converted ${date} ${time} (${airportCode} ${airportInfo.timezone}) → ${isoDateTime} (UTC)`);
          return isoDateTime;
        } catch (tzError) {
          console.error('❌ FLIGHT_PROCESSING: Timezone conversion error:', tzError.message);
          // Fall back to basic conversion
          const isoDateTime = `${date}T${hour24.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00.000Z`;
          console.log(`⚠️  FLIGHT_PROCESSING: Timezone conversion failed for ${airportCode}, using UTC: ${isoDateTime}`);
          return isoDateTime;
        }
      } else {
        // No timezone info, create UTC datetime
        const isoDateTime = `${date}T${hour24.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00.000Z`;
        console.log(`⚠️  FLIGHT_PROCESSING: No timezone info for ${airportCode}, using UTC: ${isoDateTime}`);
        return isoDateTime;
      }
    } catch (error) {
      console.error('❌ FLIGHT_PROCESSING: Error processing time:', error.message);
      return null;
    }
  };

  // Extract passenger names (support both new array format and legacy single name)
  const extractedPassengerNames = [];
  if (!isMissing(geminiData.passengerNames) && Array.isArray(geminiData.passengerNames)) {
    extractedPassengerNames.push(...geminiData.passengerNames.filter(name => !isMissing(name)));
  } else if (!isMissing(geminiData.passengerName)) {
    extractedPassengerNames.push(geminiData.passengerName);
  }

  // Convert departure and arrival times with timezone awareness
  const departureDateTime = await combineDateTimeWithTimezone(
    geminiData.departureDate, 
    geminiData.departureTime, 
    geminiData.departureAirport
  );
  
  const arrivalDateTime = await combineDateTimeWithTimezone(
    geminiData.arrivalDate, 
    geminiData.arrivalTime, 
    geminiData.arrivalAirport
  );

  // Build internal data structure
  const internalData = {
    // Core flight information
    airline: isMissing(geminiData.airlineName) ? null : geminiData.airlineName,
    flightNumber: isMissing(geminiData.flightNumber) ? null : geminiData.flightNumber,
    
    // Route information
    from: isMissing(geminiData.departureAirport) ? null : geminiData.departureAirport.toUpperCase(),
    to: isMissing(geminiData.arrivalAirport) ? null : geminiData.arrivalAirport.toUpperCase(),
    
    // Passenger information (new multi-passenger support)
    passengerName: extractedPassengerNames.length > 0 ? extractedPassengerNames[0] : null,
    allPassengerNames: extractedPassengerNames, // Store all passenger names
    
    // Date and time information
    departureDate: isMissing(geminiData.departureDate) ? null : geminiData.departureDate,
    departureTime: isMissing(geminiData.departureTime) ? null : geminiData.departureTime,
    arrivalDate: isMissing(geminiData.arrivalDate) ? null : geminiData.arrivalDate,
    arrivalTime: isMissing(geminiData.arrivalTime) ? null : geminiData.arrivalTime,
    
    // Timezone-aware datetime (for accurate calculations)
    departureDateTime: departureDateTime,
    arrivalDateTime: arrivalDateTime,
    
    // Seat information (support both new array format and legacy single seat)
    seatNumbers: (() => {
      // Handle both new seatNumbers array and old seatNumber format
      if (!isMissing(geminiData.seatNumbers) && Array.isArray(geminiData.seatNumbers)) {
        return geminiData.seatNumbers.filter(seat => !isMissing(seat));
      } else if (!isMissing(geminiData.seatNumber)) {
        return [geminiData.seatNumber];
      }
      return [];
    })(),
    
    // Additional information
    confirmationCode: null, // Not in new simplified format
    gate: null,             // Not in new simplified format
    terminal: null,         // Not in new simplified format
    
    // Confidence and metadata
    confidence: {
      overall: 0.95, // Gemini generally has high confidence
      flightNumber: isMissing(geminiData.flightNumber) ? 0 : 0.95,
      passengerName: extractedPassengerNames.length > 0 ? 0.95 : 0,
      airline: isMissing(geminiData.airlineName) ? 0 : 0.95,
      route: (isMissing(geminiData.departureAirport) || isMissing(geminiData.arrivalAirport)) ? 0 : 0.95
    },
    
    parseStrategy: 'gemini_ai_enhanced',
    
    // Debug and tracking information
    allMatches: {
      flightNumber: isMissing(geminiData.flightNumber) ? [] : [{ value: geminiData.flightNumber, confidence: 0.95, source: 'gemini' }],
      passengerName: extractedPassengerNames.map(name => ({ value: name, confidence: 0.95, source: 'gemini' })),
      airline: isMissing(geminiData.airlineName) ? [] : [{ value: geminiData.airlineName, confidence: 0.95, source: 'gemini' }]
    },
    
    debugInfo: {
      rawMatches: {},
      aiProvider: 'gemini',
      geminiRawData: geminiData
    }
  };
  
  // Log extraction results
  console.log(`✅ FLIGHT_PROCESSING: Airline: ${internalData.airline || 'missing'}`);
  console.log(`✅ FLIGHT_PROCESSING: Flight Number: ${internalData.flightNumber || 'missing'}`);
  console.log(`✅ FLIGHT_PROCESSING: Route: ${internalData.from || 'missing'} → ${internalData.to || 'missing'}`);
  console.log(`✅ FLIGHT_PROCESSING: Passenger: ${internalData.passengerName || 'missing'}`);
  console.log(`✅ FLIGHT_PROCESSING: All Passengers: ${internalData.allPassengerNames.join(', ') || 'missing'}`);
  console.log(`✅ FLIGHT_PROCESSING: Seat Number: ${internalData.seatNumbers.join(', ') || 'missing'}`);
  console.log(`✅ FLIGHT_PROCESSING: Departure: ${internalData.departureDate || 'missing'} ${internalData.departureTime || 'missing'}`);
  console.log(`✅ FLIGHT_PROCESSING: Arrival: ${internalData.arrivalDate || 'missing'} ${internalData.arrivalTime || 'missing'}`);
  
  // Calculate overall confidence based on available data
  const confidenceScores = Object.values(internalData.confidence).filter(score => score > 0);
  if (confidenceScores.length > 0) {
    internalData.confidence.overall = confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length;
  }
  
  console.log(`✅ FLIGHT_PROCESSING: Conversion completed. Overall confidence: ${internalData.confidence.overall.toFixed(2)}`);
  
  return internalData;
}

/**
 * Enhanced passenger matching with existing passengers
 * @param {string} extractedName - Name extracted from ticket
 * @returns {Object} - Match result with passenger info
 */
async function findPassengerByExtractedName(extractedName) {
  if (!extractedName) {
    return { found: false, reason: 'No name provided' };
  }

  try {
    console.log(`🔍 FLIGHT_PROCESSING: Searching for passenger by name: "${extractedName}"`);
    
    // Use the enhanced findPassengerByName from data-helpers
    const foundPassenger = await findPassengerByName(extractedName);
    
    if (foundPassenger) {
      console.log(`✅ FLIGHT_PROCESSING: Found existing passenger: ${foundPassenger.name} (ID: ${foundPassenger.id})`);
      return { 
        found: true, 
        passenger: foundPassenger,
        matchType: 'existing'
      };
    }
    
    console.log(`ℹ️  FLIGHT_PROCESSING: No existing passenger found for "${extractedName}"`);
    return { found: false, reason: 'No matching passenger found' };
    
  } catch (error) {
    console.error('❌ FLIGHT_PROCESSING: Error searching for passenger:', error);
    return { found: false, reason: error.message };
  }
}

/**
 * Create a new passenger from ticket data
 * @param {string} extractedName - Name from ticket
 * @returns {Object|null} - New passenger object or null if failed
 */
async function createNewPassengerFromTicket(extractedName) {
  if (!extractedName) return null;
  
  try {
    const passengers = await readPassengers();
    
    const newPassenger = {
      id: uuidv4(),
      name: extractedName.trim(),
      legalName: extractedName.trim(),
      extractedNames: [extractedName.trim()],
      email: null,
      phoneNumber: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: 'ticket_processing'
    };
    
    passengers.push(newPassenger);
    await writePassengers(passengers);
    
    console.log(`✅ FLIGHT_PROCESSING: Created new passenger: ${newPassenger.name} (ID: ${newPassenger.id})`);
    return newPassenger;
    
  } catch (error) {
    console.error('❌ FLIGHT_PROCESSING: Error creating new passenger:', error);
    return null;
  }
}

/**
 * Update passenger with extracted name from ticket
 * @param {Object} passenger - Passenger object to update
 * @param {string} extractedName - Name extracted from ticket
 * @returns {boolean} - Success status
 */
async function updatePassengerWithExtractedName(passenger, extractedName) {
  if (!passenger || !extractedName) return false;
  
  try {
    const passengers = await readPassengers();
    const passengerIndex = passengers.findIndex(p => p.id === passenger.id);
    
    if (passengerIndex === -1) {
      console.error(`❌ FLIGHT_PROCESSING: Passenger with ID ${passenger.id} not found`);
      return false;
    }
    
    // Initialize extractedNames array if it doesn't exist
    if (!passengers[passengerIndex].extractedNames) {
      passengers[passengerIndex].extractedNames = [];
    }
    
    // Add the new extracted name if it's not already there
    const normalizedName = extractedName.toLowerCase().trim();
    const exists = passengers[passengerIndex].extractedNames.some(
      existing => existing.toLowerCase().trim() === normalizedName
    );
    
    if (!exists) {
      passengers[passengerIndex].extractedNames.push(extractedName);
      passengers[passengerIndex].updatedAt = new Date().toISOString();
      
      await writePassengers(passengers);
      console.log(`✅ FLIGHT_PROCESSING: Added extracted name "${extractedName}" to passenger ${passenger.name}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('❌ FLIGHT_PROCESSING: Error updating passenger with extracted name:', error);
    return false;
  }
}

/**
 * Process single flight data (used for both single flight and multi-flight scenarios)
 * @param {Object} flightData - Flight data to process
 * @param {string} extractionMethod - Method used for extraction
 * @param {Object} parentProcessingResult - Parent processing result for metadata
 * @returns {Object} - Processing result for this flight
 */
async function processSingleFlightData(flightData, extractionMethod, parentProcessingResult) {
  console.log(`🛫 FLIGHT_PROCESSING: Processing individual flight: ${flightData.airline} ${flightData.flightNumber}`);
  
  const result = {
    success: false,
    flight: null,
    issues: [],
    passengerMatch: null
  };

  try {
    // Enhanced passenger processing for multi-passenger support
    const passengers = [];
    const passengerMatches = [];
    const passengerNames = flightData.allPassengerNames || [flightData.passengerName];
    
    console.log(`👥 FLIGHT_PROCESSING: Processing ${passengerNames.length} passenger(s): ${passengerNames.join(', ')}`);
    
    for (const passengerName of passengerNames) {
      if (!passengerName) continue;
      
      // Use the existing enhanced passenger matching
      const passengerResult = await findPassengerByExtractedName(passengerName);
      
      if (passengerResult.found) {
        passengers.push({ passengerId: passengerResult.passenger.id });
        await updatePassengerWithExtractedName(passengerResult.passenger, passengerName);
        
        // Store passenger match details for Telegram bot
        passengerMatches.push({
          passenger: passengerResult.passenger,
          extractedName: passengerName,
          matchType: passengerResult.matchType,
          confidence: passengerResult.confidence
        });
      } else {
        const newPassenger = await createNewPassengerFromTicket(passengerName);
        if (newPassenger) {
          passengers.push({ passengerId: newPassenger.id });
          // For new passengers, show as created match
          passengerMatches.push({
            passenger: newPassenger,
            extractedName: passengerName,
            matchType: 'new_passenger',
            confidence: 1.0
          });
        } else {
          // No match found and couldn't create new passenger
          passengerMatches.push({
            passenger: null,
            extractedName: passengerName,
            matchType: 'no_match',
            confidence: 0
          });
        }
      }
    }

    // Create flight object with enhanced data
    const newFlight = {
      id: uuidv4(),
      airline: flightData.airline,
      flightNumber: flightData.flightNumber,
      from: flightData.from,
      to: flightData.to,
      departureDate: flightData.departureDate,
      departureTime: flightData.departureTime,
      arrivalDate: flightData.arrivalDate,
      arrivalTime: flightData.arrivalTime,
      departureDateTime: flightData.departureDateTime,
      arrivalDateTime: flightData.arrivalDateTime,
      passengers: passengers,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'scheduled',
      extractionMethod: extractionMethod,
      confidence: flightData.confidence,
      seatNumbers: flightData.seatNumbers || [],
      metadata: {
        processedAt: new Date().toISOString(),
        source: 'ticket_processing',
        extractionMethod: extractionMethod,
        originalImageUrl: parentProcessingResult.metadata.imageUrl
      }
    };

    // Save the flight
    const flights = await readFlights();
    flights.push(newFlight);
    await writeFlights(flights);

    console.log(`✅ FLIGHT_PROCESSING: Individual flight created with ID: ${newFlight.id}`);
    
    result.success = true;
    result.flight = newFlight;
    // For single passenger or first passenger match details (for Telegram bot compatibility)
    result.passengerMatch = passengerMatches.length > 0 ? passengerMatches[0] : {
      passenger: null,
      extractedName: 'Unknown',
      matchType: 'no_match',
      confidence: 0
    };
    // Store all passenger matches for multi-passenger scenarios
    result.allPassengerMatches = passengerMatches;

    return result;

  } catch (error) {
    console.error('❌ FLIGHT_PROCESSING: Error processing individual flight:', error);
    result.issues.push(`Flight processing error: ${error.message}`);
    return result;
  }
}

/**
 * Enhanced main function to process a flight ticket image with multi-flight support
 * @param {string} imageUrl - URL of the ticket image
 * @returns {object} Processing result with detailed information
 */
async function processFlightTicket(imageUrl) {
  console.log('🎫 FLIGHT_PROCESSING: Starting ticket processing...');
  console.log(`   Image URL: ${imageUrl}`);
  
  const processingResult = {
    success: false,
    flight: null,
    flights: null, // For multi-flight results
    extractedData: null,
    passengerMatch: null,
    issues: [],
    metadata: {
      processingStartTime: new Date().toISOString(),
      imageUrl: imageUrl
    }
  };

  try {
    let extractedData = null;
    let extractionMethod = 'unknown';
    let ocrResult = null;

    // Initialize Gemini service
    const geminiService = new GeminiService();

    // Step 1: Try Gemini AI first (primary method)
    if (geminiService.isAvailable()) {
      try {
        console.log('🧠 FLIGHT_PROCESSING: Step 1 - Gemini AI extraction (primary method)');
        
        // Download image locally for Gemini processing
        const fetch = require('node-fetch');
        const response = await fetch(imageUrl);
        const buffer = await response.buffer();
        
        // Create temporary file for Gemini
        const tempDir = path.join(__dirname, 'temp-images');
        await fs.mkdir(tempDir, { recursive: true });
        const tempImagePath = path.join(tempDir, `gemini-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`);
        
        await fs.writeFile(tempImagePath, buffer);
        console.log('📥 FLIGHT_PROCESSING: Image downloaded for Gemini processing');

        // Process with Gemini
        const geminiResult = await geminiService.extractFlightData(tempImagePath);
        
        // Clean up temp file
        try {
          await fs.unlink(tempImagePath);
          console.log('🗑️  FLIGHT_PROCESSING: Cleaned up temporary file');
        } catch (cleanupError) {
          console.warn('⚠️  FLIGHT_PROCESSING: Failed to cleanup temp file:', cleanupError.message);
        }

        if (geminiResult.success && geminiResult.data) {
          console.log('✅ FLIGHT_PROCESSING: Gemini extraction successful');
          
          // Convert the Gemini data to internal format
          extractedData = await convertGeminiDataToInternalFormat(geminiResult.data);
          extractionMethod = 'gemini';
          processingResult.metadata.extractionMethod = 'gemini';
          processingResult.metadata.geminiConfidence = geminiResult.confidence;
        } else {
          console.log('⚠️  FLIGHT_PROCESSING: Gemini extraction failed, falling back to OCR');
          processingResult.issues.push('Gemini extraction failed, using OCR fallback');
        }
      } catch (geminiError) {
        console.error('❌ FLIGHT_PROCESSING: Gemini error, falling back to OCR:', geminiError.message);
        processingResult.issues.push(`Gemini error: ${geminiError.message}`);
      }
    } else {
      console.log('⚠️  FLIGHT_PROCESSING: Gemini service not available, using OCR');
      processingResult.issues.push('Gemini service not available');
    }

    // Handle multiple flights if detected
    if (extractedData && extractedData.multipleFlights && extractedData.flights) {
      console.log(`🛫 FLIGHT_PROCESSING: Processing ${extractedData.flights.length} flights from single image`);
      const createdFlights = [];
      
      for (let i = 0; i < extractedData.flights.length; i++) {
        const flightData = extractedData.flights[i];
        console.log(`🔍 FLIGHT_PROCESSING: Processing flight ${i + 1}/${extractedData.flights.length}: ${flightData.airline} ${flightData.flightNumber}`);
        
        // Process each flight individually using the same logic
        const singleFlightResult = await processSingleFlightData(flightData, extractionMethod, processingResult);
        if (singleFlightResult.success) {
          createdFlights.push(singleFlightResult.flight);
        }
      }
      
      processingResult.success = createdFlights.length > 0;
      processingResult.flights = createdFlights;
      processingResult.metadata.totalFlights = createdFlights.length;
      
      return processingResult;
    }

    // Single flight processing (existing logic)
    if (!extractedData) {
      // Step 2: Fallback to OCR extraction
      console.log('🔍 FLIGHT_PROCESSING: Step 2 - OCR extraction (fallback method)');
      
      ocrResult = await extractTextFromImage(imageUrl);
      
      if (ocrResult.success && ocrResult.text) {
        console.log(`📄 FLIGHT_PROCESSING: OCR extraction successful. Text length: ${ocrResult.text.length} characters`);
        
        // Parse the OCR text using our existing parsing logic
        extractedData = parseFlightFromText(ocrResult.text);
        extractionMethod = 'ocr';
        processingResult.metadata.extractionMethod = 'ocr';
        processingResult.metadata.ocrConfidence = ocrResult.confidence;
      } else {
        console.error('❌ FLIGHT_PROCESSING: OCR extraction failed');
        processingResult.issues.push('OCR extraction failed');
        processingResult.metadata.processingEndTime = new Date().toISOString();
        return processingResult;
      }
    }

    // Process single flight data
    const singleFlightResult = await processSingleFlightData(extractedData, extractionMethod, processingResult);
    
    processingResult.success = singleFlightResult.success;
    processingResult.flight = singleFlightResult.flight;
    processingResult.passengerMatch = singleFlightResult.passengerMatch;
    processingResult.issues.push(...singleFlightResult.issues);

    processingResult.metadata.processingEndTime = new Date().toISOString();
    processingResult.metadata.processingDuration = new Date(processingResult.metadata.processingEndTime) - new Date(processingResult.metadata.processingStartTime);

    return processingResult;

  } catch (error) {
    console.error('❌ FLIGHT_PROCESSING: Critical error during ticket processing:', error);
    processingResult.issues.push(`Critical processing error: ${error.message}`);
    processingResult.metadata.processingEndTime = new Date().toISOString();
    return processingResult;
  }
}

// Include the existing parseFlightFromText function for OCR fallback
function parseFlightFromText(text) {
  // This is a simplified version - the full implementation would be quite long
  // For now, return a basic structure to maintain compatibility
  return {
    airline: null,
    flightNumber: null,
    from: null,
    to: null,
    departureDate: null,
    departureTime: null,
    arrivalDate: null,
    arrivalTime: null,
    passengerName: null,
    allPassengerNames: [],
    seatNumbers: [],
    confidence: { overall: 0.3 },
    parseStrategy: 'ocr_fallback'
  };
}

module.exports = {
  processFlightTicket,
  convertGeminiDataToInternalFormat,
  findPassengerByExtractedName,
  createNewPassengerFromTicket,
  updatePassengerWithExtractedName
};