const fs = require('fs').promises;
const path = require('path');
const { extractTextFromImage } = require('./ocr-service');
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
    // Step 1: Extract text from image with detailed results
    console.log('🔍 FLIGHT_PROCESSING: Step 1 - OCR text extraction');
    const ocrResult = await extractTextFromImage(imageUrl);
    
    if (!ocrResult.success) {
      throw new Error(`OCR failed: ${ocrResult.error}`);
    }
    
    console.log(`✅ FLIGHT_PROCESSING: OCR successful - ${ocrResult.fullText.length} characters extracted`);
    processingResult.metadata.ocrResult = ocrResult.metadata;

    // Step 2: Parse flight data using enhanced parsing
    console.log('🔍 FLIGHT_PROCESSING: Step 2 - Enhanced data parsing');
    const extractedData = parseFlightDataWithMultipleStrategies(ocrResult.fullText, ocrResult.metadata);
    processingResult.extractedData = extractedData;
    
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
    } else {
      // No passenger match - we'll still create the flight but mark it for manual review
      processingResult.issues.push(`No passenger match found for: ${extractedData.passengerName}`);
      console.log('⚠️  FLIGHT_PROCESSING: No passenger match - flight will require manual passenger assignment');
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
        ocrFullText: ocrResult.fullText,
        ocrConfidence: ocrResult.metadata
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
      notes: `Auto-created from ticket image.${extractedData.seatNumbers ? ` Seat Numbers: ${extractedData.seatNumbers.join(', ')}.` : ''} Extracted data: ${JSON.stringify(extractedData, null, 2)}`,
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
  parseFlightDataWithMultipleStrategies,
  parseFlightData // Keep for backward compatibility
};
