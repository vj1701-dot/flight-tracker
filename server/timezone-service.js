/**
 * Timezone Service for handling airport timezone conversions
 */

class TimezoneService {
  constructor() {
    this.airports = null;
    this.loadAirports();
  }

  async loadAirports() {
    try {
      const fs = require('fs').promises;
      const path = require('path');
      const airportsFile = path.join(__dirname, 'data', 'airports.json');
      const data = await fs.readFile(airportsFile, 'utf8');
      this.airports = JSON.parse(data);
      console.log(`📍 Loaded ${this.airports.length} airports with timezone data`);
    } catch (error) {
      console.error('Error loading airports:', error);
      this.airports = [];
    }
  }

  /**
   * Get airport information including timezone
   * @param {string} airportCode - IATA airport code
   * @returns {Object|null} Airport information with timezone
   */
  getAirportInfo(airportCode) {
    if (!this.airports) return null;
    
    return this.airports.find(airport => 
      airport.code.toLowerCase() === airportCode.toLowerCase()
    );
  }

  /**
   * Get timezone for a specific airport
   * @param {string} airportCode - IATA airport code
   * @returns {string|null} Timezone identifier (e.g., 'America/New_York')
   */
  getAirportTimezone(airportCode) {
    const airport = this.getAirportInfo(airportCode);
    return airport ? airport.timezone : null;
  }

  /**
   * Convert UTC time to airport local time
   * @param {string|Date} utcTime - UTC time
   * @param {string} airportCode - IATA airport code
   * @returns {Object} Object with formatted local time and timezone info
   */
  convertToAirportTime(utcTime, airportCode) {
    const airport = this.getAirportInfo(airportCode);
    if (!airport || !airport.timezone) {
      return {
        localTime: new Date(utcTime).toISOString(),
        timezone: 'UTC',
        airportCode: airportCode,
        error: 'Airport timezone not found'
      };
    }

    try {
      const date = new Date(utcTime);
      const localTime = new Intl.DateTimeFormat('en-US', {
        timeZone: airport.timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).formatToParts(date);

      // Reconstruct the formatted date
      const formatted = `${localTime.find(p => p.type === 'year').value}-${localTime.find(p => p.type === 'month').value}-${localTime.find(p => p.type === 'day').value} ${localTime.find(p => p.type === 'hour').value}:${localTime.find(p => p.type === 'minute').value}:${localTime.find(p => p.type === 'second').value}`;

      // Get timezone abbreviation
      const timezoneName = new Intl.DateTimeFormat('en-US', {
        timeZone: airport.timezone,
        timeZoneName: 'short'
      }).formatToParts(date).find(part => part.type === 'timeZoneName')?.value || airport.timezone;

      return {
        localTime: formatted,
        timezone: airport.timezone,
        timezoneAbbr: timezoneName,
        airportCode: airportCode,
        airportName: airport.name,
        city: airport.city,
        state: airport.state
      };
    } catch (error) {
      console.error('Error converting timezone:', error);
      return {
        localTime: new Date(utcTime).toISOString(),
        timezone: 'UTC',
        airportCode: airportCode,
        error: error.message
      };
    }
  }

  /**
   * Convert flight times to appropriate airport timezones
   * @param {Object} flight - Flight object with departure and arrival times
   * @returns {Object} Flight object with timezone-adjusted times
   */
  convertFlightTimes(flight) {
    const result = { ...flight };

    // Convert departure time to departure airport timezone
    if (flight.departureDateTime && flight.from) {
      const depTime = this.convertToAirportTime(flight.departureDateTime, flight.from);
      result.departureLocalTime = depTime.localTime;
      result.departureTimezone = depTime.timezoneAbbr;
    }

    // Convert arrival time to arrival airport timezone
    if (flight.arrivalDateTime && flight.to) {
      const arrTime = this.convertToAirportTime(flight.arrivalDateTime, flight.to);
      result.arrivalLocalTime = arrTime.localTime;
      result.arrivalTimezone = arrTime.timezoneAbbr;
    }

    return result;
  }

  /**
   * Get available timezone options for frontend
   * @returns {Array} Array of timezone objects
   */
  getTimezoneOptions() {
    if (!this.airports) return [];

    const timezones = [...new Set(this.airports.map(airport => airport.timezone))];
    return timezones.map(tz => ({
      value: tz,
      label: this.formatTimezoneLabel(tz)
    })).sort((a, b) => a.label.localeCompare(b.label));
  }

  /**
   * Format timezone for display
   * @param {string} timezone - Timezone identifier
   * @returns {string} Formatted timezone label
   */
  formatTimezoneLabel(timezone) {
    const parts = timezone.split('/');
    if (parts.length === 2) {
      return `${parts[1].replace('_', ' ')} (${timezone})`;
    }
    return timezone;
  }

  /**
   * Get flight duration in hours and minutes
   * @param {string|Date} departureTime - Departure time
   * @param {string|Date} arrivalTime - Arrival time
   * @returns {Object} Duration information
   */
  getFlightDuration(departureTime, arrivalTime) {
    try {
      const dep = new Date(departureTime);
      const arr = new Date(arrivalTime);
      const durationMs = arr - dep;
      
      if (durationMs < 0) {
        return { error: 'Arrival time is before departure time' };
      }

      const hours = Math.floor(durationMs / (1000 * 60 * 60));
      const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

      return {
        hours,
        minutes,
        totalMinutes: Math.floor(durationMs / (1000 * 60)),
        formatted: `${hours}h ${minutes}m`
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Get current time in airport timezone
   * @param {string} airportCode - IATA airport code
   * @returns {Object} Current time in airport timezone
   */
  getCurrentAirportTime(airportCode) {
    return this.convertToAirportTime(new Date(), airportCode);
  }

  /**
   * Check if airport supports timezone conversion
   * @param {string} airportCode - IATA airport code
   * @returns {boolean} True if timezone is available
   */
  hasTimezoneData(airportCode) {
    const airport = this.getAirportInfo(airportCode);
    return airport && airport.timezone;
  }

  /**
   * Auto-populate flight data from airport information
   * @param {string} departureCode - Departure airport code
   * @param {string} arrivalCode - Arrival airport code
   * @returns {Object} Auto-populated flight data
   */
  autoPopulateFlightData(departureCode, arrivalCode) {
    const departure = this.getAirportInfo(departureCode);
    const arrival = this.getAirportInfo(arrivalCode);

    return {
      departure: departure ? {
        code: departure.code,
        name: departure.name,
        city: departure.city,
        state: departure.state,
        timezone: departure.timezone,
        timezoneAbbr: this.getCurrentAirportTime(departureCode).timezoneAbbr
      } : null,
      arrival: arrival ? {
        code: arrival.code,
        name: arrival.name,
        city: arrival.city,
        state: arrival.state,
        timezone: arrival.timezone,
        timezoneAbbr: this.getCurrentAirportTime(arrivalCode).timezoneAbbr
      } : null
    };
  }
}

module.exports = TimezoneService;