// Google Sheets as primary data storage
const { googleSheets } = require('./google-sheets-helpers');

console.log('📊 Data Layer: Using Google Sheets as primary storage');

// Google Sheets data operations
async function readFlights() {
  return await googleSheets.readFlights();
}

async function writeFlights(flights) {
  return await googleSheets.writeFlights(flights);
}

async function readUsers() {
  return await googleSheets.readUsers();
}

async function writeUsers(users) {
  return await googleSheets.writeUsers(users);
}

async function readPassengers() {
  return await googleSheets.readPassengers();
}

async function writePassengers(passengers) {
  return await googleSheets.writePassengers(passengers);
}

async function readVolunteers() {
  return await googleSheets.readVolunteers();
}

async function writeVolunteers(volunteers) {
  return await googleSheets.writeVolunteers(volunteers);
}

/**
 * Resolve passenger names from passenger IDs for flight display
 * @param {Array} flightPassengers - Array of passenger objects with passengerId
 * @param {Array} passengers - Array of all passengers (optional, will load if not provided)
 * @returns {Array} - Array of passenger objects with resolved names
 */
async function resolveFlightPassengerNames(flightPassengers, passengers = null) {
  if (!flightPassengers || !Array.isArray(flightPassengers)) {
    return [];
  }
  
  // Load passengers if not provided
  if (!passengers) {
    passengers = await readPassengers();
  }
  
  return flightPassengers.map(flightPassenger => {
    // If it's already the old format (has name directly), return as is
    if (flightPassenger.name && !flightPassenger.passengerId) {
      return flightPassenger;
    }
    
    // If it's new format (has passengerId), resolve the name
    if (flightPassenger.passengerId) {
      const passenger = passengers.find(p => p.id === flightPassenger.passengerId);
      if (passenger) {
        return {
          ...flightPassenger,
          id: flightPassenger.passengerId, // For compatibility
          name: passenger.name,
          legalName: passenger.legalName
        };
      } else {
        // Passenger not found, show as unknown
        return {
          ...flightPassenger,
          id: flightPassenger.passengerId,
          name: 'Unknown Passenger',
          legalName: 'Unknown'
        };
      }
    }
    
    // Fallback - return as is
    return flightPassenger;
  });
}

/**
 * Get flights with resolved passenger names for display
 * @param {Array} flights - Array of flight objects (optional, will load if not provided)
 * @returns {Array} - Array of flights with resolved passenger names
 */
async function getFlightsWithResolvedNames(flights = null) {
  if (!flights) {
    flights = await readFlights();
  }
  
  const passengers = await readPassengers();
  
  // Resolve passenger names for each flight
  const resolvedFlights = await Promise.all(
    flights.map(async (flight) => {
      // Handle Google Sheets format with passengerIds array
      if (flight.passengerIds && Array.isArray(flight.passengerIds)) {
        // Convert passengerIds to passenger objects format
        const flightPassengers = flight.passengerIds.map(passengerId => ({ passengerId }));
        const resolvedPassengers = await resolveFlightPassengerNames(flightPassengers, passengers);
        return {
          ...flight,
          passengers: resolvedPassengers
        };
      }
      // Handle legacy format with passengers array
      else if (flight.passengers) {
        const resolvedPassengers = await resolveFlightPassengerNames(flight.passengers, passengers);
        return {
          ...flight,
          passengers: resolvedPassengers
        };
      }
      // No passengers found
      return {
        ...flight,
        passengers: []
      };
    })
  );
  
  return resolvedFlights;
}

// Use the existing sophisticated fuzzy matching from flight-processing-service
let fuzzy;
try {
  fuzzy = require('fuzzyset');
} catch (e) {
  console.warn('⚠️  DATA_HELPERS: fuzzyset not installed. Fuzzy matching will be disabled.');
}

/**
 * Normalize name for consistent matching
 */
function normalizeNameForMatching(name) {
  return name?.toLowerCase()
    .replace(/[^\w\s]/g, ' ')  // Replace non-alphanumeric with spaces
    .replace(/\s+/g, ' ')       // Collapse multiple spaces
    .trim() || '';
}

/**
 * Find passenger by name or legal name with advanced fuzzy matching
 * Uses the same sophisticated algorithm as flight-processing-service
 * @param {string} searchName - Name to search for
 * @param {Array} passengers - Array of passengers (optional, will load if not provided)
 * @returns {Object|null} - Found passenger or null
 */
async function findPassengerByName(searchName, passengers = null) {
  if (!searchName) return null;
  
  if (!passengers) {
    passengers = await readPassengers();
  }
  
  const searchLower = searchName.toLowerCase().trim();
  const normalizedSearch = normalizeNameForMatching(searchName);
  
  // 1. Try exact match on name first (highest priority)
  let match = passengers.find(p => 
    p.name && p.name.toLowerCase().trim() === searchLower
  );
  
  if (match) return match;
  
  // 2. Try exact match on legal name
  match = passengers.find(p => 
    p.legalName && p.legalName.toLowerCase().trim() === searchLower
  );
  
  if (match) return match;
  
  // 3. Try partial matching for substrings
  match = passengers.find(p => {
    const name = p.name?.toLowerCase().trim() || '';
    const legalName = p.legalName?.toLowerCase().trim() || '';
    
    return name.includes(searchLower) || 
           searchLower.includes(name) ||
           legalName.includes(searchLower) || 
           searchLower.includes(legalName);
  });
  
  if (match) return match;
  
  // 4. Advanced fuzzy matching (same as flight-processing-service)
  if (fuzzy && passengers.length > 0) {
    // Create fuzzy sets for legal names and display names
    const legalNames = passengers.filter(p => p.legalName).map(p => normalizeNameForMatching(p.legalName));
    const displayNames = passengers.map(p => normalizeNameForMatching(p.name));
    
    if (legalNames.length > 0) {
      const legalFuzzySet = fuzzy(legalNames);
      const legalMatches = legalFuzzySet.get(normalizedSearch);
      
      if (legalMatches && legalMatches.length > 0 && legalMatches[0][0] > 0.6) {
        const matchedLegalName = legalMatches[0][1];
        const passenger = passengers.find(p => normalizeNameForMatching(p.legalName) === matchedLegalName);
        if (passenger) {
          console.log(`🔍 Fuzzy legal name match: "${searchName}" → "${passenger.name}" (${legalMatches[0][0].toFixed(2)})`);
          return passenger;
        }
      }
    }
    
    if (displayNames.length > 0) {
      const displayFuzzySet = fuzzy(displayNames);
      const displayMatches = displayFuzzySet.get(normalizedSearch);
      
      if (displayMatches && displayMatches.length > 0 && displayMatches[0][0] > 0.6) {
        const matchedDisplayName = displayMatches[0][1];
        const passenger = passengers.find(p => normalizeNameForMatching(p.name) === matchedDisplayName);
        if (passenger) {
          console.log(`🔍 Fuzzy display name match: "${searchName}" → "${passenger.name}" (${displayMatches[0][0].toFixed(2)})`);
          return passenger;
        }
      }
    }
  }
  
  return null;
}

module.exports = {
  readFlights,
  writeFlights,
  readUsers,
  writeUsers,
  readPassengers,
  writePassengers,
  readVolunteers,
  writeVolunteers,
  resolveFlightPassengerNames,
  getFlightsWithResolvedNames,
  findPassengerByName
};