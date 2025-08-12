const fs = require('fs').promises;
const path = require('path');
const { extractTextFromImage } = require('./ocr-service');
const GeminiService = require('./gemini-service');
const { v4: uuidv4 } = require('uuid');

const passengersFilePath = path.join(__dirname, 'passengers.json');
const flightsFilePath = path.join(__dirname, 'flights.json');

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
 * Convert Gemini extracted data to our internal format
 * @param {Object} geminiData - Data from Gemini API (new simplified format)
 * @returns {Object} - Data in our internal format
 */
function convertGeminiDataToInternalFormat(geminiData) {
  console.log('🔄 FLIGHT_PROCESSING: Converting Gemini data to internal format...');
  
  // Helper function to check if a value is missing
  const isMissing = (value) => !value || value === 'missing' || value === null || value === undefined;
  
  // Initialize the internal format structure
  const internalData = {
    // Basic flight information
    flightNumber: isMissing(geminiData.flightNumber) ? null : geminiData.flightNumber,
    airline: isMissing(geminiData.airlineName) ? null : geminiData.airlineName,
    
    // Route information
    from: isMissing(geminiData.departureAirport) ? null : geminiData.departureAirport?.toUpperCase(),
    to: isMissing(geminiData.arrivalAirport) ? null : geminiData.arrivalAirport?.toUpperCase(),
    fromCity: null, // Not provided in new format
    toCity: null,   // Not provided in new format
    
    // Date and time information
    departureDate: isMissing(geminiData.departureDate) ? null : geminiData.departureDate,
    departureTime: isMissing(geminiData.departureTime) ? null : geminiData.departureTime,
    arrivalDate: isMissing(geminiData.arrivalDate) ? null : geminiData.arrivalDate,
    arrivalTime: isMissing(geminiData.arrivalTime) ? null : geminiData.arrivalTime,
    
    // Passenger information
    passengerName: isMissing(geminiData.passengerName) ? null : geminiData.passengerName,
    seatNumbers: isMissing(geminiData.seatNumber) ? [] : [geminiData.seatNumber],
    
    // Additional information
    confirmationCode: null, // Not in new simplified format
    gate: null,             // Not in new simplified format
    terminal: null,         // Not in new simplified format
    
    // Confidence and metadata
    confidence: {
      overall: 0.95, // Gemini generally has high confidence
      flightNumber: isMissing(geminiData.flightNumber) ? 0 : 0.95,
      passengerName: isMissing(geminiData.passengerName) ? 0 : 0.95,
      airline: isMissing(geminiData.airlineName) ? 0 : 0.95,
      route: (isMissing(geminiData.departureAirport) || isMissing(geminiData.arrivalAirport)) ? 0 : 0.95
    },
    
    parseStrategy: 'gemini_ai_simplified',
    
    // Debug and tracking information
    allMatches: {
      flightNumber: isMissing(geminiData.flightNumber) ? [] : [{ value: geminiData.flightNumber, confidence: 0.95, source: 'gemini' }],
      passengerName: isMissing(geminiData.passengerName) ? [] : [{ value: geminiData.passengerName, confidence: 0.95, source: 'gemini' }],
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
 * Enhanced passenger matching with fuzzy search and multiple strategies
 * @param {string} extractedName - The name extracted from the ticket OCR
 * @returns {Promise<object>} Match result with passenger and match details
 */
async function findPassengerByExtractedName(extractedName) {
  console.log(`🔍 FLIGHT_PROCESSING: Searching for passenger: "${extractedName}"`);
  
  const passengersData = await fs.readFile(passengersFilePath, 'utf-8');
  const passengers = JSON.parse(passengersData);
  
  const normalizedExtracted = extractedName.toLowerCase().replace(/,(?=\S)/g, ', ').replace(/\s+/g, ' ').trim();

  // Strategy 1: Exact legal name match
  console.log('🎯 FLIGHT_PROCESSING: Trying exact legal name match...');
  for (const passenger of passengers) {
    if (!passenger.legalName) continue;
    const legalName = passenger.legalName.toLowerCase().trim();

    if (legalName === normalizedExtracted) {
      console.log(`✅ FLIGHT_PROCESSING: Found exact legal name match: ${passenger.name}`);
      return { 
        passenger, 
        matchType: 'legal_exact',
        confidence: 1.0,
        extractedName 
      };
    }

    // Try reversed format (Last, First)
    const parts = legalName.split(' ');
    if (parts.length >= 2) {
      const firstName = parts.slice(0, -1).join(' ');
      const lastName = parts[parts.length - 1];
      if (`${lastName}, ${firstName}` === normalizedExtracted) {
        console.log(`✅ FLIGHT_PROCESSING: Found legal name match (reversed format): ${passenger.name}`);
        return { 
          passenger, 
          matchType: 'legal_reversed',
          confidence: 1.0,
          extractedName 
        };
      }
    }
  }

  // Strategy 2: Exact display name match
  console.log('🎯 FLIGHT_PROCESSING: Trying exact display name match...');
  for (const passenger of passengers) {
    const displayName = passenger.name.toLowerCase().trim();
    if (displayName === normalizedExtracted) {
      console.log(`✅ FLIGHT_PROCESSING: Found exact display name match: ${passenger.name}`);
      return { 
        passenger, 
        matchType: 'display_exact',
        confidence: 1.0,
        extractedName 
      };
    }
  }

  // Strategy 3: Check existing extracted names
  console.log('🎯 FLIGHT_PROCESSING: Checking existing extracted names...');
  for (const passenger of passengers) {
    if (passenger.extractedNames && Array.isArray(passenger.extractedNames)) {
      for (const existingExtracted of passenger.extractedNames) {
        if (existingExtracted.toLowerCase().trim() === normalizedExtracted) {
          console.log(`✅ FLIGHT_PROCESSING: Found match via existing extracted name: ${passenger.name}`);
          return { 
            passenger, 
            matchType: 'extracted_existing',
            confidence: 0.9,
            extractedName 
          };
        }
      }
    }
  }

  // Strategy 4: Fuzzy matching (if library available)
  if (fuzzy) {
    console.log('🎯 FLIGHT_PROCESSING: Trying fuzzy matching...');
    
    // Create fuzzy sets for legal names and display names
    const legalNames = passengers.filter(p => p.legalName).map(p => p.legalName.toLowerCase());
    const displayNames = passengers.map(p => p.name.toLowerCase());
    
    const legalFuzzySet = fuzzy(legalNames);
    const displayFuzzySet = fuzzy(displayNames);
    
    // Try fuzzy match on legal names first
    const legalMatches = legalFuzzySet.get(normalizedExtracted);
    if (legalMatches && legalMatches.length > 0 && legalMatches[0][0] > 0.7) {
      const matchedLegalName = legalMatches[0][1];
      const passenger = passengers.find(p => p.legalName?.toLowerCase() === matchedLegalName);
      if (passenger) {
        console.log(`✅ FLIGHT_PROCESSING: Found fuzzy legal name match: ${passenger.name} (confidence: ${legalMatches[0][0]})`);
        return { 
          passenger, 
          matchType: 'legal_fuzzy',
          confidence: legalMatches[0][0],
          extractedName 
        };
      }
    }
    
    // Try fuzzy match on display names
    const displayMatches = displayFuzzySet.get(normalizedExtracted);
    if (displayMatches && displayMatches.length > 0 && displayMatches[0][0] > 0.7) {
      const matchedDisplayName = displayMatches[0][1];
      const passenger = passengers.find(p => p.name.toLowerCase() === matchedDisplayName);
      if (passenger) {
        console.log(`✅ FLIGHT_PROCESSING: Found fuzzy display name match: ${passenger.name} (confidence: ${displayMatches[0][0]})`);
        return { 
          passenger, 
          matchType: 'display_fuzzy',
          confidence: displayMatches[0][0],
          extractedName 
        };
      }
    }
  }

  console.log(`❌ FLIGHT_PROCESSING: No passenger match found for: "${extractedName}"`);
  return { 
    passenger: null, 
    matchType: 'no_match',
    confidence: 0,
    extractedName,
    requiresManualLinking: true 
  };
}

/**
 * Create a new passenger from extracted ticket data
 * @param {string} extractedName - The name extracted from the ticket
 * @returns {Promise<Object>} The newly created passenger
 */
async function createNewPassengerFromTicket(extractedName) {
  console.log(`🆕 FLIGHT_PROCESSING: Creating new passenger: "${extractedName}"`);
  
  try {
    const passengersData = await fs.readFile(passengersFilePath, 'utf-8');
    const passengers = JSON.parse(passengersData);
    
    // Create a new passenger with extracted name
    const newPassenger = {
      id: uuidv4(),
      name: extractedName, // Use extracted name as display name
      legalName: extractedName, // Use same for legal name initially
      phone: null,
      telegramChatId: null,
      extractedNames: [extractedName],
      flightCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'ticket_processing_auto'
    };
    
    // Add to passengers array
    passengers.push(newPassenger);
    
    // Save back to file
    await fs.writeFile(passengersFilePath, JSON.stringify(passengers, null, 2));
    
    console.log(`✅ FLIGHT_PROCESSING: Created new passenger: ${newPassenger.name} (ID: ${newPassenger.id})`);
    
    return newPassenger;
  } catch (error) {
    console.error('❌ FLIGHT_PROCESSING: Error creating new passenger:', error);
    throw new Error(`Failed to create new passenger: ${error.message}`);
  }
}

/**
 * Legacy function for backward compatibility
 */
async function findPassengerByLegalName(extractedName) {
  const result = await findPassengerByExtractedName(extractedName);
  return result.passenger;
}

/**
 * Detect airline from text content
 * @param {string} text - The OCR text to analyze
 * @returns {string|null} Detected airline key or null
 */
function detectAirline(text) {
  console.log('🔍 FLIGHT_PROCESSING: Detecting airline...');
  
  const upperText = text.toUpperCase();
  
  for (const [airlineKey, airline] of Object.entries(AIRLINE_PATTERNS)) {
    for (const code of airline.codes) {
      if (upperText.includes(code)) {
        console.log(`✅ FLIGHT_PROCESSING: Detected airline: ${airline.name}`);
        return airlineKey;
      }
    }
  }
  
  console.log('⚠️  FLIGHT_PROCESSING: No specific airline detected, using generic patterns');
  return null;
}

/**
 * Enhanced flight data parsing with airline-specific patterns
 * @param {string} text - The raw text from OCR
 * @param {object} metadata - OCR metadata for additional context
 * @returns {object} Parsed flight data with confidence scores
 */
function parseFlightDataWithMultipleStrategies(text, metadata = {}) {
  console.log('🔍 FLIGHT_PROCESSING: Starting enhanced flight data parsing...');
  console.log(`   Text length: ${text.length} characters`);
  
  const extractedData = {
    airline: null,
    flightNumber: null,
    passengerName: null,
    confirmationCode: null,
    date: null,
    departureTime: null,
    arrivalTime: null,
    from: null,
    to: null,
    seat: null,
    parseStrategy: null,
    confidence: {},
    allMatches: {},
    debugInfo: {
      detectedAirline: null,
      patternsUsed: [],
      rawMatches: {}
    }
  };

  // Step 1: Detect airline
  const detectedAirline = detectAirline(text);
  extractedData.debugInfo.detectedAirline = detectedAirline;
  
  // Step 2: Try airline-specific patterns first
  let patterns = null;
  if (detectedAirline && AIRLINE_PATTERNS[detectedAirline]) {
    patterns = AIRLINE_PATTERNS[detectedAirline];
    extractedData.airline = patterns.name;
    extractedData.parseStrategy = `airline_specific_${detectedAirline.toLowerCase()}`;
    extractedData.debugInfo.patternsUsed.push(`airline_${detectedAirline}`);
    console.log(`🎯 FLIGHT_PROCESSING: Using ${patterns.name} specific patterns`);
  } else {
    extractedData.parseStrategy = 'generic_patterns';
    extractedData.debugInfo.patternsUsed.push('generic');
    console.log('🎯 FLIGHT_PROCESSING: Using generic patterns');
  }

  // Step 3: Extract flight number
  console.log('🔍 FLIGHT_PROCESSING: Extracting flight number...');
  let flightMatches = [];
  
  if (patterns && patterns.flightRegex) {
    const match = text.match(patterns.flightRegex);
    if (match) {
      const flightNum = match[1] ? `${match[0].split(/\s+/)[0].replace(/[^\w]/g, '')}${match[1]}` : match[0].replace(/\s+/g, '');
      flightMatches.push({ value: flightNum, confidence: 0.9, source: 'airline_specific' });
    }
  }
  
  // Fallback to generic pattern
  const genericFlightMatches = text.match(GENERIC_PATTERNS.flightRegex);
  if (genericFlightMatches) {
    genericFlightMatches.forEach(match => {
      const clean = match.replace(/\s+/g, '');
      if (!flightMatches.find(m => m.value === clean)) {
        flightMatches.push({ value: clean, confidence: 0.7, source: 'generic' });
      }
    });
  }
  
  if (flightMatches.length > 0) {
    // Use highest confidence match
    flightMatches.sort((a, b) => b.confidence - a.confidence);
    extractedData.flightNumber = flightMatches[0].value;
    extractedData.confidence.flightNumber = flightMatches[0].confidence;
    console.log(`✅ FLIGHT_PROCESSING: Found flight number: ${extractedData.flightNumber}`);
  }
  
  extractedData.allMatches.flightNumber = flightMatches;
  extractedData.debugInfo.rawMatches.flightNumber = genericFlightMatches;

  // Step 4: Extract passenger name and seat number
  console.log('🔍 FLIGHT_PROCESSING: Extracting passenger name...');
  let passengerMatches = [];
  let seatNumbers = [];
  
  if (patterns && patterns.passengerRegex) {
    const match = text.match(patterns.passengerRegex);
    if (match) {
      // Handle both formats: "name: JOHN DOE" (match[1]) and "JOHN DOE - 24A" (match[2])
      const cleanName = (match[1] || match[2])?.trim().replace(/\s+/g, ' ');
      if (cleanName && cleanName.length >= 3) {
        passengerMatches.push({ value: cleanName, confidence: 0.9, source: 'airline_specific' });
        
        // Extract seat number if present in the second format
        if (match[2]) {
          const fullMatch = match[0];
          const seatMatch = fullMatch.match(/(\d+[A-F])/);
          if (seatMatch) {
            seatNumbers.push(seatMatch[1]);
          }
        }
      }
    }
  }
  
  // Fallback to generic patterns
  const genericPassengerMatches = Array.from(text.matchAll(GENERIC_PATTERNS.passengerRegex));
  genericPassengerMatches.forEach(match => {
    // Handle both formats: "name: JOHN DOE" (match[1]) and "JOHN DOE - 24A" (match[2])
    const cleanName = (match[1] || match[2])?.trim().replace(/\s+/g, ' ');
    if (cleanName && cleanName.length >= 3 && !passengerMatches.find(m => m.value.toLowerCase() === cleanName.toLowerCase())) {
      passengerMatches.push({ value: cleanName, confidence: 0.7, source: 'generic' });
      
      // Extract seat number if present in the second format
      if (match[2]) {
        const fullMatch = match[0];
        const seatMatch = fullMatch.match(/(\d+[A-F])/);
        if (seatMatch && !seatNumbers.includes(seatMatch[1])) {
          seatNumbers.push(seatMatch[1]);
        }
      }
    }
  });
  
  if (passengerMatches.length > 0) {
    passengerMatches.sort((a, b) => b.confidence - a.confidence);
    extractedData.passengerName = passengerMatches[0].value;
    extractedData.confidence.passengerName = passengerMatches[0].confidence;
    console.log(`✅ FLIGHT_PROCESSING: Found passenger name: ${extractedData.passengerName}`);
  }
  
  // Add seat numbers to extracted data
  if (seatNumbers.length > 0) {
    extractedData.seatNumbers = seatNumbers;
    console.log(`✅ FLIGHT_PROCESSING: Found seat numbers: ${seatNumbers.join(', ')}`);
  }
  
  extractedData.allMatches.passengerName = passengerMatches;

  // Step 5: Extract route (airports)
  console.log('🔍 FLIGHT_PROCESSING: Extracting route information...');
  let routeMatches = [];
  
  const routeRegex = patterns?.routeRegex || GENERIC_PATTERNS.routeRegex;
  const routeMatch = text.match(routeRegex);
  if (routeMatch && routeMatch[1] && routeMatch[2]) {
    extractedData.from = routeMatch[1].toUpperCase();
    extractedData.to = routeMatch[2].toUpperCase();
    extractedData.confidence.route = patterns ? 0.9 : 0.7;
    console.log(`✅ FLIGHT_PROCESSING: Found route: ${extractedData.from} → ${extractedData.to}`);
  }

  // Step 6: Extract other data
  console.log('🔍 FLIGHT_PROCESSING: Extracting additional information...');
  
  // Confirmation code
  const confirmationRegex = patterns?.confirmationRegex || GENERIC_PATTERNS.confirmationRegex;
  const confirmationMatch = text.match(confirmationRegex);
  if (confirmationMatch && confirmationMatch[1]) {
    extractedData.confirmationCode = confirmationMatch[1];
    extractedData.confidence.confirmationCode = patterns ? 0.9 : 0.7;
    console.log(`✅ FLIGHT_PROCESSING: Found confirmation code: ${extractedData.confirmationCode}`);
  }

  // Date
  const dateRegex = patterns?.dateRegex || GENERIC_PATTERNS.dateRegex;
  const dateMatch = text.match(dateRegex);
  if (dateMatch && dateMatch[1]) {
    extractedData.date = dateMatch[1];
    extractedData.confidence.date = patterns ? 0.9 : 0.7;
    console.log(`✅ FLIGHT_PROCESSING: Found date: ${extractedData.date}`);
  }

  // Times
  const timeMatches = text.match(GENERIC_PATTERNS.timeRegex);
  if (timeMatches && timeMatches.length >= 1) {
    extractedData.departureTime = timeMatches[0];
    if (timeMatches.length >= 2) {
      extractedData.arrivalTime = timeMatches[1];
    }
    extractedData.confidence.time = 0.7;
    console.log(`✅ FLIGHT_PROCESSING: Found times: ${timeMatches.join(', ')}`);
  }

  // Seat
  const seatMatch = text.match(GENERIC_PATTERNS.seatRegex);
  if (seatMatch && seatMatch[1]) {
    extractedData.seat = seatMatch[1];
    extractedData.confidence.seat = 0.8;
    console.log(`✅ FLIGHT_PROCESSING: Found seat: ${extractedData.seat}`);
  }

  // Calculate overall confidence
  const confidenceValues = Object.values(extractedData.confidence);
  const overallConfidence = confidenceValues.length > 0 
    ? confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length 
    : 0;
  extractedData.confidence.overall = overallConfidence;

  console.log(`📊 FLIGHT_PROCESSING: Parsing completed with overall confidence: ${overallConfidence.toFixed(2)}`);
  console.log(`   Strategy: ${extractedData.parseStrategy}`);
  console.log(`   Fields extracted: ${Object.keys(extractedData.confidence).filter(k => k !== 'overall').length}`);

  return extractedData;
}

/**
 * Legacy function for backward compatibility
 */
function parseFlightData(text) {
  const result = parseFlightDataWithMultipleStrategies(text);
  return {
    flightNumber: result.flightNumber,
    passengerName: result.passengerName,
    airline: result.airline,
    from: result.from,
    to: result.to,
    departureDateTime: null,
    arrivalDateTime: null
  };
}


/**
 * Updates passenger with extracted name for future matching
 * @param {object} passenger - The passenger object to update
 * @param {string} extractedName - The newly extracted name to add
 */
async function updatePassengerWithExtractedName(passenger, extractedName) {
  try {
    const passengersData = await fs.readFile(passengersFilePath, 'utf-8');
    const passengers = JSON.parse(passengersData);
    
    const passengerIndex = passengers.findIndex(p => p.id === passenger.id);
    if (passengerIndex === -1) return false;
    
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
      
      await fs.writeFile(passengersFilePath, JSON.stringify(passengers, null, 2));
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
 * Enhanced main function to process a flight ticket image with improved error handling
 * @param {string} imageUrl - URL of the ticket image
 * @returns {object} Processing result with detailed information
 */
async function processFlightTicket(imageUrl) {
  console.log('🎫 FLIGHT_PROCESSING: Starting ticket processing...');
  console.log(`   Image URL: ${imageUrl}`);
  
  const processingResult = {
    success: false,
    flight: null,
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
          console.log('📊 FLIGHT_PROCESSING: Gemini summary:', geminiService.getDataSummary(geminiResult));
          
          // Convert Gemini data to our internal format
          extractedData = convertGeminiDataToInternalFormat(geminiResult.data);
          extractionMethod = 'gemini';
          processingResult.metadata.extractionMethod = 'gemini';
          processingResult.metadata.geminiConfidence = geminiResult.confidence;
        } else {
          console.log('⚠️  FLIGHT_PROCESSING: Gemini extraction failed, falling back to OCR');
        }
      } catch (geminiError) {
        console.error('❌ FLIGHT_PROCESSING: Gemini error:', geminiError.message);
        console.log('🔄 FLIGHT_PROCESSING: Falling back to OCR method');
      }
    } else {
      console.log('⚠️  FLIGHT_PROCESSING: Gemini service not available, using OCR method');
    }

    // Step 1B: Fallback to OCR method if Gemini failed
    if (!extractedData) {
      console.log('🔍 FLIGHT_PROCESSING: Step 1B - OCR text extraction (fallback method)');
      ocrResult = await extractTextFromImage(imageUrl);
      
      if (!ocrResult.success) {
        throw new Error(`Both Gemini and OCR failed. OCR error: ${ocrResult.error}`);
      }
      
      console.log(`✅ FLIGHT_PROCESSING: OCR successful - ${ocrResult.fullText.length} characters extracted`);
      processingResult.metadata.ocrResult = ocrResult.metadata;
      processingResult.metadata.extractionMethod = 'ocr';

      // Step 2: Parse flight data using enhanced parsing
      console.log('🔍 FLIGHT_PROCESSING: Step 2 - Enhanced data parsing (OCR)');
      extractedData = parseFlightDataWithMultipleStrategies(ocrResult.fullText, ocrResult.metadata);
      extractionMethod = 'ocr';
    }

    processingResult.extractedData = extractedData;
    console.log(`📊 FLIGHT_PROCESSING: Data extraction completed using ${extractionMethod} method`);
    
    console.log(`📊 FLIGHT_PROCESSING: Parsing completed with ${extractedData.confidence.overall?.toFixed(2) || 0} overall confidence`);

    // Step 3: Validate minimum required data
    const requiredFields = [];
    if (!extractedData.flightNumber) requiredFields.push('flightNumber');
    if (!extractedData.passengerName) requiredFields.push('passengerName');
    
    if (requiredFields.length > 0) {
      const issue = `Missing required fields: ${requiredFields.join(', ')}`;
      processingResult.issues.push(issue);
      throw new Error(issue);
    }

    // Step 4: Enhanced passenger matching
    console.log('🔍 FLIGHT_PROCESSING: Step 3 - Enhanced passenger matching');
    const passengerMatch = await findPassengerByExtractedName(extractedData.passengerName);
    processingResult.passengerMatch = passengerMatch;
    
    console.log(`👤 FLIGHT_PROCESSING: Passenger match result: ${passengerMatch.matchType} (confidence: ${passengerMatch.confidence})`);

    // Step 5: Handle passenger matching results
    let passengers = [];
    if (passengerMatch.passenger) {
      // Update passenger with extracted name for future reference
      if (passengerMatch.matchType !== 'extracted_existing') {
        await updatePassengerWithExtractedName(passengerMatch.passenger, extractedData.passengerName);
      }
      passengers = [{ 
        id: passengerMatch.passenger.id, 
        name: passengerMatch.passenger.name,
        extractedName: extractedData.passengerName,
        matchType: passengerMatch.matchType,
        matchConfidence: passengerMatch.confidence
      }];
      console.log(`✅ FLIGHT_PROCESSING: Using existing passenger: ${passengerMatch.passenger.name}`);
    } else {
      // No passenger match found - create new passenger if we have a name
      if (extractedData.passengerName && extractedData.passengerName !== 'missing') {
        console.log('🆕 FLIGHT_PROCESSING: Creating new passenger from extracted data...');
        try {
          const newPassenger = await createNewPassengerFromTicket(extractedData.passengerName);
          passengers = [{ 
            id: newPassenger.id, 
            name: newPassenger.name,
            extractedName: extractedData.passengerName,
            matchType: 'auto_created',
            matchConfidence: 1.0
          }];
          console.log(`✅ FLIGHT_PROCESSING: Created and assigned new passenger: ${newPassenger.name}`);
          processingResult.issues.push(`Auto-created new passenger: ${newPassenger.name}`);
        } catch (createError) {
          console.error('❌ FLIGHT_PROCESSING: Failed to create new passenger:', createError.message);
          processingResult.issues.push(`Failed to create passenger "${extractedData.passengerName}": ${createError.message}`);
          console.log('⚠️  FLIGHT_PROCESSING: Flight will require manual passenger assignment');
        }
      } else {
        // No passenger name extracted - flight will need manual assignment
        processingResult.issues.push('No passenger name extracted from ticket');
        console.log('⚠️  FLIGHT_PROCESSING: No passenger name extracted - flight will require manual passenger assignment');
      }
    }

    // Step 6: Load existing flights
    console.log('🔍 FLIGHT_PROCESSING: Step 4 - Creating flight record');
    const flightsData = await fs.readFile(flightsFilePath, 'utf-8');
    const flights = JSON.parse(flightsData);

    // Step 7: Create enhanced flight object
    const newFlight = {
      id: uuidv4(),
      
      // Basic flight info (what we can extract reliably)
      flightNumber: extractedData.flightNumber,
      airline: extractedData.airline,
      
      // Route information (if available)
      from: extractedData.from,
      to: extractedData.to,
      
      // Temporal information (will need manual completion)
      departureDateTime: null, // To be filled manually in dashboard
      arrivalDateTime: null,   // To be filled manually in dashboard
      
      // Passenger information
      passengers: passengers,
      
      // Extracted data for reference and completion
      extractedData: {
        ...extractedData,
        ocrFullText: extractionMethod === 'ocr' ? ocrResult?.fullText : null,
        ocrConfidence: extractionMethod === 'ocr' ? ocrResult?.metadata : null
      },
      
      // Processing metadata
      processingStatus: passengerMatch.passenger ? 'partial' : 'requires_passenger_assignment',
      extractedPassengerNames: [extractedData.passengerName],
      parsingStrategy: extractedData.parseStrategy,
      overallConfidence: extractedData.confidence.overall,
      
      // Standard fields
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'telegram_ticket_processing',
      
      // Default fields for compatibility
      notes: `Auto-created from ticket image using ${extractionMethod.toUpperCase()} processing.${extractedData.seatNumbers ? ` Seat Numbers: ${extractedData.seatNumbers.join(', ')}.` : ''} Extracted data: ${JSON.stringify(extractedData, null, 2)}`,
      pickupSevakName: null,
      dropoffSevakName: null,
      pickupSevakPhone: null,
      dropoffSevakPhone: null
    };

    // Step 8: Save flight
    flights.push(newFlight);
    await fs.writeFile(flightsFilePath, JSON.stringify(flights, null, 2));
    
    processingResult.success = true;
    processingResult.flight = newFlight;
    processingResult.metadata.processingEndTime = new Date().toISOString();
    
    console.log('✅ FLIGHT_PROCESSING: Ticket processing completed successfully');
    console.log(`   Flight ID: ${newFlight.id}`);
    console.log(`   Flight Number: ${newFlight.flightNumber}`);
    console.log(`   Passenger Match: ${passengerMatch.matchType}`);
    console.log(`   Status: ${newFlight.processingStatus}`);

    return processingResult;

  } catch (error) {
    console.error('❌ FLIGHT_PROCESSING: Ticket processing failed');
    console.error('   Error:', error.message);
    
    processingResult.success = false;
    processingResult.error = error.message;
    processingResult.metadata.processingEndTime = new Date().toISOString();
    processingResult.issues.push(error.message);
    
    throw error;
  }
}

/**
 * Legacy wrapper function for backward compatibility
 * @param {string} imageUrl - URL of the ticket image
 * @returns {object} The newly created flight object (legacy format)
 */
async function processFlightTicketLegacy(imageUrl) {
  const result = await processFlightTicket(imageUrl);
  if (result.success && result.flight) {
    return result.flight;
  } else {
    throw new Error(result.error || 'Flight processing failed');
  }
}

module.exports = { 
  processFlightTicket, 
  processFlightTicketLegacy,
  findPassengerByExtractedName,
  findPassengerByLegalName, // Keep for backward compatibility
  createNewPassengerFromTicket,
  parseFlightDataWithMultipleStrategies,
  parseFlightData // Keep for backward compatibility
};
