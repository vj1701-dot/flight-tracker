// Imports the Google Cloud client library
const vision = require('@google-cloud/vision');
const fetch = require('node-fetch');
const fs = require('fs').promises;
const path = require('path');

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
 * Downloads an image file to temporary storage
 * @param {string} imageUrl - The URL of the image to download
 * @returns {Promise<string>} - Path to the downloaded file
 */
async function downloadImageFile(imageUrl) {
  const startTime = Date.now();
  console.log(`⬇️ OCR_SERVICE: Downloading image from URL: ${imageUrl}`);
  
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
    }
    
    // Create temp directory if it doesn't exist
    const tempDir = '/tmp/ticket-images';
    try {
      await fs.mkdir(tempDir, { recursive: true });
    } catch (mkdirError) {
      // Directory might already exist, ignore
    }
    
    // Generate unique filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2);
    const fileName = `ticket-${timestamp}-${randomId}.jpg`;
    const filePath = path.join(tempDir, fileName);
    
    // Save file
    const buffer = await response.buffer();
    await fs.writeFile(filePath, buffer);
    
    const duration = Date.now() - startTime;
    console.log(`✅ OCR_SERVICE: Image downloaded successfully in ${duration}ms`);
    console.log(`   File path: ${filePath}`);
    console.log(`   File size: ${buffer.length} bytes`);
    
    return filePath;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ OCR_SERVICE: Failed to download image in ${duration}ms:`, error.message);
    throw new Error(`Image download failed: ${error.message}`);
  }
}

/**
 * Deletes a temporary image file
 * @param {string} filePath - Path to the file to delete
 */
async function cleanupImageFile(filePath) {
  try {
    await fs.unlink(filePath);
    console.log(`🗑️ OCR_SERVICE: Cleaned up temporary file: ${filePath}`);
  } catch (error) {
    console.warn(`⚠️ OCR_SERVICE: Failed to cleanup file ${filePath}:`, error.message);
  }
}

/**
 * Extracts text from an image using the Google Cloud Vision API with detailed logging.
 * @param {string} imageUrl - The public URL of the image to process.
 * @returns {Promise<object>} - A promise that resolves to detailed extraction results.
 */
async function extractTextFromImage(imageUrl) {
  let downloadedFilePath = null;
  
  try {
    console.log('🔍 OCR_SERVICE: Starting text extraction from image');
    console.log(`   Image URL: ${imageUrl}`);
    console.log(`   Using credentials for project: ${credentialsInfo?.projectId || 'default'}`);
    
    // Download the image file first
    downloadedFilePath = await downloadImageFile(imageUrl);
    
    const startTime = Date.now();
    
    // Make the API call with verbose request details using local file
    console.log('📡 OCR_SERVICE: Sending request to Google Vision API...');
    console.log('📡 OCR_SERVICE: Using textDetection method for ticket OCR');
    console.log(`📡 OCR_SERVICE: Processing local file: ${downloadedFilePath}`);
    const [result] = await client.textDetection(downloadedFilePath);
    
    const duration = Date.now() - startTime;
    console.log(`✅ OCR_SERVICE: API call completed in ${duration}ms`);
    console.log(`🔍 OCR_SERVICE: Raw result keys: ${Object.keys(result).join(', ')}`);
    
    // Check for API errors first
    if (result.error) {
      console.error(`❌ OCR_SERVICE: Google Vision API returned error:`);
      console.error(`   Code: ${result.error.code}`);
      console.error(`   Message: ${result.error.message}`);
      console.error(`   Details: ${JSON.stringify(result.error.details || 'none')}`);
    }
    
    console.log(`🔍 OCR_SERVICE: Full result structure: ${JSON.stringify(result, null, 2).substring(0, 800)}...`);

    const detections = result.textAnnotations;
    console.log(`🔍 OCR_SERVICE: Text annotations array length: ${detections ? detections.length : 'null'}`);
    console.log(`🔍 OCR_SERVICE: Text annotations type: ${typeof detections}`);
    
    if (!detections || detections.length === 0) {
      console.warn('⚠️  OCR_SERVICE: No text annotations found with textDetection, trying documentTextDetection...');
      
      try {
        const startTime2 = Date.now();
        console.log(`📡 OCR_SERVICE: Trying document detection with local file: ${downloadedFilePath}`);
        const [documentResult] = await client.documentTextDetection(downloadedFilePath);
        const duration2 = Date.now() - startTime2;
        console.log(`✅ OCR_SERVICE: Document text detection completed in ${duration2}ms`);
        
        // Check for API errors in document detection
        if (documentResult.error) {
          console.error(`❌ OCR_SERVICE: Document detection API returned error:`);
          console.error(`   Code: ${documentResult.error.code}`);
          console.error(`   Message: ${documentResult.error.message}`);
          console.error(`   Details: ${JSON.stringify(documentResult.error.details || 'none')}`);
        }
        
        console.log(`🔍 OCR_SERVICE: Document result keys: ${Object.keys(documentResult).join(', ')}`);
        console.log(`🔍 OCR_SERVICE: Document text annotations length: ${documentResult.textAnnotations ? documentResult.textAnnotations.length : 'null'}`);
        
        if (documentResult.textAnnotations && documentResult.textAnnotations.length > 0) {
          console.log(`🎯 OCR_SERVICE: Document detection found ${documentResult.textAnnotations.length} text blocks!`);
          
          const fullText = documentResult.textAnnotations[0].description;
          const individualTexts = documentResult.textAnnotations.slice(1).map((detection, index) => ({
            text: detection.description,
            confidence: detection.confidence || 'unknown',
            boundingPoly: detection.boundingPoly,
            index: index
          }));

          console.log(`📋 OCR_SERVICE: Document text extraction successful!`);
          console.log(`   Total text blocks found: ${documentResult.textAnnotations.length}`);
          console.log(`   Full text length: ${fullText.length} characters`);
          console.log(`   Preview (first 200 chars): ${fullText.substring(0, 200)}${fullText.length > 200 ? '...' : ''}`);

          // Cleanup downloaded file before returning
          if (downloadedFilePath) {
            await cleanupImageFile(downloadedFilePath);
          }

          return {
            success: true,
            fullText: fullText,
            individualTexts: individualTexts,
            method: 'documentTextDetection',
            metadata: {
              detectionCount: documentResult.textAnnotations.length,
              processingTimeMs: duration + duration2,
              imageUrl: imageUrl,
              credentialProject: credentialsInfo?.projectId,
              downloadedFile: downloadedFilePath
            }
          };
        }
      } catch (docError) {
        console.error('❌ OCR_SERVICE: Document text detection also failed:', docError.message);
      }
      
      console.warn('⚠️  OCR_SERVICE: No text found with either method');
      console.log('   This could mean:');
      console.log('   - Image contains no readable text');
      console.log('   - Image quality is too poor');
      console.log('   - Text is in an unsupported language/format');
      console.log('   - Try a clearer, higher-contrast image');
      
      // Cleanup downloaded file before returning
      if (downloadedFilePath) {
        await cleanupImageFile(downloadedFilePath);
      }
      
      return {
        success: false,
        fullText: '',
        individualTexts: [],
        error: 'No text found in image (tried both textDetection and documentTextDetection)',
        metadata: {
          detectionCount: 0,
          processingTimeMs: duration,
          imageUrl: imageUrl,
          downloadedFile: downloadedFilePath
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

    // Cleanup downloaded file before returning
    if (downloadedFilePath) {
      await cleanupImageFile(downloadedFilePath);
    }

    return {
      success: true,
      fullText: fullText,
      individualTexts: individualTexts,
      method: 'textDetection',
      metadata: {
        detectionCount: detections.length,
        processingTimeMs: duration,
        imageUrl: imageUrl,
        credentialProject: credentialsInfo?.projectId,
        downloadedFile: downloadedFilePath
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