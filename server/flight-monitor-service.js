const FlightInfoService = require('./flight-info-service');
const TelegramNotificationService = require('./telegram-bot');
const { readFlights, writeFlights } = require('./data-helpers');

/**
 * Automated Flight Monitoring and Alert Service
 * Automatically monitors flights starting 6 hours before departure
 */
class FlightMonitorService {
  constructor() {
    this.flightInfoService = new FlightInfoService();
    this.telegramService = new TelegramNotificationService();
    this.monitoringInterval = null;
    this.isMonitoring = false;
    this.checkIntervalMinutes = 30; // Check every 30 minutes
    this.hoursBeforeDeparture = 6; // Start monitoring 6 hours before departure
    this.checkInReminderHours = 24; // Send check-in reminders 24 hours before departure
    this.sentCheckInReminders = new Set(); // Track which flights already got check-in reminders
    
    console.log('🚨 Automatic Flight Monitor Service initialized');
    this.startAutomaticMonitoring();
  }

  /**
   * Start automatic monitoring system
   */
  startAutomaticMonitoring() {
    return this.startMonitoring();
  }

  /**
   * Start monitoring system (main method)
   */
  startMonitoring() {
    if (this.isMonitoring) {
      console.log('⚠️ Monitoring is already running');
      return;
    }

    console.log(`🚁 Starting automatic flight monitoring system`);
    console.log(`📅 Will monitor flights starting ${this.hoursBeforeDeparture} hours before departure`);
    console.log(`⏰ Check interval: every ${this.checkIntervalMinutes} minutes`);

    this.isMonitoring = true;

    // Run initial check
    this.checkFlightsInMonitoringWindow();

    // Set up recurring monitoring every 30 minutes
    this.monitoringInterval = setInterval(() => {
      this.checkFlightsInMonitoringWindow();
    }, this.checkIntervalMinutes * 60 * 1000);
  }

  /**
   * Stop the monitoring system (for maintenance only)
   */
  stopMonitoring() {
    console.log('🛑 Stopping flight monitoring system');
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
  }

  /**
   * Restart monitoring (for admin control)
   */
  restartMonitoring() {
    this.stopMonitoring();
    this.startMonitoring();
  }

