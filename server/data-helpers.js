const { cloudStorage } = require('./cloud-storage-helpers');

// Cloud Storage-based data operations
async function readFlights() {
  return await cloudStorage.readFlights();
}

async function writeFlights(flights) {
  await cloudStorage.writeFlights(flights);
}

async function readUsers() {
  return await cloudStorage.readUsers();
}

async function writeUsers(users) {
  await cloudStorage.writeUsers(users);
}

async function readPassengers() {
  return await cloudStorage.readPassengers();
}

async function writePassengers(passengers) {
  await cloudStorage.writePassengers(passengers);
}

async function readVolunteers() {
  return await cloudStorage.readVolunteers();
}

async function writeVolunteers(volunteers) {
  await cloudStorage.writeVolunteers(volunteers);
}

async function readAirports() {
  return await cloudStorage.readAirports();
}

async function writeAirports(airports) {
  await cloudStorage.writeAirports(airports);
}

async function readAirlines() {
  return await cloudStorage.readAirlines();
}

async function writeAirlines(airlines) {
  await cloudStorage.writeAirlines(airlines);
}

async function readAuditLog() {
  return await cloudStorage.readAuditLog();
}

async function writeAuditLog(auditLog) {
  await cloudStorage.writeAuditLog(auditLog);
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
      if (flight.passengers) {
        const resolvedPassengers = await resolveFlightPassengerNames(flight.passengers, passengers);
        return {
          ...flight,
          passengers: resolvedPassengers
        };
      }
      return flight;
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
 * Parse name into components for advanced matching
 * @param {string} name - Full name to parse
 * @returns {Object} - Name components
 */
function parseNameComponents(name) {
  const normalized = normalizeNameForMatching(name);
  const parts = normalized.split(/\s+/).filter(part => part.length > 1); // Filter out single characters
  
  if (parts.length === 0) return { parts: [], first: '', last: '', middle: [], all: [] };
  if (parts.length === 1) return { parts, first: parts[0], last: '', middle: [], all: parts };
  if (parts.length === 2) return { parts, first: parts[0], last: parts[1], middle: [], all: parts };
  
  // For 3+ parts, assume first + middle(s) + last
  return {
    parts,
    first: parts[0],
    last: parts[parts.length - 1],
    middle: parts.slice(1, -1),
    all: parts
  };
}

/**
 * Calculate component-level similarity using character overlap
 * @param {string} comp1 - First component
 * @param {string} comp2 - Second component  
 * @returns {number} - Similarity score between 0 and 1
 */
function calculateComponentSimilarity(comp1, comp2) {
  if (!comp1 || !comp2) return 0;
  if (comp1 === comp2) return 1;
  
  const str1 = comp1.toLowerCase();
  const str2 = comp2.toLowerCase();
  
  // Calculate character overlap percentage
  const chars1 = new Set(str1);
  const chars2 = new Set(str2);
  const intersection = new Set([...chars1].filter(x => chars2.has(x)));
  const union = new Set([...chars1, ...chars2]);
  
  const charOverlap = intersection.size / union.size;
  
  // Calculate length similarity
  const lengthSimilarity = 1 - Math.abs(str1.length - str2.length) / Math.max(str1.length, str2.length);
  
  // Calculate edit distance similarity (simplified)
  const editDistance = calculateSimpleEditDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);
  const editSimilarity = 1 - (editDistance / maxLength);
  
  // Weighted combination
  const similarity = (charOverlap * 0.4) + (lengthSimilarity * 0.3) + (editSimilarity * 0.3);
  
  return similarity;
}

/**
 * Calculate simple edit distance between two strings
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Edit distance
 */
