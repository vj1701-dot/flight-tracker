// Imports the Google Cloud client library
const vision = require('@google-cloud/vision');

let client;
let credentialsInfo = null;

/**
 * Validates Google Cloud credentials and extracts useful info
 * @param {object} credentials - Parsed credentials object
 * @returns {object} Validation result with credential info
 */
function validateCredentials(credentials) {
  const result = { isValid: false, info: {} };
  
  try {
    // Check required fields for service account credentials
    const requiredFields = ['type', 'project_id', 'private_key_id', 'private_key', 'client_email'];
    const missingFields = requiredFields.filter(field => !credentials[field]);
    
    if (missingFields.length > 0) {
      result.error = `Missing required credential fields: ${missingFields.join(', ')}`;
      return result;
    }
    
    // Validate credential type
    if (credentials.type !== 'service_account') {
      result.error = `Invalid credential type: ${credentials.type}. Expected 'service_account'`;
      return result;
    }
    
    // Validate private key format
    if (!credentials.private_key.includes('BEGIN PRIVATE KEY')) {
      result.error = 'Invalid private key format. Must be a valid PEM private key';
      return result;
    }
    
    // Extract useful information
    result.isValid = true;
    result.info = {
      projectId: credentials.project_id,
      clientEmail: credentials.client_email,
      privateKeyId: credentials.private_key_id.substring(0, 8) + '...',
      authUri: credentials.auth_uri,
      tokenUri: credentials.token_uri
    };
    
    return result;
  } catch (error) {
    result.error = `Credential validation failed: ${error.message}`;
    return result;
  }
}

