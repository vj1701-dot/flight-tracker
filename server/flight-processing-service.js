const fs = require('fs').promises;
const path = require('path');
const { extractTextFromImage } = require('./ocr-service');
const { v4: uuidv4 } = require('uuid');

const passengersFilePath = path.join(__dirname, 'passengers.json');
const flightsFilePath = path.join(__dirname, 'flights.json');

/**
 * Finds a passenger by matching the extracted name against their legal name.
 * @param {string} extractedName - The name extracted from the ticket OCR.
 * @returns {object|null} The matching passenger object or null.
 */
async function findPassengerByLegalName(extractedName) {
  const passengersData = await fs.readFile(passengersFilePath, 'utf-8');
  const passengers = JSON.parse(passengersData);
  
  const normalizedExtracted = extractedName.toLowerCase().replace(/,(?=\S)/g, ', ').replace(/\s+/g, ' ').trim();

  for (const passenger of passengers) {
    if (!passenger.legalName) continue;
    const legalName = passenger.legalName.toLowerCase().trim();

    if (legalName === normalizedExtracted) {
      return passenger;
    }

    const parts = legalName.split(' ');
    if (parts.length >= 2) {
      const firstName = parts.slice(0, -1).join(' ');
      const lastName = parts[parts.length - 1];
      if (`${lastName}, ${firstName}` === normalizedExtracted) {
        return passenger;
      }
    }
  }
  return null;
}

/**
 * Parses flight data from raw text.
 * This is a simplified version and will need to be made more robust.
 * @param {string} text - The raw text from OCR.
 * @returns {object} - An object containing parsed flight data.
 */
function parseFlightData(text) {
  const data = {};

  // Very basic flight number regex
  const flightRegex = /([A-Z]{2,3})\s*(\d{3,4})/;
  const flightMatch = text.match(flightRegex);
  if (flightMatch) {
    data.flightNumber = flightMatch[0].replace(' ', '');
  }

  // Very basic passenger name regex (looks for a line with "Passenger")
  const passengerRegex = /(?:passenger|name)\s*[:\-]?\s*([A-Z'\s,]+)/i;
  const passengerMatch = text.match(passengerRegex);
  if (passengerMatch) {
    data.passengerName = passengerMatch[1].trim();
  }
  
  // Date and other fields would be parsed here
  // For now, we'll leave them blank
  data.departureDateTime = null;
  data.arrivalDateTime = null;
  data.from = null;
  data.to = null;
  data.airline = null;


  return data;
}


/**
 * Main function to process a flight ticket image.
 * @param {string} imageUrl - URL of the ticket image.
 * @returns {object} The newly created flight object.
 */
async function processFlightTicket(imageUrl) {
  const text = await extractTextFromImage(imageUrl);
  const parsedData = parseFlightData(text);

  if (!parsedData.flightNumber || !parsedData.passengerName) {
    throw new Error('Could not extract flight number or passenger name.');
  }

  const passenger = await findPassengerByLegalName(parsedData.passengerName);
  if (!passenger) {
    throw new Error(`Could not find a passenger matching name: ${parsedData.passengerName}`);
  }

  const flightsData = await fs.readFile(flightsFilePath, 'utf-8');
  const flights = JSON.parse(flightsData);

  const newFlight = {
    id: uuidv4(),
    airline: parsedData.airline,
    flightNumber: parsedData.flightNumber,
    from: parsedData.from,
    to: parsedData.to,
    departureDateTime: parsedData.departureDateTime,
    arrivalDateTime: parsedData.arrivalDateTime,
    passengers: [{ id: passenger.id, name: passenger.name }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  flights.push(newFlight);
  await fs.writeFile(flightsFilePath, JSON.stringify(flights, null, 2));

  return newFlight;
}

module.exports = { processFlightTicket };
