// Imports the Google Cloud client library
const vision = require('@google-cloud/vision');

let client;

// Initialize the client, preferring the JSON content from the environment variable
if (process.env.GOOGLE_CREDENTIALS_JSON) {
  try {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
    client = new vision.ImageAnnotatorClient({ credentials });
    console.log('Initialized Google Vision Client with credentials from GOOGLE_CREDENTIALS_JSON environment variable.');
  } catch (e) {
    console.error('Failed to parse GOOGLE_CREDENTIALS_JSON. Make sure it is a valid JSON string. Falling back to default credentials.', e);
    // Fallback to default Application Default Credentials (which uses GOOGLE_APPLICATION_CREDENTIALS file path)
    client = new vision.ImageAnnotatorClient();
  }
} else {
  // The standard way: looks for GOOGLE_APPLICATION_CREDENTIALS file path
  client = new vision.ImageAnnotatorClient();
  console.log('Initialized Google Vision Client using Application Default Credentials.');
}


/**
 * Extracts text from an image using the Google Cloud Vision API.
 * @param {string} imageUrl - The public URL of the image to process.
 * @returns {Promise<string>} - A promise that resolves to the extracted text.
 */
async function extractTextFromImage(imageUrl) {
  try {
    console.log('OCR_SERVICE: Calling Google Vision API.');
    const [result] = await client.textDetection(imageUrl);
    console.log('OCR_SERVICE: Google Vision API call successful.');

    const detections = result.textAnnotations;
    
    if (detections && detections.length > 0) {
      // The first annotation is always the full text block.
      return detections[0].description;
    } else {
      throw new Error('No text found in image.');
    }
  } catch (error) {
    console.error('ERROR in extractTextFromImage:', error);
    throw new Error('Google Cloud Vision API request failed.');
  }
}

module.exports = { extractTextFromImage };