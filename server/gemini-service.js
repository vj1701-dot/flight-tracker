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
   * @returns {Promise<Object>} - Extracted flight data
   */
  async extractFlightData(imagePath) {
    if (!this.isAvailable()) {
      throw new Error('Gemini service not available');
    }

    try {
      console.log('🧠 GEMINI_SERVICE: Starting flight data extraction...');
      
      // Prepare the image
      const imageData = await this.prepareImage(imagePath);
      
      // Create the prompt for flight ticket analysis
      const prompt = `
You are an expert flight ticket analyzer. Analyze this flight ticket image and extract flight information.

IMPORTANT: This image may contain MULTIPLE flights or a single flight. Return data in this JSON format:

For ANY number of flights (1 or more):
{
  "flights": [
    {
      "airlineName": "full airline name (e.g., 'United Airlines')",
      "flightNumber": "complete flight number (e.g., 'UA1855')", 
      "departureAirport": "departure airport 3-letter IATA code (e.g., 'SFO')",
      "arrivalAirport": "arrival airport 3-letter IATA code (e.g., 'LAX')",
      "departureDate": "departure date in YYYY-MM-DD format",
      "departureTime": "departure time with AM/PM (e.g., '8:30 AM')",
      "arrivalDate": "arrival date in YYYY-MM-DD format",
      "arrivalTime": "arrival time with AM/PM (e.g., '10:01 AM')",
      "passengerNames": ["array of ALL passenger names on this specific flight"],
      "seatNumbers": ["array of seat assignments if available (e.g., ['24A', '24B'])"],
      "confirmationCode": "confirmation/PNR code if visible"
    }
  ]
}

CRITICAL INSTRUCTIONS:
1. Return ONLY valid JSON, no additional text or explanation
2. Use exactly "missing" (lowercase) for any field that is not clearly visible or readable
3. Extract ALL passenger names from the ticket in the "passengerNames" array
4. Keep times in 12-hour format with AM/PM (e.g., "8:30 AM", "2:15 PM")
5. Airport codes must be 3-letter IATA codes in UPPERCASE
6. If only one date is visible, use it for BOTH departure and arrival dates
7. For dates with smart year inference:
   - If full date with year is visible (e.g., "Dec 11, 2025"), use that year
   - If only month/day (e.g., "Dec 11" or "12/11"), apply smart logic:
   - Current date: ${new Date().toISOString().split('T')[0]}
   - If we're in December and the flight date is January-March, use next year
   - If we're in November-December and flight date is January-April, use next year  
   - Otherwise use current year
   - Always convert to YYYY-MM-DD format
8. Look carefully for multiple passenger names on the ticket - they may be listed separately
9. Even if there's only one passenger, put it in an array: ["JOHN DOE"]
`;

      // Send request to Gemini
      const result = await this.model.generateContent([prompt, imageData]);
      const response = await result.response;
      const text = response.text();
      
      console.log('🧠 GEMINI_SERVICE: Raw response length:', text.length);
      
      // Parse JSON response
      let extractedData;
      try {
        // Clean the response - remove any markdown formatting
        const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
        extractedData = JSON.parse(cleanText);
        console.log('✅ GEMINI_SERVICE: Successfully parsed JSON response');
      } catch (parseError) {
        console.error('❌ GEMINI_SERVICE: JSON parsing failed:', parseError.message);
        console.error('Raw response:', text);
        throw new Error(`Invalid JSON response from Gemini: ${parseError.message}`);
      }

      // Validate and enhance the extracted data
      const processedData = this.processExtractedData(extractedData);
      
      console.log('✅ GEMINI_SERVICE: Flight data extraction completed');
      console.log('📊 GEMINI_SERVICE: Extracted data summary:', {
        airlineName: processedData.airlineName || 'missing',
        flightNumber: processedData.flightNumber || 'missing',
        passengerName: processedData.passengerName || 'missing',
        route: `${processedData.departureAirport || 'missing'} → ${processedData.arrivalAirport || 'missing'}`,
        seatNumber: processedData.seatNumber || 'missing'
      });

      return {
        success: true,
        data: processedData,
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
   * Process and validate extracted data from Gemini (simplified format)
   * @param {Object} rawData - Raw data from Gemini
   * @returns {Object} - Processed and validated data
   */
  processExtractedData(rawData) {
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