  /**
   * Check flights that are within the monitoring window (6 hours before departure)
   */
  async checkFlightsInMonitoringWindow() {
    try {
      console.log('🔍 Checking flights within monitoring window...');
      
      const flights = await readFlights();
      const now = new Date();
      
      // Check for flights needing check-in reminders (24 hours before departure)
      await this.checkCheckInReminders(flights, now);
      
      // Filter for flights that should be monitored (6 hours before departure until departure)
      const flightsToMonitor = flights.filter(flight => {
        const departureTime = new Date(flight.departureDateTime);
        const timeDiff = departureTime - now;
        const hoursUntilDeparture = timeDiff / (1000 * 60 * 60);
        
        // Monitor flights that are:
        // 1. Between 6 hours before departure and departure time
        // 2. Not already departed (positive hours until departure)
        return hoursUntilDeparture > 0 && hoursUntilDeparture <= this.hoursBeforeDeparture;
      });

      console.log(`📊 Found ${flightsToMonitor.length} flights in monitoring window (within ${this.hoursBeforeDeparture} hours of departure)`);

      if (flightsToMonitor.length === 0 && flights.length > 0) {
        console.log('😴 No flights to monitor at this time');
        return;
      }

      // Log which flights are being monitored
      flightsToMonitor.forEach(flight => {
        const departureTime = new Date(flight.departureDateTime);
        const hoursUntil = ((departureTime - now) / (1000 * 60 * 60)).toFixed(1);
        console.log(`📅 Monitoring ${flight.flightNumber} departing in ${hoursUntil} hours`);
      });

      for (const flight of flightsToMonitor) {
        await this.checkFlightStatus(flight);
        // Add small delay between API calls to be respectful
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      console.log('✅ Flight status check completed');
    } catch (error) {
      console.error('❌ Error during flight monitoring:', error);
    }
  }

  /**
   * Check for flights needing 24-hour check-in reminders
   */
  async checkCheckInReminders(flights, now) {
    try {
      const flightsNeedingCheckInReminder = flights.filter(flight => {
        const departureTime = new Date(flight.departureDateTime);
        const timeDiff = departureTime - now;
        const hoursUntilDeparture = timeDiff / (1000 * 60 * 60);
        
        // Send reminder if:
        // 1. Flight is approximately 24 hours away (23.5 to 24.5 hours)
        // 2. We haven't already sent a reminder for this flight
        const isCheckInTime = hoursUntilDeparture >= 23.5 && hoursUntilDeparture <= 24.5;
        const notAlreadySent = !this.sentCheckInReminders.has(flight.id);
        
        return isCheckInTime && notAlreadySent && flight.passengers && flight.passengers.length > 0;
      });

      if (flightsNeedingCheckInReminder.length > 0) {
        console.log(`🎫 Found ${flightsNeedingCheckInReminder.length} flights needing check-in reminders`);
        
        for (const flight of flightsNeedingCheckInReminder) {
          const departureTime = new Date(flight.departureDateTime);
          const hoursUntil = ((departureTime - now) / (1000 * 60 * 60)).toFixed(1);
          
          console.log(`🎫 Sending check-in reminder for ${flight.flightNumber} (departing in ${hoursUntil} hours)`);
          
          try {
            const reminderSent = await this.telegramService.sendCheckInReminder(flight);
            if (reminderSent) {
              this.sentCheckInReminders.add(flight.id);
              console.log(`✅ Check-in reminder sent for flight ${flight.flightNumber}`);
            }
          } catch (error) {
            console.error(`❌ Error sending check-in reminder for flight ${flight.flightNumber}:`, error);
          }
          
          // Small delay between reminders
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } catch (error) {
      console.error('❌ Error checking for check-in reminders:', error);
    }
  }

  /**
   * Check individual flight status and send alerts if needed
   */
  async checkFlightStatus(flight) {
    try {
      const flightDate = new Date(flight.departureDateTime).toISOString().split('T')[0];
      
      console.log(`🔍 Checking status for flight ${flight.flightNumber} on ${flightDate}`);
      
      // Get current flight information from FlightAware
      const currentStatus = await this.flightInfoService.getFlightInfo(flight.flightNumber, flightDate, flight.airline);
      
      if (currentStatus.error) {
        console.log(`⚠️ Could not get status for flight ${flight.flightNumber}: ${currentStatus.message}`);
        return;
      }

      // Check for delays
      const delayInfo = this.analyzeDelayStatus(flight, currentStatus);
      
      if (delayInfo.hasNewDelay || delayInfo.hasStatusChange) {
        await this.sendDelayAlert(flight, currentStatus, delayInfo);
        await this.updateFlightStatus(flight, currentStatus);
      }

    } catch (error) {
      console.error(`❌ Error checking flight ${flight.flightNumber}:`, error);
    }
  }

  /**
   * Analyze flight delay status compared to stored information
   */
  analyzeDelayStatus(storedFlight, currentStatus) {
    const result = {
      hasNewDelay: false,
      hasStatusChange: false,
      delayMinutes: 0,
      statusChange: null,
      previousStatus: storedFlight.lastKnownStatus || 'unknown'
    };

    // Check for status changes
    const currentFlightStatus = currentStatus.flightStatus || 'unknown';
    if (currentFlightStatus !== result.previousStatus) {
      result.hasStatusChange = true;
      result.statusChange = {
        from: result.previousStatus,
        to: currentFlightStatus
      };
    }

    // Check for delays by comparing scheduled vs actual/estimated times
    if (currentStatus.scheduledDepartureRaw && (currentStatus.actualDepartureRaw || currentStatus.estimatedDepartureRaw)) {
      const scheduledTime = new Date(currentStatus.scheduledDepartureRaw);
      const actualTime = new Date(currentStatus.actualDepartureRaw || currentStatus.estimatedDepartureRaw);
      
      const delayMinutes = Math.round((actualTime - scheduledTime) / (1000 * 60));
      
      if (delayMinutes > 15) { // Only alert for delays > 15 minutes
        const previousDelayMinutes = storedFlight.lastKnownDelayMinutes || 0;
        
        // Alert if this is a new delay or delay has increased significantly
        if (delayMinutes > previousDelayMinutes + 10) {
          result.hasNewDelay = true;
          result.delayMinutes = delayMinutes;
        }
      }
    }

    return result;
  }

  /**
   * Send comprehensive delay alert to all relevant parties
   */
  async sendDelayAlert(flight, currentStatus, delayInfo) {
    try {
      console.log(`🚨 Sending comprehensive delay alert for flight ${flight.flightNumber}`);

      // Create base alert message
      let alertMessage = `🚨 *Flight Alert: ${flight.flightNumber}*\n\n`;
      
      // Add delay information
      if (delayInfo.hasNewDelay) {
        alertMessage += `⏰ *DELAY DETECTED*\n`;
        alertMessage += `Delayed by: ${delayInfo.delayMinutes} minutes\n`;
        alertMessage += `New departure time: ${currentStatus.scheduledDeparture}\n\n`;
      }

      // Add status change information  
      if (delayInfo.hasStatusChange) {
        alertMessage += `📊 *Status Change*\n`;
        alertMessage += `From: ${delayInfo.statusChange.from}\n`;
        alertMessage += `To: ${delayInfo.statusChange.to}\n\n`;
      }

      // Add flight details
      alertMessage += `✈️ *Flight Details*\n`;
      alertMessage += `Flight: ${flight.flightNumber}\n`;
      alertMessage += `From: ${currentStatus.departureAirport} (${currentStatus.departureIata})\n`;
      alertMessage += `To: ${currentStatus.arrivalAirport} (${currentStatus.arrivalIata})\n`;
      alertMessage += `Date: ${flight.departureDateTime.split('T')[0]}\n\n`;

      // Add passenger information
      if (flight.passengers && flight.passengers.length > 0) {
        alertMessage += `👥 *Passengers*\n`;
        flight.passengers.forEach(passenger => {
          alertMessage += `• ${passenger.name}\n`;
        });
        alertMessage += `\n`;
      }

      alertMessage += `🔔 Automated alert from West Sant Transportation\n`;
      alertMessage += `Time: ${new Date().toLocaleString()}`;

      // 1. Send to all passengers with Telegram chat IDs
      let passengerCount = 0;
      if (flight.passengers) {
        for (const passenger of flight.passengers) {
          if (passenger.telegramChatId) {
            await this.telegramService.sendMessage(passenger.telegramChatId, alertMessage);
            console.log(`📱 Alert sent to passenger: ${passenger.name}`);
            passengerCount++;
          }
        }
      }

      // 2. Send to volunteers associated with this flight
      let volunteerCount = 0;
      const volunteerNames = [flight.pickupVolunteerName, flight.dropoffVolunteerName].filter(Boolean);
      
      for (const volunteerName of volunteerNames) {
        const volunteerInfo = await this.telegramService.findVolunteerByName(volunteerName);
        if (volunteerInfo && volunteerInfo.telegramChatId) {
          await this.telegramService.sendMessage(volunteerInfo.telegramChatId, alertMessage);
          console.log(`📱 Alert sent to volunteer: ${volunteerName}`);
          volunteerCount++;
        }
      }

      // 3. Send to users responsible for the departure and arrival airports
      let userCount = 0;
      const airportCodes = [currentStatus.departureIata, currentStatus.arrivalIata].filter(Boolean);
      
      for (const airportCode of airportCodes) {
        const usersForAirport = await this.telegramService.findUsersByAirport(airportCode);
        for (const user of usersForAirport) {
          if (user.telegramChatId) {
            // Create personalized message for airport users
            const userMessage = alertMessage + `\n\n📍 *Relevant to your airport: ${airportCode}*`;
            await this.telegramService.sendMessage(user.telegramChatId, userMessage);
            console.log(`📱 Alert sent to airport user: ${user.name} (${airportCode})`);
            userCount++;
          }
        }
      }

      console.log(`✅ Alert distribution complete:`);
      console.log(`   📱 ${passengerCount} passengers notified`);
      console.log(`   🚐 ${volunteerCount} volunteers notified`);
      console.log(`   👤 ${userCount} airport users notified`);

    } catch (error) {
      console.error('❌ Error sending delay alert:', error);
    }
  }

  /**
   * Update stored flight with latest status information
   */
  async updateFlightStatus(flight, currentStatus) {
    try {
      const flights = await readFlights();
      const flightIndex = flights.findIndex(f => f.id === flight.id);
      
      if (flightIndex !== -1) {
        // Update flight with latest status
        flights[flightIndex].lastKnownStatus = currentStatus.flightStatus;
        flights[flightIndex].lastStatusCheck = new Date().toISOString();
        
        // Update delay info if available
        if (currentStatus.scheduledDepartureRaw && (currentStatus.actualDepartureRaw || currentStatus.estimatedDepartureRaw)) {
          const scheduledTime = new Date(currentStatus.scheduledDepartureRaw);
          const actualTime = new Date(currentStatus.actualDepartureRaw || currentStatus.estimatedDepartureRaw);
          const delayMinutes = Math.round((actualTime - scheduledTime) / (1000 * 60));
          
          flights[flightIndex].lastKnownDelayMinutes = delayMinutes;
        }

        await writeFlights(flights);
        console.log(`✅ Updated status for flight ${flight.flightNumber}`);
      }
    } catch (error) {
      console.error('❌ Error updating flight status:', error);
    }
  }

  /**
   * Get monitoring status
   */
  getMonitoringStatus() {
    return {
      isMonitoring: this.isMonitoring,
      checkIntervalMinutes: this.checkIntervalMinutes,
      nextCheckTime: this.monitoringInterval ? new Date(Date.now() + this.checkIntervalMinutes * 60 * 1000) : null
    };
  }

  /**
   * Update monitoring interval
   */
  setCheckInterval(minutes) {
    this.checkIntervalMinutes = Math.max(15, Math.min(minutes, 120)); // Between 15 minutes and 2 hours
    
    if (this.isMonitoring) {
      this.stopMonitoring();
      this.startMonitoring();
    }
    
    console.log(`⏰ Monitoring interval updated to ${this.checkIntervalMinutes} minutes`);
  }
}

module.exports = FlightMonitorService;