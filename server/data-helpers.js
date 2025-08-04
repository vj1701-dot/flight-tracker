const fs = require('fs').promises;
const path = require('path');

const FLIGHTS_FILE = path.join(__dirname, 'flights.json');
const USERS_FILE = path.join(__dirname, 'users.json');
const PASSENGERS_FILE = path.join(__dirname, 'passengers.json');
const VOLUNTEERS_FILE = path.join(__dirname, 'volunteers.json');

async function readFlights() {
  try {
    const data = await fs.readFile(FLIGHTS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function writeFlights(flights) {
  await fs.writeFile(FLIGHTS_FILE, JSON.stringify(flights, null, 2));
}

async function readUsers() {
  try {
    const data = await fs.readFile(USERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function writeUsers(users) {
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
}

async function readPassengers() {
  try {
    const data = await fs.readFile(PASSENGERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function writePassengers(passengers) {
  await fs.writeFile(PASSENGERS_FILE, JSON.stringify(passengers, null, 2));
}

async function readVolunteers() {
  try {
    const data = await fs.readFile(VOLUNTEERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function writeVolunteers(volunteers) {
  await fs.writeFile(VOLUNTEERS_FILE, JSON.stringify(volunteers, null, 2));
}

module.exports = {
  readFlights,
  writeFlights,
  readUsers,
  writeUsers,
  readPassengers,
  writePassengers,
  readVolunteers,
  writeVolunteers
};