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
You are an expert flight ticket analyzer. Analyze this flight ticket image and extract the following information in valid JSON format.

Please extract these fields (use null if not clearly visible):
{
  "airline": "airline name or code (e.g., 'United Airlines' or 'UA')",
  "flightNumber": "flight number (e.g., 'UA1855')",
  "passengers": [
    {
      "name": "passenger full name as appears on ticket",
      "seatNumber": "seat assignment (e.g., '24A')"
    }
  ],
  "departure": {
    "airport": "departure airport code (e.g., 'SFO')",
    "city": "departure city name",
    "date": "departure date in YYYY-MM-DD format",
    "time": "departure time in HH:MM format (24-hour)"
  },
  "arrival": {
    "airport": "arrival airport code (e.g., 'LAX')",
    "city": "arrival city name", 
    "date": "arrival date in YYYY-MM-DD format",
    "time": "arrival time in HH:MM format (24-hour)"
  },
  "confirmationCode": "booking reference or PNR code",
  "gate": "departure gate if visible",
  "terminal": "departure terminal if visible"
}

Important rules:
1. Return ONLY valid JSON, no additional text or explanation
2. Use null for any field that is not clearly visible or readable
3. For passenger names, extract exactly as they appear on the ticket
4. Convert all times to 24-hour format (e.g., 8:30 AM becomes "08:30")
5. If multiple passengers, include all of them in the passengers array
6. For dates: SMART YEAR INFERENCE:
   - If full date with year is visible (e.g., "Dec 11, 2025"), use that year
   - If only month/day (e.g., "Dec 11" or "12/11"), apply smart logic:
   - Current date: ${new Date().toISOString().split('T')[0]}
   - If we're in December and the flight date is January-March, use next year
   - If we're in November-December and flight date is January-April, use next year  
   - Otherwise use current year
   - Always convert to YYYY-MM-DD format
7. Airport codes should be 3-letter IATA codes in uppercase
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
        airline: processedData.airline,
        flightNumber: processedData.flightNumber,
        passengerCount: processedData.passengers?.length || 0,
        route: `${processedData.departure?.airport || 'N/A'} → ${processedData.arrival?.airport || 'N/A'}`
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
   * Process and validate extracted data from Gemini
   * @param {Object} rawData - Raw data from Gemini
   * @returns {Object} - Processed and validated data
   */
  processExtractedData(rawData) {
    const processed = { ...rawData };

    // Ensure passengers is an array
    if (processed.passengers && !Array.isArray(processed.passengers)) {
      processed.passengers = [processed.passengers];
    }

    // Clean up airport codes
    if (processed.departure?.airport) {
      processed.departure.airport = processed.departure.airport.toUpperCase();
    }
    if (processed.arrival?.airport) {
      processed.arrival.airport = processed.arrival.airport.toUpperCase();
    }

    // Standardize flight number format
    if (processed.flightNumber) {
      processed.flightNumber = processed.flightNumber.toUpperCase().replace(/\s+/g, '');
    }

    // Smart date processing with year inference
    processed.departure = this.processDateWithSmartYear(processed.departure);
    processed.arrival = this.processDateWithSmartYear(processed.arrival);

    // Add seat numbers to a separate field for easy access
    if (processed.passengers && processed.passengers.length > 0) {
      processed.seatNumbers = processed.passengers
        .map(p => p.seatNumber)
        .filter(seat => seat && seat !== null);
    }

    return processed;
  }

  /**
   * Process date with smart year inference
   * @param {Object} dateTimeObj - Object with date and time fields
   * @returns {Object} - Processed object with smart year
   */
  processDateWithSmartYear(dateTimeObj) {
    if (!dateTimeObj || !dateTimeObj.date) {
      return dateTimeObj;
    }

    let date = dateTimeObj.date;
    
    // If already in YYYY-MM-DD format, return as-is
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return dateTimeObj;
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
      return dateTimeObj;
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

    return {
      ...dateTimeObj,
      date: formattedDate
    };
  }

  /**
   * Get a summary of extracted flight data for logging
   * @param {Object} data - Extracted flight data
   * @returns {string} - Human readable summary
   */
  getDataSummary(data) {
    if (!data.success) return 'Extraction failed';

    const flight = data.data;
    const passengers = flight.passengers?.map(p => `${p.name}${p.seatNumber ? ` (${p.seatNumber})` : ''}`).join(', ') || 'N/A';
    
    return [
      `Flight: ${flight.airline} ${flight.flightNumber}`,
      `Route: ${flight.departure?.airport} → ${flight.arrival?.airport}`,
      `Date: ${flight.departure?.date} ${flight.departure?.time}`,
      `Passengers: ${passengers}`
    ].join(' | ');
  }
}

module.exports = GeminiService;