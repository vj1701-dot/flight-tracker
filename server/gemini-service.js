const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs').promises;
const path = require('path');

/**
 * Gemini AI Service for Flight Ticket Processing
 * Provides intelligent extraction of flight data from ticket images
 */
class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.genAI = null;
    this.model = null;
    
    if (!this.apiKey) {
      console.log('⚠️  GEMINI_API_KEY not set. Gemini service will be disabled.');
      return;
    }

    try {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      console.log('✅ GEMINI_SERVICE: Initialized successfully');
    } catch (error) {
      console.error('❌ GEMINI_SERVICE: Initialization failed:', error.message);
    }
  }

  /**
   * Check if Gemini service is available
   * @returns {boolean}
   */
  isAvailable() {
    return this.genAI && this.model && this.apiKey;
  }

  /**
   * Convert image file to base64 for Gemini API
   * @param {string} imagePath - Path to the image file
   * @returns {Promise<Object>} - Image data for Gemini
   */
  async prepareImage(imagePath) {
    try {
      const imageBuffer = await fs.readFile(imagePath);
      const base64Data = imageBuffer.toString('base64');
      
      // Determine MIME type from file extension
      const ext = path.extname(imagePath).toLowerCase();
      let mimeType;
      switch (ext) {
        case '.jpg':
        case '.jpeg':
          mimeType = 'image/jpeg';
          break;
        case '.png':
          mimeType = 'image/png';
          break;
        case '.webp':
          mimeType = 'image/webp';
          break;
        default:
          mimeType = 'image/jpeg'; // Default fallback
      }

      return {
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      };
    } catch (error) {
      console.error('❌ GEMINI_SERVICE: Error preparing image:', error.message);
      throw error;
    }
  }

  /**
   * Extract flight data from ticket image using Gemini
   * @param {string} imagePath - Path to the ticket image
   * @param {Array} existingPassengers - Array of existing passengers for smart matching
   * @returns {Promise<Object>} - Extracted flight data
   */
  async extractFlightData(imagePath, existingPassengers = []) {
    if (!this.isAvailable()) {
      throw new Error('Gemini service not available');
    }

    try {
      console.log('🧠 GEMINI_SERVICE: Starting flight data extraction...');
      
      // Prepare the image
      const imageData = await this.prepareImage(imagePath);
      
      // Prepare passenger data context for smarter matching
      const passengerContext = existingPassengers.length > 0 ? 
        `\n\nEXISTING PASSENGERS DATABASE (for smart name matching):
${existingPassengers.map((p, idx) => 
  `${idx + 1}. Name: "${p.name}" | Legal Name: "${p.legalName || 'not set'}" | Phone: ${p.phone || 'not set'} | ID: ${p.id}`
).join('\n')}

When you extract passenger names, try to match them with existing passengers if possible. Use the exact name format from the database if you find a match.` : '';

      // Create the enhanced prompt for flight ticket analysis
      const prompt = `
You are an expert flight ticket analyzer with access to our flight tracking system. Analyze this flight ticket image and extract flight information in our exact database format.

DATABASE SCHEMA - Return data EXACTLY matching our Google Sheets structure:

FLIGHTS SHEET COLUMNS:
id, flightNumber, airline, from, to, departureDateTime, arrivalDateTime, passengerIds, pickupVolunteerName, pickupVolunteerPhone, dropoffVolunteerName, dropoffVolunteerPhone, status, notes, confirmationCode, seatNumbers, gate, terminal, createdBy, createdByName, updatedBy, updatedByName, createdAt, updatedAt

PASSENGERS SHEET COLUMNS:  
id, name, legalName, phone, telegramChatId, flightCount, createdAt, updatedAt

REQUIRED JSON FORMAT - ONLY ESSENTIAL FLIGHT INFORMATION:
{
  "flights": [
    {
      "flightNumber": "complete flight number (e.g., 'AA1855')",
      "airline": "airline name (e.g., 'American Airlines')", 
      "from": "departure airport 3-letter IATA code (e.g., 'SFO')",
      "to": "arrival airport 3-letter IATA code (e.g., 'LAX')",
      "departureDateTime": "YYYY-MM-DD HH:MM AM/PM format in DEPARTURE airport's local timezone (e.g., '2025-08-17 08:30 AM')",
      "arrivalDateTime": "YYYY-MM-DD HH:MM AM/PM format in ARRIVAL airport's local timezone (e.g., '2025-08-17 10:01 AM')",
      "passengerNames": ["array of ALL passenger names on this flight (e.g., ['John Smith', 'Jane Doe'])"],
      "confirmationCode": "confirmation/PNR code if visible or 'missing'",
      "seatNumbers": ["array of seat assignments if available (e.g., ['24A', '24B']) or empty array"],
      "gate": "gate number if visible or 'missing'",
      "terminal": "terminal if visible or 'missing'"
    }
  ]
}${passengerContext}

CRITICAL INSTRUCTIONS:
1. Return ONLY valid JSON, no additional text or explanation
2. Use exactly "missing" for any field that is not clearly visible
3. Extract ONLY the 5 essential pieces: airline, flight number, airports, date/time, passengers
4. For passenger names: Extract names exactly as they appear on ticket, try to match with existing database
5. Combine date and time into single dateTime fields (e.g., "2025-08-17 08:30 AM")
6. Airport codes must be 3-letter IATA codes in UPPERCASE
7. Current date for smart year inference: ${new Date().toISOString().split('T')[0]}
8. Extract ALL passengers - the ticket may have multiple people
9. Use empty arrays [] for missing array fields, not "missing"
10. TIMEZONE IMPORTANT: Times on tickets are in the airport's local timezone - keep them as-is, don't convert
11. Server will generate IDs and handle all other fields automatically
`;`

      // Send request to Gemini
      const result = await this.model.generateContent([prompt, imageData]);
      const response = await result.response;
      const text = response.text();
      
      console.log('🧠 GEMINI_SERVICE: Raw response length:', text.length);
      
      // Parse JSON response
      let extractedData;
      try {
        // Clean the response - remove any markdown formatting
        let cleanText = text.trim();
        if (cleanText.startsWith('```json')) {
          cleanText = cleanText.replace(/^```json\s*/, '');
        }
        if (cleanText.endsWith('```')) {
          cleanText = cleanText.replace(/\s*```$/, '');
        }
        extractedData = JSON.parse(cleanText);
        console.log('✅ GEMINI_SERVICE: Successfully parsed JSON response');
      } catch (parseError) {
        console.error('❌ GEMINI_SERVICE: JSON parsing failed:', parseError.message);
        console.error('Raw response:', text);
        throw new Error(`Invalid JSON response from Gemini: ${parseError.message}`);
      }

      // Validate and process the multi-flight structure
      const processedFlights = this.processMultiFlightData(extractedData);
      
      console.log('✅ GEMINI_SERVICE: Flight data extraction completed');
      console.log(`📊 GEMINI_SERVICE: Extracted ${processedFlights.length} flight(s)`);
      
      // Handle passengers data from new format
      const extractedPassengers = extractedData.passengers || [];
      console.log(`👥 GEMINI_SERVICE: Extracted ${extractedPassengers.length} passenger(s):`, 
        extractedPassengers.map(p => `${p.name} (ID: ${p.id})`));
      
      for (let i = 0; i < processedFlights.length; i++) {
        const flight = processedFlights[i];
        console.log(`✈️ Flight ${i + 1}:`, {
          airlineName: flight.airlineName || 'missing',
          flightNumber: flight.flightNumber || 'missing',
          passengerNames: flight.passengerNames || [],
          route: `${flight.departureAirport || 'missing'} → ${flight.arrivalAirport || 'missing'}`,
          seatNumbers: flight.seatNumbers || []
        });
      }

      return {
        success: true,
        flights: processedFlights,
        passengers: extractedPassengers,
        source: 'gemini',
        timestamp: new Date().toISOString(),
        confidence: 0.95 // Gemini generally has high confidence
      };

    } catch (error) {
      console.error('❌ GEMINI_SERVICE: Error extracting flight data:', error.message);
      throw error;
    }
  }

  /**
   * Process multi-flight data structure from Gemini
   * @param {Object} rawData - Raw data from Gemini with flights array
   * @returns {Array} - Array of processed flight objects
   */
  processMultiFlightData(rawData) {
    console.log('🔄 GEMINI_SERVICE: Processing multi-flight data structure...');
    
    let flights = [];
    
    // Handle the new multi-flight structure
    if (rawData.flights && Array.isArray(rawData.flights)) {
      console.log(`📋 GEMINI_SERVICE: Found ${rawData.flights.length} flight(s) in response`);
      flights = rawData.flights;
    } else {
      // Fallback: treat the entire response as a single flight (backward compatibility)
      console.log('📋 GEMINI_SERVICE: Using backward compatibility mode - treating as single flight');
      flights = [rawData];
    }
    
    const processedFlights = [];
    
    for (let i = 0; i < flights.length; i++) {
      const flight = flights[i];
      console.log(`🔄 Processing flight ${i + 1}:`, flight.flightNumber || 'unknown');
      
      const processedFlight = this.processSingleFlightData(flight);
      
      // Ensure passengerNames is always an array
      if (processedFlight.passengerNames && Array.isArray(processedFlight.passengerNames)) {
        // Filter out any invalid passenger names and ensure they're full names
        processedFlight.passengerNames = processedFlight.passengerNames
          .filter(name => name && name !== 'missing' && name.trim().length > 0)
          .map(name => name.trim())
          .filter(name => {
            // Ensure we have reasonable full names (at least first and last name)
            const nameParts = name.split(/\s+/);
            return nameParts.length >= 2;
          });
        
        console.log(`👥 GEMINI_SERVICE: Flight ${i + 1} has ${processedFlight.passengerNames.length} passenger(s):`, processedFlight.passengerNames);
      } else {
        // Fallback for old single passenger format
        if (processedFlight.passengerName && processedFlight.passengerName !== 'missing') {
          processedFlight.passengerNames = [processedFlight.passengerName];
          console.log(`👤 GEMINI_SERVICE: Flight ${i + 1} fallback - single passenger:`, processedFlight.passengerName);
        } else {
          processedFlight.passengerNames = [];
          console.log(`⚠️ GEMINI_SERVICE: Flight ${i + 1} has no valid passenger names`);
        }
      }
      
      // Ensure seatNumbers is always an array  
      if (!processedFlight.seatNumbers || !Array.isArray(processedFlight.seatNumbers)) {
        if (processedFlight.seatNumber && processedFlight.seatNumber !== 'missing') {
          processedFlight.seatNumbers = [processedFlight.seatNumber];
        } else {
          processedFlight.seatNumbers = [];
        }
      }
      
      // Only add flights that have the minimum required data
      if (processedFlight.flightNumber && 
          processedFlight.flightNumber !== 'missing' && 
          processedFlight.passengerNames.length > 0) {
        processedFlights.push(processedFlight);
        console.log(`✅ GEMINI_SERVICE: Flight ${i + 1} processed successfully`);
      } else {
        console.log(`❌ GEMINI_SERVICE: Flight ${i + 1} rejected - insufficient data`);
      }
    }
    
    console.log(`✅ GEMINI_SERVICE: Processed ${processedFlights.length} valid flight(s)`);
    return processedFlights;
  }

  /**
   * Process and validate extracted data from Gemini (simplified format)
   * @param {Object} rawData - Raw data from Gemini
   * @returns {Object} - Processed and validated data
   */
  processSingleFlightData(rawData) {
    const processed = { ...rawData };

    // Clean up airport codes
    if (processed.departureAirport && processed.departureAirport !== 'missing') {
      processed.departureAirport = processed.departureAirport.toUpperCase();
    }
    if (processed.arrivalAirport && processed.arrivalAirport !== 'missing') {
      processed.arrivalAirport = processed.arrivalAirport.toUpperCase();
    }

    // Standardize flight number format
    if (processed.flightNumber && processed.flightNumber !== 'missing') {
      processed.flightNumber = processed.flightNumber.toUpperCase().replace(/\s+/g, '');
    }

    // Smart date processing with year inference
    if (processed.departureDate && processed.departureDate !== 'missing') {
      processed.departureDate = this.processDateWithSmartYear(processed.departureDate);
    }
    if (processed.arrivalDate && processed.arrivalDate !== 'missing') {
      processed.arrivalDate = this.processDateWithSmartYear(processed.arrivalDate);
    }

    // If only one date is provided, use it for both departure and arrival
    if (processed.departureDate && processed.departureDate !== 'missing' && 
        (!processed.arrivalDate || processed.arrivalDate === 'missing')) {
      processed.arrivalDate = processed.departureDate;
      console.log('📅 GEMINI_SERVICE: Using departure date for arrival date (same-day flight)');
    }

    return processed;
  }

  /**
   * Process date with smart year inference
   * @param {string} dateString - Date string to process
   * @returns {string} - Processed date string with smart year
   */
  processDateWithSmartYear(dateString) {
    if (!dateString || dateString === 'missing') {
      return dateString;
    }

    let date = dateString;
    
    // If already in YYYY-MM-DD format, return as-is
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }

    // Handle various date formats and apply smart year logic
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1; // getMonth() is 0-indexed

    let month, day, year;

    // Parse different date formats
    if (/^\d{1,2}\/\d{1,2}$/.test(date)) {
      // MM/DD format
      const parts = date.split('/');
      month = parseInt(parts[0]);
      day = parseInt(parts[1]);
    } else if (/^\d{1,2}-\d{1,2}$/.test(date)) {
      // MM-DD format  
      const parts = date.split('-');
      month = parseInt(parts[0]);
      day = parseInt(parts[1]);
    } else if (/^[A-Za-z]{3}\s+\d{1,2}$/.test(date)) {
      // "Dec 11" format
      const parts = date.split(/\s+/);
      const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 
                         'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      month = monthNames.indexOf(parts[0].toLowerCase()) + 1;
      day = parseInt(parts[1]);
    } else {
      // Return original if we can't parse it
      return date;
    }

    // Smart year inference logic
    if (currentMonth >= 11) { // November or December
      // If flight is in Jan-Apr, likely next year
      if (month >= 1 && month <= 4) {
        year = currentYear + 1;
      } else {
        year = currentYear;
      }
    } else if (currentMonth === 12) { // December specifically  
      // If flight is in Jan-Mar, likely next year
      if (month >= 1 && month <= 3) {
        year = currentYear + 1;
      } else {
        year = currentYear;
      }
    } else {
      year = currentYear;
    }

    // Format as YYYY-MM-DD
    const formattedDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    
    console.log(`📅 GEMINI_SERVICE: Smart date inference: "${date}" → "${formattedDate}" (current: ${currentDate.toISOString().split('T')[0]})`);

    return formattedDate;
  }

  /**
   * Get a summary of extracted flight data for logging (simplified format)
   * @param {Object} data - Extracted flight data
   * @returns {string} - Human readable summary
   */
  getDataSummary(data) {
    if (!data.success) return 'Extraction failed';

    const flight = data.data;
    const passenger = flight.passengerName !== 'missing' ? 
      `${flight.passengerName}${flight.seatNumber !== 'missing' ? ` (${flight.seatNumber})` : ''}` : 'missing';
    
    return [
      `Flight: ${flight.airlineName || 'missing'} ${flight.flightNumber || 'missing'}`,
      `Route: ${flight.departureAirport || 'missing'} → ${flight.arrivalAirport || 'missing'}`,
      `Date: ${flight.departureDate || 'missing'} ${flight.departureTime || 'missing'}`,
      `Passenger: ${passenger}`
    ].join(' | ');
  }
}

module.exports = GeminiService;