const fs = require('fs').promises;
const path = require('path');
const { extractTextFromImage } = require('./ocr-service');
const GeminiService = require('./gemini-service');
const { v4: uuidv4 } = require('uuid');
const { 
  readPassengers, 
  writePassengers, 
  readFlights, 
  writeFlights 
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
 * Convert Gemini extracted data to our internal format
 * @param {Object} geminiData - Data from Gemini API (new simplified format)
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
        // Fallback to simple UTC conversion if no timezone data
        const isoDateTime = `${date}T${hour24.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00.000Z`;
        console.log(`⚠️  FLIGHT_PROCESSING: No timezone data for ${airportCode}, using UTC: ${date} + ${time} → ${isoDateTime}`);
        return isoDateTime;
      }
    } catch (error) {
      console.error('❌ FLIGHT_PROCESSING: Error combining date/time with timezone:', error.message);
      return `${date}T12:00:00.000Z`; // Fallback
    }
  };
  
  // Handle passenger names - support both single name and array
  let extractedPassengerNames = [];
  if (!isMissing(geminiData.passengerNames) && Array.isArray(geminiData.passengerNames)) {
    extractedPassengerNames = geminiData.passengerNames.filter(name => !isMissing(name));
  } else if (!isMissing(geminiData.passengerName)) {
    // Fallback for old format
    extractedPassengerNames = [geminiData.passengerName];
  }
  
  // Initialize the internal format structure
  const internalData = {
    // Basic flight information
    flightNumber: isMissing(geminiData.flightNumber) ? null : geminiData.flightNumber,
    airline: isMissing(geminiData.airlineName) ? null : geminiData.airlineName,
    
    // Route information
    from: isMissing(geminiData.departureAirport) ? null : geminiData.departureAirport?.toUpperCase?.(),
    to: isMissing(geminiData.arrivalAirport) ? null : geminiData.arrivalAirport?.toUpperCase?.(),
    fromCity: null, // Not provided in new format
    toCity: null,   // Not provided in new format
    
    // Combined date and time information (timezone-aware ISO format)
    departureDateTime: await combineDateTimeWithTimezone(geminiData.departureDate, geminiData.departureTime, geminiData.departureAirport),
    arrivalDateTime: await combineDateTimeWithTimezone(geminiData.arrivalDate, geminiData.arrivalTime, geminiData.arrivalAirport),
    
    // Also keep separate fields for backward compatibility
    departureDate: isMissing(geminiData.departureDate) ? null : geminiData.departureDate,
    departureTime: isMissing(geminiData.departureTime) ? null : geminiData.departureTime,
    arrivalDate: isMissing(geminiData.arrivalDate) ? null : geminiData.arrivalDate,
    arrivalTime: isMissing(geminiData.arrivalTime) ? null : geminiData.arrivalTime,
    
    // Passenger information - use first passenger as primary
    passengerName: extractedPassengerNames.length > 0 ? extractedPassengerNames[0] : null,
    allPassengerNames: extractedPassengerNames, // Store all passenger names
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
 * Enhanced name normalization for better matching
 * @param {string} name - The name to normalize
 * @returns {string} Normalized name
 */
function normalizeNameForMatching(name) {
  if (!name) return '';
  
  return name
    .toLowerCase()
    .replace(/,(?=\S)/g, ', ') // Add space after commas
    .replace(/\s+/g, ' ') // Normalize spaces
    .replace(/^(ex|extra|mr|mrs|ms|dr|prof)\s+/i, '') // Remove prefixes
    .replace(/\s+(jr|sr|ii|iii|iv)$/i, '') // Remove suffixes
    .trim();
}

/**
 * Extract name components for flexible matching
 * @param {string} name - The name to parse
 * @returns {object} Name components
 */
function parseNameComponents(name) {
  const normalized = normalizeNameForMatching(name);
  const parts = normalized.split(/\s+/).filter(part => part.length > 0);
  
  if (parts.length === 0) return { parts: [], first: '', last: '', middle: [] };
  if (parts.length === 1) return { parts, first: parts[0], last: '', middle: [] };
  if (parts.length === 2) return { parts, first: parts[0], last: parts[1], middle: [] };
  
  // For 3+ parts, assume first + middle(s) + last
  return {
    parts,
    first: parts[0],
    last: parts[parts.length - 1],
    middle: parts.slice(1, -1)
  };
}

/**
 * Calculate name similarity score
 * @param {object} extracted - Parsed extracted name components
 * @param {object} stored - Parsed stored name components
 * @returns {number} Similarity score between 0 and 1
 */
function calculateNameSimilarity(extracted, stored) {
  let score = 0;
  let maxScore = 0;
  
  // First name matching (highest weight)
  if (extracted.first && stored.first) {
    maxScore += 3;
    if (extracted.first === stored.first) {
      score += 3;
    } else if (extracted.first.startsWith(stored.first) || stored.first.startsWith(extracted.first)) {
      score += 2; // Partial match (e.g., "Param" vs "Paramcharit")
    }
  }
  
  // Last name matching (high weight)
  if (extracted.last && stored.last) {
    maxScore += 3;
    if (extracted.last === stored.last) {
      score += 3;
    } else if (extracted.last.startsWith(stored.last) || stored.last.startsWith(extracted.last)) {
      score += 2; // Partial match
    }
  }
  
  // Middle name flexibility (lower weight)
  maxScore += 1;
  if (extracted.middle.length === 0 && stored.middle.length === 0) {
    score += 1; // Both have no middle names
  } else if (extracted.middle.length === 0 || stored.middle.length === 0) {
    score += 0.5; // One has middle name, other doesn't - still good
  } else {
    // Both have middle names - check if any match
    const extractedMiddle = extracted.middle.join(' ');
    const storedMiddle = stored.middle.join(' ');
    if (extractedMiddle === storedMiddle) {
      score += 1;
    } else if (extractedMiddle.includes(storedMiddle) || storedMiddle.includes(extractedMiddle)) {
      score += 0.7;
    } else {
      score += 0.3; // Different middle names
    }
  }
  
  return maxScore > 0 ? score / maxScore : 0;
}

/**
 * Enhanced passenger matching with fuzzy search and multiple strategies
 * @param {string} extractedName - The name extracted from the ticket OCR
 * @returns {Promise<object>} Match result with passenger and match details
 */
async function findPassengerByExtractedName(extractedName) {
  console.log(`🔍 FLIGHT_PROCESSING: Searching for passenger: "${extractedName}"`);
  
  const passengers = await readPassengers();
  
  const normalizedExtracted = normalizeNameForMatching(extractedName);
  const extractedComponents = parseNameComponents(extractedName);
  
  console.log(`🔍 FLIGHT_PROCESSING: Parsed extracted name: ${JSON.stringify(extractedComponents)}`);

  // Strategy 1: Exact legal name match
  console.log('🎯 FLIGHT_PROCESSING: Trying exact legal name match...');
  for (const passenger of passengers) {
    if (!passenger.legalName) continue;
    const normalizedLegal = normalizeNameForMatching(passenger.legalName);

    if (normalizedLegal === normalizedExtracted) {
      console.log(`✅ FLIGHT_PROCESSING: Found exact legal name match: ${passenger.name}`);
      return { 
        passenger, 
        matchType: 'legal_exact',
        confidence: 1.0,
        extractedName 
      };
    }
  }

  // Strategy 2: Exact display name match
  console.log('🎯 FLIGHT_PROCESSING: Trying exact display name match...');
  for (const passenger of passengers) {
    const normalizedDisplay = normalizeNameForMatching(passenger.name);
    if (normalizedDisplay === normalizedExtracted) {
      console.log(`✅ FLIGHT_PROCESSING: Found exact display name match: ${passenger.name}`);
      return { 
        passenger, 
        matchType: 'display_exact',
        confidence: 1.0,
        extractedName 
      };
    }
  }

  // Strategy 3: Name order variations (First Last vs Last First)
  console.log('🎯 FLIGHT_PROCESSING: Trying name order variations...');
  for (const passenger of passengers) {
    const legalComponents = parseNameComponents(passenger.legalName);
    const displayComponents = parseNameComponents(passenger.name);
    
    // Try different combinations
    const combinations = [];
    
    // Add reversed order combinations
    if (extractedComponents.parts.length >= 2) {
      const reversed = [...extractedComponents.parts].reverse().join(' ');
      combinations.push(reversed);
      
      // Try "Last, First" format
      if (extractedComponents.first && extractedComponents.last) {
        combinations.push(`${extractedComponents.last}, ${extractedComponents.first}`);
        if (extractedComponents.middle.length > 0) {
          combinations.push(`${extractedComponents.last}, ${extractedComponents.first} ${extractedComponents.middle.join(' ')}`);
        }
      }
    }
    
    for (const combo of combinations) {
      const normalizedCombo = normalizeNameForMatching(combo);
      if (normalizeNameForMatching(passenger.legalName) === normalizedCombo || 
          normalizeNameForMatching(passenger.name) === normalizedCombo) {
        console.log(`✅ FLIGHT_PROCESSING: Found name order variation match: ${passenger.name}`);
        return { 
          passenger, 
          matchType: 'name_order_variation',
          confidence: 0.95,
          extractedName 
        };
      }
    }
  }

  // Strategy 4: Check existing extracted names
  console.log('🎯 FLIGHT_PROCESSING: Checking existing extracted names...');
  for (const passenger of passengers) {
    if (passenger.extractedNames && Array.isArray(passenger.extractedNames)) {
      for (const existingExtracted of passenger.extractedNames) {
        if (normalizeNameForMatching(existingExtracted) === normalizedExtracted) {
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

  // Strategy 5: Component-based flexible matching
  console.log('🎯 FLIGHT_PROCESSING: Trying component-based flexible matching...');
  let bestMatch = null;
  let bestScore = 0;
  
  for (const passenger of passengers) {
    // Check both legal name and display name
    const legalComponents = parseNameComponents(passenger.legalName);
    const displayComponents = parseNameComponents(passenger.name);
    
    const legalScore = calculateNameSimilarity(extractedComponents, legalComponents);
    const displayScore = calculateNameSimilarity(extractedComponents, displayComponents);
    
    const maxScore = Math.max(legalScore, displayScore);
    
    if (maxScore > bestScore && maxScore >= 0.75) { // Require 75% similarity
      bestScore = maxScore;
      bestMatch = {
        passenger,
        matchType: legalScore > displayScore ? 'legal_component' : 'display_component',
        confidence: maxScore,
        extractedName,
        details: {
          legalScore,
          displayScore,
          extractedComponents,
          matchedComponents: legalScore > displayScore ? legalComponents : displayComponents
        }
      };
    }
  }
  
  if (bestMatch) {
    console.log(`✅ FLIGHT_PROCESSING: Found component-based match: ${bestMatch.passenger.name} (confidence: ${bestMatch.confidence.toFixed(3)})`);
    return bestMatch;
  }

  // Strategy 6: Fuzzy matching (if library available) - with lower threshold
  if (fuzzy) {
    console.log('🎯 FLIGHT_PROCESSING: Trying fuzzy matching...');
    
    // Create fuzzy sets for legal names and display names
    const legalNames = passengers.filter(p => p.legalName).map(p => normalizeNameForMatching(p.legalName));
    const displayNames = passengers.map(p => normalizeNameForMatching(p.name));
    
    const legalFuzzySet = fuzzy(legalNames);
    const displayFuzzySet = fuzzy(displayNames);
    
    // Try fuzzy match on legal names first (lower threshold)
    const legalMatches = legalFuzzySet.get(normalizedExtracted);
    if (legalMatches && legalMatches.length > 0 && legalMatches[0][0] > 0.6) {
      const matchedLegalName = legalMatches[0][1];
      const passenger = passengers.find(p => normalizeNameForMatching(p.legalName) === matchedLegalName);
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
    if (displayMatches && displayMatches.length > 0 && displayMatches[0][0] > 0.6) {
      const matchedDisplayName = displayMatches[0][1];
      const passenger = passengers.find(p => normalizeNameForMatching(p.name) === matchedDisplayName);
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
    const passengers = await readPassengers();
    
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
    
    // Save to Google Sheets
    await writePassengers(passengers);
    
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
    const passengers = await readPassengers();
    
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

        if (geminiResult.success && (geminiResult.data || geminiResult.flights)) {
          console.log('✅ FLIGHT_PROCESSING: Gemini extraction successful');
          
          // Handle new multi-flight structure
          if (geminiResult.flights && geminiResult.flights.length > 0) {
            console.log(`📊 FLIGHT_PROCESSING: Processing ${geminiResult.flights.length} flight(s) from Gemini`);
            
            // Convert the new structure to internal format
            extractedData = await convertGeminiDataToInternalFormat({ flights: geminiResult.flights });
            extractionMethod = 'gemini';
            processingResult.metadata.extractionMethod = 'gemini';
            processingResult.metadata.geminiConfidence = geminiResult.confidence;
          } else if (geminiResult.data) {
            // Fallback for old single-flight structure
            console.log('📊 FLIGHT_PROCESSING: Processing single flight from Gemini (legacy format)');
            extractedData = await convertGeminiDataToInternalFormat(geminiResult.data);
            extractionMethod = 'gemini';
            processingResult.metadata.extractionMethod = 'gemini';
            processingResult.metadata.geminiConfidence = geminiResult.confidence;
          } else {
            console.log('⚠️  FLIGHT_PROCESSING: No valid flight data in Gemini result, falling back to OCR');
          }
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
    
    // Handle multiple flights if detected
    if (extractedData.multipleFlights && extractedData.flights) {
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
      processingResult.metadata.processingEndTime = new Date().toISOString();
      
      console.log(`✅ FLIGHT_PROCESSING: Successfully processed ${createdFlights.length}/${extractedData.flights.length} flights`);
      return processingResult;
    }
    
    console.log(`📊 FLIGHT_PROCESSING: Parsing completed with ${extractedData.confidence?.overall?.toFixed(2) || 0} overall confidence`);

    // Step 3: Validate minimum required data
    const requiredFields = [];
    if (!extractedData.flightNumber) requiredFields.push('flightNumber');
    if (!extractedData.passengerName) requiredFields.push('passengerName');
    
    if (requiredFields.length > 0) {
      const issue = `Missing required fields: ${requiredFields.join(', ')}`;
      processingResult.issues.push(issue);
      throw new Error(issue);
    }

    // Step 4: Enhanced passenger matching for all extracted passengers
    console.log('🔍 FLIGHT_PROCESSING: Step 3 - Enhanced passenger matching');
    const allPassengerNames = extractedData.allPassengerNames || [extractedData.passengerName];
    const passengerMatches = [];
    let passengers = [];
    
    console.log(`👥 FLIGHT_PROCESSING: Processing ${allPassengerNames.length} extracted passenger(s): ${allPassengerNames.join(', ')}`);

    // Step 5: Process each extracted passenger
    for (const passengerName of allPassengerNames) {
      if (!passengerName || passengerName === 'missing') {
        console.log('⚠️  FLIGHT_PROCESSING: Skipping empty/missing passenger name');
        continue;
      }

      console.log(`👤 FLIGHT_PROCESSING: Processing passenger: ${passengerName}`);
      const passengerMatch = await findPassengerByExtractedName(passengerName);
      passengerMatches.push(passengerMatch);
      
      console.log(`👤 FLIGHT_PROCESSING: Match result for "${passengerName}": ${passengerMatch.matchType} (confidence: ${passengerMatch.confidence})`);

      if (passengerMatch.passenger) {
        // Update passenger with extracted name for future reference
        if (passengerMatch.matchType !== 'extracted_existing') {
          await updatePassengerWithExtractedName(passengerMatch.passenger, passengerName);
        }
        passengers.push({ 
          id: passengerMatch.passenger.id, 
          name: passengerMatch.passenger.name,
          extractedName: passengerName,
          matchType: passengerMatch.matchType,
          matchConfidence: passengerMatch.confidence
        });
        console.log(`✅ FLIGHT_PROCESSING: Using existing passenger: ${passengerMatch.passenger.name}`);
      } else {
        // No passenger match found - create new passenger
        console.log(`🆕 FLIGHT_PROCESSING: Creating new passenger: ${passengerName}`);
        try {
          const newPassenger = await createNewPassengerFromTicket(passengerName);
          passengers.push({ 
            id: newPassenger.id, 
            name: newPassenger.name,
            extractedName: passengerName,
            matchType: 'auto_created',
            matchConfidence: 1.0
          });
          console.log(`✅ FLIGHT_PROCESSING: Created and assigned new passenger: ${newPassenger.name}`);
          processingResult.issues.push(`Auto-created new passenger: ${newPassenger.name}`);
        } catch (createError) {
          console.error(`❌ FLIGHT_PROCESSING: Failed to create passenger "${passengerName}":`, createError.message);
          processingResult.issues.push(`Failed to create passenger "${passengerName}": ${createError.message}`);
          console.log('⚠️  FLIGHT_PROCESSING: This passenger will require manual assignment');
        }
      }
    }

    // Set the passenger match result (use the first match for compatibility)
    processingResult.passengerMatch = passengerMatches[0] || { matchType: 'no_match', confidence: 0 };
    
    if (passengers.length === 0) {
      processingResult.issues.push('No passengers could be processed from ticket');
      console.log('⚠️  FLIGHT_PROCESSING: No passengers processed - flight will require manual passenger assignment');
    } else {
      console.log(`✅ FLIGHT_PROCESSING: Successfully processed ${passengers.length} passenger(s)`);
    }

    // Step 6: Load existing flights
    console.log('🔍 FLIGHT_PROCESSING: Step 4 - Creating flight record');
    const flights = await readFlights();

    // Step 7: Create enhanced flight object
    const newFlight = {
      id: uuidv4(),
      
      // Basic flight info (what we can extract reliably)
      flightNumber: extractedData.flightNumber,
      airline: extractedData.airline,
      
      // Route information (if available)
      from: extractedData.from,
      to: extractedData.to,
      
      // Temporal information (from extracted data)
      departureDateTime: extractedData.departureDateTime,
      arrivalDateTime: extractedData.arrivalDateTime,
      
      // Passenger information
      passengers: passengers,
      
      // Extracted data for reference and completion
      extractedData: {
        ...extractedData,
        ocrFullText: extractionMethod === 'ocr' ? ocrResult?.fullText : null,
        ocrConfidence: extractionMethod === 'ocr' ? ocrResult?.metadata : null
      },
      
      // Processing metadata
      processingStatus: passengers.length > 0 ? 'partial' : 'requires_passenger_assignment',
      extractedPassengerNames: extractedData.allPassengerNames || [extractedData.passengerName],
      parsingStrategy: extractedData.parseStrategy,
      overallConfidence: extractedData.confidence.overall,
      
      // Standard fields
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'telegram_ticket_processing',
      
      // Default fields for compatibility
      notes: `Auto-created from ticket image using ${extractionMethod.toUpperCase()} processing.${extractedData.seatNumbers && extractedData.seatNumbers.length > 0 ? ` Seat Numbers: ${extractedData.seatNumbers.join(', ')}.` : ''}`,
      pickupSevakName: null,
      dropoffSevakName: null,
      pickupSevakPhone: null,
      dropoffSevakPhone: null
    };

    // Step 8: Save flight
    flights.push(newFlight);
    await writeFlights(flights);
    
    processingResult.success = true;
    processingResult.flight = newFlight;
    processingResult.metadata.processingEndTime = new Date().toISOString();
    
    console.log('✅ FLIGHT_PROCESSING: Ticket processing completed successfully');
    console.log(`   Flight ID: ${newFlight.id}`);
    console.log(`   Flight Number: ${newFlight.flightNumber}`);
    console.log(`   Passengers Processed: ${passengers.length}`);
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

/**
 * Process a single flight data object and create flight record
 * @param {Object} flightData - Single flight data 
 * @param {string} extractionMethod - Method used to extract data
 * @param {Object} parentProcessingResult - Parent processing result for metadata
 * @returns {Object} Processing result with flight data
 */
async function processSingleFlightData(flightData, extractionMethod, parentProcessingResult) {
  try {
    // Step 3: Enhanced passenger matching for this flight
    console.log('🔍 FLIGHT_PROCESSING: Step 3 - Enhanced passenger matching');
    console.log(`👥 FLIGHT_PROCESSING: Processing ${flightData.allPassengerNames?.length || 1} extracted passenger(s): ${flightData.allPassengerNames?.join(', ') || flightData.passengerName}`);

    const passengers = [];
    const passengerNames = flightData.allPassengerNames || [flightData.passengerName];
    
    for (const passengerName of passengerNames) {
      if (!passengerName) continue;
      
      console.log(`👤 FLIGHT_PROCESSING: Processing passenger: ${passengerName}`);
      
      // Use the existing enhanced passenger matching
      const passengerResult = await findPassengerByExtractedName(passengerName);
      
      if (passengerResult.found) {
        passengers.push({ passengerId: passengerResult.passenger.id });
        await updatePassengerWithExtractedName(passengerResult.passenger, passengerName);
      } else {
        const newPassenger = await createNewPassengerFromTicket(passengerName);
        if (newPassenger) {
          passengers.push({ passengerId: newPassenger.id });
        }
      }
    }

    console.log(`✅ FLIGHT_PROCESSING: Successfully processed ${passengers.length} passenger(s)`);

    // Step 4: Load existing flights
    console.log('🔍 FLIGHT_PROCESSING: Step 4 - Creating flight record');
    const flights = await readFlights();

    // Step 5: Create enhanced flight object
    const newFlight = {
      id: uuidv4(),
      
      // Basic flight info
      flightNumber: flightData.flightNumber,
      airline: flightData.airline,
      
      // Route information
      from: flightData.from,
      to: flightData.to,
      
      // Temporal information
      departureDateTime: flightData.departureDateTime,
      arrivalDateTime: flightData.arrivalDateTime,
      
      // Passenger information
      passengers: passengers,
      
      // Additional extracted data
      confirmationCode: flightData.confirmationCode || null,
      seatNumbers: flightData.seatNumbers || [],
      
      // Processing metadata
      processingStatus: passengers.length > 0 ? 'partial' : 'requires_passenger_assignment',
      extractedPassengerNames: passengerNames,
      parsingStrategy: flightData.parseStrategy || 'gemini_ai_enhanced',
      overallConfidence: flightData.confidence?.overall || 0.95,
      
      // Standard fields
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'telegram_ticket_processing',
      
      // Default fields
      notes: `Auto-created from ticket image using ${extractionMethod.toUpperCase()} processing.${flightData.seatNumbers && flightData.seatNumbers.length > 0 ? ` Seat Numbers: ${flightData.seatNumbers.join(', ')}.` : ''}`,
      pickupVolunteerName: '',
      pickupVolunteerPhone: '',
      dropoffVolunteerName: '',
      dropoffVolunteerPhone: ''
    };

    // Step 6: Save flight
    flights.push(newFlight);
    await writeFlights(flights);
    
    return {
      success: true,
      flight: newFlight
    };
    
  } catch (error) {
    console.error('❌ FLIGHT_PROCESSING: Error processing single flight:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = { 
  processFlightTicket, 
  processFlightTicketLegacy,
  findPassengerByExtractedName,
  findPassengerByLegalName, // Keep for backward compatibility
  createNewPassengerFromTicket,
  parseFlightDataWithMultipleStrategies,
  parseFlightData, // Keep for backward compatibility
  processSingleFlightData
};