function calculateSimpleEditDistance(str1, str2) {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Calculate enhanced name similarity score with component analysis
 * @param {string} extractedName - Name from ticket
 * @param {string} storedName - Name from database
 * @returns {number} - Similarity score between 0 and 1
 */
function calculateAdvancedNameSimilarity(extractedName, storedName) {
  const extracted = parseNameComponents(extractedName);
  const stored = parseNameComponents(storedName);
  
  if (extracted.parts.length === 0 || stored.parts.length === 0) return 0;
  
  let score = 0;
  let maxScore = 0;
  
  // Strategy 1: Component matching (highest weight)
  // Check how many name components match (regardless of order)
  const extractedSet = new Set(extracted.all);
  const storedSet = new Set(stored.all);
  const commonComponents = [...extractedSet].filter(part => storedSet.has(part));
  
  // Component matching score (very high weight for exact component matches)
  const componentMatchScore = commonComponents.length / Math.max(extracted.all.length, stored.all.length);
  score += componentMatchScore * 4; // High weight
  maxScore += 4;
  
  // Strategy 2: Order-aware matching (medium weight)
  // Bonus for components in the same position
  let positionMatches = 0;
  const minLength = Math.min(extracted.all.length, stored.all.length);
  for (let i = 0; i < minLength; i++) {
    if (extracted.all[i] === stored.all[i]) {
      positionMatches++;
    }
  }
  const positionScore = positionMatches / Math.max(extracted.all.length, stored.all.length);
  score += positionScore * 2; // Medium weight
  maxScore += 2;
  
  // Strategy 3: Fuzzy component matching (medium weight)
  // Check for similar components using character-level similarity
  let fuzzyMatches = 0;
  for (const extractedPart of extracted.all) {
    let bestComponentScore = 0;
    for (const storedPart of stored.all) {
      if (extractedPart.length >= 4 && storedPart.length >= 4) {
        // Calculate Levenshtein-like similarity for components
        const componentSimilarity = calculateComponentSimilarity(extractedPart, storedPart);
        if (componentSimilarity > bestComponentScore) {
          bestComponentScore = componentSimilarity;
        }
      }
    }
    if (bestComponentScore >= 0.8) { // High threshold for fuzzy component matching
      fuzzyMatches++;
    }
  }
  const fuzzyScore = fuzzyMatches / extracted.all.length;
  score += fuzzyScore * 3; // High weight for fuzzy matches
  maxScore += 3;
  
  // Strategy 4: Partial component matching (lower weight)
  // Check for partial matches within components
  let partialMatches = 0;
  for (const extractedPart of extracted.all) {
    for (const storedPart of stored.all) {
      if (extractedPart.length >= 3 && storedPart.length >= 3) {
        if (extractedPart.includes(storedPart) || storedPart.includes(extractedPart)) {
          partialMatches++;
          break; // Only count one partial match per extracted part
        }
      }
    }
  }
  const partialScore = partialMatches / extracted.all.length;
  score += partialScore * 1; // Lower weight
  maxScore += 1;
  
  // Strategy 5: Reverse order matching (for cases like "First Last" vs "Last First")
  // Check if the name is just reversed
  if (extracted.all.length === 2 && stored.all.length === 2) {
    if (extracted.all[0] === stored.all[1] && extracted.all[1] === stored.all[0]) {
      score += 3; // High bonus for perfect reverse match
    }
  }
  maxScore += 1; // Account for potential reverse bonus
  
  const finalScore = maxScore > 0 ? Math.min(score / maxScore, 1) : 0;
  
  // Debug logging for the specific case mentioned
  if (extractedName.toLowerCase().includes('anandchintadas') || storedName.toLowerCase().includes('anandchintandas')) {
    console.log(`🔍 DEBUG Name Similarity: "${extractedName}" vs "${storedName}"`);
    console.log(`   Components: [${extracted.all.join(', ')}] vs [${stored.all.join(', ')}]`);
    console.log(`   Common: [${commonComponents.join(', ')}], Score: ${finalScore.toFixed(3)}`);
  }
  
  return finalScore;
}

/**
 * Find passenger by name or legal name with enhanced component-based matching
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
  
  console.log(`🔍 ENHANCED_MATCHING: Searching for "${searchName}" among ${passengers.length} passengers`);
  
  // 1. Try exact match on name first (highest priority)
  let match = passengers.find(p => 
    p.name && p.name.toLowerCase().trim() === searchLower
  );
  
  if (match) {
    console.log(`✅ EXACT_MATCH: Found exact name match: "${match.name}"`);
    return match;
  }
  
  // 2. Try exact match on legal name
  match = passengers.find(p => 
    p.legalName && p.legalName.toLowerCase().trim() === searchLower
  );
  
  if (match) {
    console.log(`✅ EXACT_LEGAL_MATCH: Found exact legal name match: "${match.name}" (legal: "${match.legalName}")`);
    return match;
  }
  
  // 3. Enhanced component-based similarity matching
  let bestMatch = null;
  let bestScore = 0;
  const minScore = 0.4; // Minimum similarity threshold (lowered for better matching)
  
  for (const passenger of passengers) {
    // Check against display name
    if (passenger.name) {
      const nameScore = calculateAdvancedNameSimilarity(searchName, passenger.name);
      if (nameScore > bestScore && nameScore >= minScore) {
        bestScore = nameScore;
        bestMatch = { passenger, type: 'name', score: nameScore };
      }
    }
    
    // Check against legal name
    if (passenger.legalName) {
      const legalScore = calculateAdvancedNameSimilarity(searchName, passenger.legalName);
      if (legalScore > bestScore && legalScore >= minScore) {
        bestScore = legalScore;
        bestMatch = { passenger, type: 'legal', score: legalScore };
      }
    }
    
    // Check against extracted names if they exist
    if (passenger.extractedNames && Array.isArray(passenger.extractedNames)) {
      for (const extractedName of passenger.extractedNames) {
        const extractedScore = calculateAdvancedNameSimilarity(searchName, extractedName);
        if (extractedScore > bestScore && extractedScore >= minScore) {
          bestScore = extractedScore;
          bestMatch = { passenger, type: 'extracted', score: extractedScore };
        }
      }
    }
  }
  
  if (bestMatch) {
    console.log(`✅ COMPONENT_MATCH: Found ${bestMatch.type} match: "${bestMatch.passenger.name}" (score: ${bestMatch.score.toFixed(3)})`);
    if (bestMatch.passenger.legalName) {
      console.log(`   Legal name: "${bestMatch.passenger.legalName}"`);
    }
    return bestMatch.passenger;
  }
  
  // 4. Fallback to old fuzzy matching (if no component match found)
  if (fuzzy && passengers.length > 0) {
    console.log(`🔍 FALLBACK: Trying traditional fuzzy matching...`);
    
    // Create fuzzy sets for legal names and display names
    const legalNames = passengers.filter(p => p.legalName).map(p => normalizeNameForMatching(p.legalName));
    const displayNames = passengers.map(p => normalizeNameForMatching(p.name));
    
    if (legalNames.length > 0) {
      const legalFuzzySet = fuzzy(legalNames);
      const legalMatches = legalFuzzySet.get(normalizedSearch);
      
      if (legalMatches && legalMatches.length > 0 && legalMatches[0][0] > 0.7) { // Higher threshold
        const matchedLegalName = legalMatches[0][1];
        const passenger = passengers.find(p => normalizeNameForMatching(p.legalName) === matchedLegalName);
        if (passenger) {
          console.log(`✅ FUZZY_LEGAL: Found fuzzy legal name match: "${passenger.name}" (${legalMatches[0][0].toFixed(2)})`);
          return passenger;
        }
      }
    }
    
    if (displayNames.length > 0) {
      const displayFuzzySet = fuzzy(displayNames);
      const displayMatches = displayFuzzySet.get(normalizedSearch);
      
      if (displayMatches && displayMatches.length > 0 && displayMatches[0][0] > 0.7) { // Higher threshold
        const matchedDisplayName = displayMatches[0][1];
        const passenger = passengers.find(p => normalizeNameForMatching(p.name) === matchedDisplayName);
        if (passenger) {
          console.log(`✅ FUZZY_DISPLAY: Found fuzzy display name match: "${passenger.name}" (${displayMatches[0][0].toFixed(2)})`);
          return passenger;
        }
      }
    }
  }
  
  console.log(`❌ NO_MATCH: No suitable match found for "${searchName}"`);
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
  readAirports,
  writeAirports,
  readAirlines,
  writeAirlines,
  readAuditLog,
  writeAuditLog,
  resolveFlightPassengerNames,
  getFlightsWithResolvedNames,
  findPassengerByName
};