// Initialize the client, preferring the JSON content from the environment variable
if (process.env.GOOGLE_CREDENTIALS_JSON) {
  try {
    console.log('🔍 OCR_SERVICE: Parsing GOOGLE_CREDENTIALS_JSON...');
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
    
    // Validate credentials
    const validation = validateCredentials(credentials);
    if (!validation.isValid) {
      console.error('❌ OCR_SERVICE: Credential validation failed:', validation.error);
      throw new Error(`Invalid credentials: ${validation.error}`);
    }
    
    credentialsInfo = validation.info;
    console.log('✅ OCR_SERVICE: Credentials validated successfully');
    console.log('📋 OCR_SERVICE: Credential Info:');
    console.log(`   Project ID: ${credentialsInfo.projectId}`);
    console.log(`   Service Account: ${credentialsInfo.clientEmail}`);
    console.log(`   Private Key ID: ${credentialsInfo.privateKeyId}`);
    
    // Initialize client with validated credentials
    client = new vision.ImageAnnotatorClient({ 
      credentials,
      // Enable verbose logging for API calls
      libName: 'flight-tracker-ocr',
      libVersion: '1.0.0'
    });
    
    console.log('✅ OCR_SERVICE: Google Vision Client initialized with GOOGLE_CREDENTIALS_JSON');
    
  } catch (parseError) {
    console.error('❌ OCR_SERVICE: Failed to parse/validate GOOGLE_CREDENTIALS_JSON:');
    console.error('   Error:', parseError.message);
    console.error('   Make sure the environment variable contains valid JSON with all required service account fields.');
    
    // Don't fallback silently - let the error propagate
    throw new Error(`OCR service initialization failed: ${parseError.message}`);
  }
} else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  // The standard way: looks for GOOGLE_APPLICATION_CREDENTIALS file path
  console.log('🔍 OCR_SERVICE: Using GOOGLE_APPLICATION_CREDENTIALS file path');
  console.log(`   Credential file: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
  
  client = new vision.ImageAnnotatorClient({
    libName: 'flight-tracker-ocr',
    libVersion: '1.0.0'
  });
  console.log('✅ OCR_SERVICE: Google Vision Client initialized with credential file');
} else {
  console.error('❌ OCR_SERVICE: No Google Cloud credentials found!');
  console.error('   Please set either:');
  console.error('   - GOOGLE_CREDENTIALS_JSON (JSON string of service account key)');
  console.error('   - GOOGLE_APPLICATION_CREDENTIALS (path to service account key file)');
  throw new Error('Google Cloud Vision credentials not configured');
}


/**
 * Extracts text from an image using the Google Cloud Vision API with detailed logging.
 * @param {string} imageUrl - The public URL of the image to process.
 * @returns {Promise<object>} - A promise that resolves to detailed extraction results.
 */
async function extractTextFromImage(imageUrl) {
  try {
    console.log('🔍 OCR_SERVICE: Starting text extraction from image');
    console.log(`   Image URL: ${imageUrl}`);
    console.log(`   Using credentials for project: ${credentialsInfo?.projectId || 'default'}`);
    
    const startTime = Date.now();
    
    // Make the API call with verbose request details
    console.log('📡 OCR_SERVICE: Sending request to Google Vision API...');
    const [result] = await client.textDetection(imageUrl);
    
    const duration = Date.now() - startTime;
    console.log(`✅ OCR_SERVICE: API call completed in ${duration}ms`);

    const detections = result.textAnnotations;
    
    if (!detections || detections.length === 0) {
      console.warn('⚠️  OCR_SERVICE: No text annotations found in image');
      console.log('   This could mean:');
      console.log('   - Image contains no readable text');
      console.log('   - Image quality is too poor');
      console.log('   - Text is in an unsupported language/format');
      
      return {
        success: false,
        fullText: '',
        individualTexts: [],
        error: 'No text found in image',
        metadata: {
          detectionCount: 0,
          processingTimeMs: duration,
          imageUrl: imageUrl
        }
      };
    }

    // Extract detailed information
    const fullText = detections[0].description;
    const individualTexts = detections.slice(1).map((detection, index) => ({
      text: detection.description,
      confidence: detection.confidence || 'unknown',
      boundingPoly: detection.boundingPoly,
      index: index
    }));

    console.log(`📋 OCR_SERVICE: Text extraction successful!`);
    console.log(`   Total text blocks found: ${detections.length}`);
    console.log(`   Full text length: ${fullText.length} characters`);
    console.log(`   Preview (first 100 chars): ${fullText.substring(0, 100)}${fullText.length > 100 ? '...' : ''}`);
    
    // Log individual text detections for debugging
    if (individualTexts.length > 0) {
      console.log('🔍 OCR_SERVICE: Individual text detections:');
      individualTexts.slice(0, 10).forEach((item, index) => {
        console.log(`   ${index + 1}: "${item.text}" (confidence: ${item.confidence})`);
      });
      if (individualTexts.length > 10) {
        console.log(`   ... and ${individualTexts.length - 10} more text blocks`);
      }
    }

    return {
      success: true,
      fullText: fullText,
      individualTexts: individualTexts,
      metadata: {
        detectionCount: detections.length,
        processingTimeMs: duration,
        imageUrl: imageUrl,
        credentialProject: credentialsInfo?.projectId
      }
    };
    
  } catch (error) {
    console.error('❌ OCR_SERVICE: Text extraction failed');
    console.error('   Error type:', error.constructor.name);
    console.error('   Error message:', error.message);
    
    if (error.code) {
      console.error('   API Error code:', error.code);
    }
    
    if (error.details) {
      console.error('   API Error details:', error.details);
    }
    
    // Check for common credential issues
    if (error.message.includes('authentication') || error.message.includes('credentials')) {
      console.error('🔐 OCR_SERVICE: This appears to be a credential issue');
      console.error('   Current credential info:');
      if (credentialsInfo) {
        console.error(`   Project ID: ${credentialsInfo.projectId}`);
        console.error(`   Service Account: ${credentialsInfo.clientEmail}`);
      } else {
        console.error('   No credential info available (using file-based auth)');
      }
    }
    
    // Check for quota/billing issues
    if (error.message.includes('quota') || error.message.includes('billing')) {
      console.error('💳 OCR_SERVICE: This appears to be a quota or billing issue');
      console.error('   Please check your Google Cloud Console for:');
      console.error('   - Vision API is enabled');
      console.error('   - Billing is enabled');
      console.error('   - No quota limits exceeded');
    }
    
    return {
      success: false,
      fullText: '',
      individualTexts: [],
      error: error.message,
      errorCode: error.code,
      metadata: {
        detectionCount: 0,
        processingTimeMs: 0,
        imageUrl: imageUrl,
        errorType: error.constructor.name
      }
    };
  }
}

module.exports = { extractTextFromImage };