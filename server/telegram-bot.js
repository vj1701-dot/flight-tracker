const TelegramBot = require('node-telegram-bot-api');
const fetch = require('node-fetch');
const fs = require('fs').promises;
const path = require('path');
const { readUsers, writeUsers, readFlights, readPassengers, writePassengers, findPassengerByName } = require('./data-helpers');
const FlightInfoService = require('./flight-info-service');
const TimezoneService = require('./timezone-service');
const { processFlightTicket } = require('./flight-processing-service');

// Telegram bot token
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Security validation for production
if (process.env.NODE_ENV === 'production' && !BOT_TOKEN) {
  console.error('⚠️  WARNING: TELEGRAM_BOT_TOKEN not set in production!');
}

class TelegramNotificationService {
  constructor() {
    // Track registration states for multi-step registration
    this.registrationStates = new Map();
    this.registrationStatesFile = path.join(__dirname, 'registration-states.json');
    
    if (!BOT_TOKEN) {
      console.log('⚠️  Telegram bot token not configured. Set TELEGRAM_BOT_TOKEN environment variable.');
      this.bot = null;
      return;
    }

    this.processedMessages = new Set();
    this.processedMessagesFile = path.join(__dirname, 'processed-messages.json');
    this.flightInfoService = new FlightInfoService();
    this.timezoneService = new TimezoneService();
    
    // Use webhooks in production, polling in development
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction) {
      this.bot = new TelegramBot(BOT_TOKEN);
      console.log('🤖 Telegram bot initialized for webhook mode (production)');
    } else {
      this.bot = new TelegramBot(BOT_TOKEN, { 
        polling: {
          interval: 1000,
          autoStart: true,
          params: {
            timeout: 10
          }
        }
      });
      console.log('🤖 Telegram bot started with polling (development)');
    }
    
    this.loadProcessedMessages();
    this.loadRegistrationStates();
    this.setupCommands();
    this.setupErrorHandling();
  }

  setupErrorHandling() {
    if (!this.bot) return;

    this.bot.on('polling_error', (error) => {
      console.log('Telegram polling error:', error.message);
    });

    this.bot.on('error', (error) => {
      console.log('Telegram bot error:', error.message);
    });
  }

  async loadProcessedMessages() {
    try {
      const { cloudStorage } = require('./cloud-storage-helpers');
      const messages = await cloudStorage.readProcessedMessages();
      this.processedMessages = new Set(messages);
      console.log(`Loaded ${this.processedMessages.size} processed messages from Cloud Storage`);
    } catch (error) {
      // File doesn't exist or is invalid, start fresh
      this.processedMessages = new Set();
      console.log('Starting with fresh processed messages cache');
    }
  }

  async saveProcessedMessages() {
    try {
      const { cloudStorage } = require('./cloud-storage-helpers');
      const messages = Array.from(this.processedMessages);
      await cloudStorage.writeProcessedMessages(messages);
    } catch (error) {
      console.error('Error saving processed messages:', error);
    }
  }

  async loadRegistrationStates() {
    try {
      const { cloudStorage } = require('./cloud-storage-helpers');
      const states = await cloudStorage.readRegistrationStates();
      this.registrationStates = new Map(Object.entries(states));
      console.log(`Loaded ${this.registrationStates.size} registration states from Cloud Storage`);
    } catch (error) {
      // File doesn't exist or is invalid, start fresh
      this.registrationStates = new Map();
      console.log('Starting with fresh registration states cache');
    }
  }

  async saveRegistrationStates() {
    try {
      const { cloudStorage } = require('./cloud-storage-helpers');
      const states = Object.fromEntries(this.registrationStates);
      await cloudStorage.writeRegistrationStates(states);
    } catch (error) {
      console.error('Error saving registration states:', error);
    }
  }

  // Helper methods to automatically save when modifying registration states
  async setRegistrationState(chatId, state) {
    this.registrationStates.set(chatId, state);
    await this.saveRegistrationStates();
  }

  async deleteRegistrationState(chatId) {
    this.registrationStates.delete(chatId);
    await this.saveRegistrationStates();
  }

  async isMessageProcessed(msg) {
    const messageId = `${msg.chat.id}_${msg.message_id}`;
    if (this.processedMessages.has(messageId)) {
      return true;
    }
    this.processedMessages.add(messageId);
    
    // Keep only last 1000 processed messages to prevent memory leak
    if (this.processedMessages.size > 1000) {
      const firstItem = this.processedMessages.values().next().value;
      this.processedMessages.delete(firstItem);
    }
    
    // Save to file periodically (every 10th message)
    if (this.processedMessages.size % 10 === 0) {
      await this.saveProcessedMessages();
    }
    
    return false;
  }

  // Separate message tracking for photo messages only
  async isPhotoMessageProcessed(msg) {
    const messageId = `photo_${msg.chat.id}_${msg.message_id}`;
    return this.processedMessages.has(messageId);
  }

  async markPhotoMessageAsProcessed(msg) {
    const messageId = `photo_${msg.chat.id}_${msg.message_id}`;
    this.processedMessages.add(messageId);
    
    // Keep only last 1000 processed messages to prevent memory leak
    if (this.processedMessages.size > 1000) {
      const firstItem = this.processedMessages.values().next().value;
      this.processedMessages.delete(firstItem);
    }
    
    // Save to file periodically (every 10th message)
    if (this.processedMessages.size % 10 === 0) {
      await this.saveProcessedMessages();
    }
  }

  // Check if user exists in any role
  async checkExistingRoles(chatId) {
    const existingRoles = [];
    
    try {
      // Check passengers
      const passengers = await readPassengers();
      const passenger = passengers.find(p => p.telegramChatId === chatId);
      if (passenger) {
        existingRoles.push({ type: 'passenger', data: passenger });
      }
      
      // Check users
      const users = await readUsers();
      const user = users.find(u => u.telegramChatId === chatId);
      if (user) {
        existingRoles.push({ type: 'user', data: user });
      }
      
      // Check volunteers (in users file with role='volunteer')
      const volunteer = users.find(u => u.telegramChatId === chatId && u.role === 'volunteer');
      if (volunteer && !existingRoles.find(r => r.type === 'user')) {
        // Only add as separate volunteer if not already a user
        existingRoles.push({ type: 'volunteer', data: volunteer });
      }
      
    } catch (error) {
      console.error('Error checking existing roles:', error);
    }
    
    return existingRoles;
  }

  /**
   * Format airport display in proper format: IATA, City, State (no Country for USA)
   * @param {string} airportCode - Airport IATA code
   * @returns {string} Formatted airport display
   */
  formatAirportDisplay(airportCode) {
    if (!airportCode) return 'Unknown Airport';
    
    const airport = this.timezoneService.getAirportInfo(airportCode);
    if (airport) {
      // Format: IATA, City, State (no Country for USA)
      return airport.country === 'USA' 
        ? `${airport.code}, ${airport.city}, ${airport.state}`
        : `${airport.code}, ${airport.city}, ${airport.state || airport.country}`;
    }
    
    // Fallback if airport not found
    return airportCode;
  }

  /**
   * Format datetime with airport timezone
   * @param {string|Date} datetime - Flight datetime 
   * @param {string} airportCode - Airport IATA code
   * @returns {string} Formatted datetime with timezone
   */
  formatDateTimeWithTimezone(datetime, airportCode) {
    if (!datetime) return 'Not available';
    
    try {
      // Handle both legacy datetime format and new separate date/time format
      let date, time;
      
      if (typeof datetime === 'string' && datetime.includes('T')) {
        // Legacy format: "2025-08-11T15:30:00.000Z"
        const dateObj = new Date(datetime);
        date = dateObj.toISOString().split('T')[0];
        time = dateObj.toISOString().split('T')[1].substring(0, 5);
      } else {
        // Could be other formats, try to parse
        const dateObj = new Date(datetime);
        date = dateObj.toISOString().split('T')[0];
        time = dateObj.toISOString().split('T')[1].substring(0, 5);
      }
      
      // Use the new timezone service method for telegram formatting
      return this.timezoneService.formatDateTimeForTelegram(date, time, airportCode);
      
    } catch (error) {
      console.error('Error formatting datetime with timezone:', error);
      // Fallback formatting
      try {
        return new Date(datetime).toLocaleString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        }) + ' UTC';
      } catch (fallbackError) {
        return 'Time formatting error';
      }
    }
  }

  // Handler functions for manual command processing in webhook mode
  async handleHelpCommand(chatId) {
    const helpMessage = 
      `Jai Swaminarayan 🙏\n\n` +
      `🤖 West Sant Transportation Bot\n\n` +
      `Registration Commands:\n` +
      `• /start - Start registration process\n` +
      `• /register_volunteer - Register as Volunteer\n` +
      `• /register_passenger - Register as Passenger\n` +
      `• /register_user - Register as Dashboard User\n\n` +
      `Flight Commands:\n` +
      `• /flights - View your assigned flights (Volunteers)\n` +
      `• /myflights - View your passenger flights\n` +
      `• /upcomingflights - View upcoming flights at your airports (Dashboard Users)\n` +
      `• /flightinfo FLIGHT_NUMBER DATE - Get flight details from our system\n` +
      `• /help - Show this help menu\n\n` +
      `Features:\n` +
      `✈️ Flight details and passenger information\n` +
      `🚨 Automatic delay alerts (for flights in our system)\n` +
      `🕐 Real-time notifications for changes\n\n` +
      `Notifications:\n` +
      `🔔 Flight confirmations (Passengers)\n` +
      `🔔 24-hour check-in reminders (Passengers)\n` +
      `🔔 Drop-off: 6-hour & 3-hour reminders (Volunteers)\n` +
      `🔔 Pickup: 6-hour & 1-hour reminders (Volunteers)\n` +
      `🔔 Flight changes or delays (All)\n` +
      `🔔 Dashboard system notifications (Dashboard Users)\n\n` +
      `Need help? Contact your administrator.`;

    await this.bot.sendMessage(chatId, helpMessage);
  }

  async handleStartCommand(chatId) {
    try {
      await this.bot.sendMessage(chatId, 
        `Jai Swaminarayan 🙏\n\n` +
        `Welcome to the West Sant Transportation Bot!\n\n` +
        `Please choose your registration type:\n` +
        `• /register_volunteer - If you help with transportation\n` +
        `• /register_passenger - If you are a passenger\n` +
        `• /register_user - If you need dashboard access\n\n` +
        `Type /help for more commands.`
      );
    } catch (error) {
      console.error('Start command error:', error);
    }
  }

  async handleUpcomingFlightsCommand(chatId) {
    try {
      const users = await readUsers();
      const user = users.find(u => u.telegramChatId === chatId);

      if (!user) {
        await this.bot.sendMessage(chatId, 
          `Jai Swaminarayan 🙏\n\n` +
          `❌ You're not registered as a dashboard user. Please send /start to register first.`
        );
        return;
      }

      // Check user's allowed airports
      if (!user.allowedAirports || user.allowedAirports.length === 0) {
        await this.bot.sendMessage(chatId, 
          `Jai Swaminarayan 🙏\n\n` +
          `📍 Your Airport Access\n\n` +
          `You don't have any airports assigned yet.\n\n` +
          `Contact your administrator to get airport access permissions.`
        );
        return;
      }

      const flights = await readFlights();
      const passengers = await readPassengers();
      const now = new Date();
      
      // Get upcoming flights for user's airports (next 7 days)
      const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const upcomingFlights = flights.filter(flight => {
        const departureTime = new Date(flight.departureDateTime);
        return departureTime > now && 
               departureTime <= oneWeekFromNow &&
               (user.allowedAirports.includes(flight.from) || 
                user.allowedAirports.includes(flight.to));
      });

      if (upcomingFlights.length === 0) {
        const airportList = user.allowedAirports.map(code => this.formatAirportDisplay(code)).join(', ');
        await this.bot.sendMessage(chatId, 
          `Jai Swaminarayan 🙏\n\n` +
          `📍 Your Airports\n${airportList}\n\n` +
          `✈️ Upcoming Flights (Next 7 Days)\n\n` +
          `No upcoming flights found for your assigned airports.\n\n` +
          `Flights will appear here when scheduled for your airport locations.`,
        );
        return;
      }

      // Sort flights by departure time
      upcomingFlights.sort((a, b) => new Date(a.departureDateTime) - new Date(b.departureDateTime));

      let flightList = `Jai Swaminarayan 🙏\n\n📍 Upcoming Flights at Your Airports\n`;
      flightList += `${user.allowedAirports.map(code => this.formatAirportDisplay(code)).join(', ')}\n\n`;
      
      for (let i = 0; i < upcomingFlights.length; i++) {
        const flight = upcomingFlights[i];
        
        flightList += `Flight ${i + 1} of ${upcomingFlights.length}\n`;
        flightList += `✈️ ${flight.airline} ${flight.flightNumber}\n\n`;
        
        // Route Information with timezone
        flightList += `🛫 Departure\n`;
        flightList += `${this.formatAirportDisplay(flight.from)}\n`;
        flightList += `${this.formatDateTimeWithTimezone(flight.departureDateTime, flight.from)}\n`;
        if (user.allowedAirports.includes(flight.from)) {
          flightList += `📍 Your Airport ⭐\n`;
        }
        flightList += `\n`;
        
        flightList += `🛬 Arrival\n`;
        flightList += `${this.formatAirportDisplay(flight.to)}\n`;
        flightList += `${this.formatDateTimeWithTimezone(flight.arrivalDateTime, flight.to)}\n`;
        if (user.allowedAirports.includes(flight.to)) {
          flightList += `📍 Your Airport ⭐\n`;
        }
        flightList += `\n`;
        
        // Passengers
        if (flight.passengers?.length > 0) {
          const passengerNames = [];
          for (const p of flight.passengers) {
            if (p.name) {
              passengerNames.push(p.name);
            } else if (p.passengerId) {
              const passenger = passengers.find(passenger => passenger.id === p.passengerId);
              if (passenger) {
                passengerNames.push(passenger.name);
              } else {
                passengerNames.push('Unknown Passenger');
              }
            }
          }
          flightList += `👥 Passengers (${passengerNames.length})\n`;
          flightList += `${passengerNames.join(', ')}\n\n`;
        }
        
        // Transportation
        if (flight.pickupSevakName || flight.dropoffSevakName) {
          flightList += `🚗 Transportation\n`;
          if (flight.pickupSevakName) {
            flightList += `Pickup: ${flight.pickupSevakName}`;
            if (flight.pickupSevakPhone) {
              flightList += ` • ${flight.pickupSevakPhone}`;
            }
            flightList += `\n`;
          }
          if (flight.dropoffSevakName) {
            flightList += `Dropoff: ${flight.dropoffSevakName}`;
            if (flight.dropoffSevakPhone) {
              flightList += ` • ${flight.dropoffSevakPhone}`;
            }
            flightList += `\n`;
          }
          flightList += `\n`;
        }
        
        // Notes
        if (flight.notes && flight.notes.trim()) {
          flightList += `📝 Notes\n${flight.notes}\n\n`;
        }
        
        // Add separator between flights
        if (i < upcomingFlights.length - 1) {
          flightList += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
        }
      }
      
      flightList += `\n💡 Your airport assignments can be updated by your administrator.`;

      await this.bot.sendMessage(chatId, flightList);
    } catch (error) {
      console.error('UpcomingFlights command error:', error);
      await this.bot.sendMessage(chatId, 
        `❌ Error retrieving upcoming flights. Please try again or contact support if the issue persists.`
      );
    }
  }

  async handleFlightsCommand(chatId) {
    try {
      const users = await readUsers();
      const user = users.find(u => u.telegramChatId === chatId);

      if (!user) {
        // Check if they're registered as a passenger instead
        const passengers = await readPassengers();
        const passenger = passengers.find(p => p.telegramChatId === chatId);
        
        if (passenger) {
          await this.bot.sendMessage(chatId, 
            `Jai Swaminarayan 🙏\n\n` +
            `ℹ️ You're registered as a passenger. For your flights, please use:\n\n` +
            `/myflights - View your passenger flights\n\n` +
            `The /flights command is for volunteers only.`
          );
          return;
        }
        
        await this.bot.sendMessage(chatId, 
          `Jai Swaminarayan 🙏\n\n` +
          `❌ You're not registered. Please send /start to register first.`
        );
        return;
      }

      const flights = await readFlights();
      const passengers = await readPassengers();
      const now = new Date();
      const userFlights = flights.filter(flight => {
        const departureTime = new Date(flight.departureDateTime);
        return departureTime > now &&
               (flight.pickupSevakName?.toLowerCase().includes(user.name.toLowerCase()) ||
                flight.dropoffSevakName?.toLowerCase().includes(user.name.toLowerCase()));
      });

      if (userFlights.length === 0) {
        await this.bot.sendMessage(chatId, 
          `Jai Swaminarayan 🙏\n\n` +
          `✈️ Your Flight Assignments\n\n` +
          `No upcoming flight assignments found.\n\n` +
          `Your transportation duties will appear here once assigned by your coordinator.`,
        );
        return;
      }

      // Sort flights by departure time
      userFlights.sort((a, b) => new Date(a.departureDateTime) - new Date(b.departureDateTime));

      let flightList = `Jai Swaminarayan 🙏\n\n🚗 Your Transportation Assignments\n\n`;
      
      for (let i = 0; i < userFlights.length; i++) {
        const flight = userFlights[i];
        
        flightList += `Assignment ${i + 1} of ${userFlights.length}\n`;
        flightList += `✈️ ${flight.airline} ${flight.flightNumber}\n\n`;
        
        // Route Information with timezone
        flightList += `🛫 Departure\n`;
        flightList += `${this.formatAirportDisplay(flight.from)}\n`;
        flightList += `${this.formatDateTimeWithTimezone(flight.departureDateTime, flight.from)}\n\n`;
        
        flightList += `🛬 Arrival\n`;
        flightList += `${this.formatAirportDisplay(flight.to)}\n`;
        flightList += `${this.formatDateTimeWithTimezone(flight.arrivalDateTime, flight.to)}\n\n`;
        
        // Assignment Details
        const isPickupAssignment = flight.pickupSevakName?.toLowerCase().includes(user.name.toLowerCase());
        const isDropoffAssignment = flight.dropoffSevakName?.toLowerCase().includes(user.name.toLowerCase());
        
        flightList += `🎯 Your Responsibility\n`;
        if (isPickupAssignment && isDropoffAssignment) {
          flightList += `Both Pickup & Dropoff\n\n`;
        } else if (isPickupAssignment) {
          flightList += `Pickup Service\n\n`;
        } else if (isDropoffAssignment) {
          flightList += `Dropoff Service\n\n`;
        }
        
        // Passengers
        if (flight.passengers?.length > 0) {
          const passengerNames = [];
          for (const p of flight.passengers) {
            if (p.name) {
              passengerNames.push(p.name);
            } else if (p.passengerId) {
              const passenger = passengers.find(passenger => passenger.id === p.passengerId);
              if (passenger) {
                passengerNames.push(passenger.name);
              } else {
                passengerNames.push('Unknown Passenger');
              }
            }
          }
          flightList += `👥 Passengers (${passengerNames.length})\n`;
          flightList += `${passengerNames.join(', ')}\n\n`;
        }
        
        // Contact Information
        if (isPickupAssignment && flight.pickupSevakPhone) {
          flightList += `📞 Your Contact\n${flight.pickupSevakPhone}\n\n`;
        } else if (isDropoffAssignment && flight.dropoffSevakPhone) {
          flightList += `📞 Your Contact\n${flight.dropoffSevakPhone}\n\n`;
        }
        
        // Notes
        if (flight.notes && flight.notes.trim()) {
          flightList += `📝 Special Notes\n${flight.notes}\n\n`;
        }
        
        // Add separator between flights
        if (i < userFlights.length - 1) {
          flightList += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
        }
      }
      
      flightList += `\n💡 Need help? Contact your transportation coordinator for assistance.`;

      await this.bot.sendMessage(chatId, flightList);
    } catch (error) {
      console.error('Flights command error:', error);
      await this.bot.sendMessage(chatId, 
        `❌ Error retrieving your flight assignments. Please try again or contact support if the issue persists.`
      );
    }
  }

  async handleMyFlightsCommand(chatId) {
    try {
      const passengers = await readPassengers();
      const passenger = passengers.find(p => p.telegramChatId === chatId);

      if (!passenger) {
        await this.bot.sendMessage(chatId, 
          `Jai Swaminarayan 🙏\n\n` +
          `❌ You're not registered as a passenger. Please send /start to register first.`
        );
        return;
      }

      const flights = await readFlights();
      const now = new Date();
      const passengerFlights = flights.filter(flight => {
        const departureTime = new Date(flight.departureDateTime);
        return departureTime > now &&
               flight.passengers?.some(p => {
                 // Handle new passengerId format
                 if (p.passengerId === passenger.id) {
                   return true;
                 }
                 // Handle old name format for backward compatibility
                 if (p.name?.toLowerCase().includes(passenger.name.toLowerCase())) {
                   return true;
                 }
                 return false;
               });
      });

      if (passengerFlights.length === 0) {
        await this.bot.sendMessage(chatId, 
          `Jai Swaminarayan 🙏\n\n` +
          `✈️ Your Upcoming Flights\n\n` +
          `No upcoming flights scheduled.\n\n` +
          `Your flight details will appear here once added to the system by your coordinator.`,
        );
        return;
      }

      // Sort flights by departure time
      passengerFlights.sort((a, b) => new Date(a.departureDateTime) - new Date(b.departureDateTime));

      // Show first flight with navigation buttons
      await this.showFlightWithNavigation(chatId, passengerFlights, 0, passenger.name, passengers);
    } catch (error) {
      console.error('MyFlights command error:', error);
      await this.bot.sendMessage(chatId, 
        `❌ Error retrieving your flight information. Please try again or contact support if the issue persists.`
      );
    }
  }

  async handleFlightInfoCommand(chatId, match) {
    const params = match[1].trim().split(' ');

    if (params.length < 2) {
      await this.bot.sendMessage(chatId, 
        `Jai Swaminarayan 🙏\n\n` +
        `❌ Invalid format. Please use:\n` +
        `/flightinfo FLIGHT_NUMBER DATE\n\n` +
        `Example: /flightinfo UA100 2024-12-01`
      );
      return;
    }

    const flightNumber = params[0].toUpperCase();
    const flightDate = params[1];

    try {
      await this.bot.sendMessage(chatId,
        `🔍 Looking up flight ${flightNumber} for ${flightDate}...\n\n` +
        `Please wait while I fetch the flight information.`
      );

      const flightInfo = await this.flightInfoService.getFlightInfo(flightNumber, flightDate);
      
      if (flightInfo && flightInfo.success) {
        const info = flightInfo.data;
        let message = `✈️ Flight Information\n\n`;
        message += `🛫 ${info.airline} ${info.flightNumber}\n`;
        message += `📍 ${info.departure.airport} (${info.departure.code}) → ${info.arrival.airport} (${info.arrival.code})\n\n`;
        
        message += `🕐 Scheduled Departure:\n`;
        message += `${info.departure.scheduled}\n\n`;
        
        message += `🛬 Scheduled Arrival:\n`;
        message += `${info.arrival.scheduled}\n\n`;
        
        if (info.status) {
          message += `📊 Status: ${info.status}\n\n`;
        }
        
        if (info.departure.actual) {
          message += `✅ Actual Departure:\n${info.departure.actual}\n\n`;
        }
        
        if (info.arrival.actual) {
          message += `✅ Actual Arrival:\n${info.arrival.actual}\n\n`;
        }
        
        if (info.gate) {
          message += `🚪 Gate: ${info.gate}\n`;
        }
        
        if (info.terminal) {
          message += `🏢 Terminal: ${info.terminal}\n`;
        }

        await this.bot.sendMessage(chatId, message);
      } else {
        await this.bot.sendMessage(chatId,
          `❌ Could not find flight information for ${flightNumber} on ${flightDate}.\n\n` +
          `Please check:\n` +
          `• Flight number spelling\n` +
          `• Date format (YYYY-MM-DD)\n` +
          `• Flight operates on this date`
        );
      }
    } catch (error) {
      console.error('FlightInfo command error:', error);
      await this.bot.sendMessage(chatId,
        `❌ Error looking up flight information. Please try again later.`
      );
    }
  }

  async handleRegisterVolunteerCommand(chatId) {
    try {
      // Check if user already has any roles
      const existingRoles = await this.checkExistingRoles(chatId);
      const hasVolunteerRole = existingRoles.find(r => r.type === 'user');
      
      if (hasVolunteerRole) {
        await this.bot.sendMessage(chatId, 
          `Jai Swaminarayan 🙏\n\n` +
          `✅ You're already registered as a volunteer!\n\n` +
          `Use /help to see available commands.`
        );
        return;
      }

      await this.bot.sendMessage(chatId, 
        `Jai Swaminarayan 🙏\n\n` +
        `🚗 Volunteer Registration\n\n` +
        `Please enter your full name as it appears in the system:`,
      );
      
      // Set registration state
      await this.setRegistrationState(chatId, { 
        type: 'volunteer', 
        step: 'waiting_name',
        startedAt: new Date()
      });
    } catch (error) {
      console.error('Register volunteer command error:', error);
      await this.bot.sendMessage(chatId, '❌ Error starting registration. Please try again.');
    }
  }

  async handleRegisterPassengerCommand(chatId) {
    try {
      // Check if user already has any roles
      const existingRoles = await this.checkExistingRoles(chatId);
      const hasPassengerRole = existingRoles.find(r => r.type === 'passenger');
      
      if (hasPassengerRole) {
        await this.bot.sendMessage(chatId, 
          `Jai Swaminarayan 🙏\n\n` +
          `✅ You're already registered as a passenger!\n\n` +
          `Use /help to see available commands.`
        );
        return;
      }

      await this.bot.sendMessage(chatId, 
        `Jai Swaminarayan 🙏\n\n` +
        `✈️ Passenger Registration\n\n` +
        `Please enter your full name as it appears on your travel documents:`,
      );
      
      // Set registration state
      await this.setRegistrationState(chatId, { 
        type: 'passenger', 
        step: 'waiting_name',
        startedAt: new Date()
      });
    } catch (error) {
      console.error('Register passenger command error:', error);
      await this.bot.sendMessage(chatId, '❌ Error starting registration. Please try again.');
    }
  }

  async handleRegisterUserCommand(chatId) {
    try {
      // Check if user already has any roles
      const existingRoles = await this.checkExistingRoles(chatId);
      const hasUserRole = existingRoles.find(r => r.type === 'user');
      
      if (hasUserRole) {
        await this.bot.sendMessage(chatId, 
          `Jai Swaminarayan 🙏\n\n` +
          `✅ You're already registered as a dashboard user!\n\n` +
          `Use /help to see available commands.`
        );
        return;
      }

      await this.bot.sendMessage(chatId, 
        `Jai Swaminarayan 🙏\n\n` +
        `📊 Dashboard User Registration\n\n` +
        `Please enter your full name as it appears in the system:`,
      );
      
      // Set registration state
      await this.setRegistrationState(chatId, { 
        type: 'user', 
        step: 'waiting_name',
        startedAt: new Date()
      });
    } catch (error) {
      console.error('Register user command error:', error);
      await this.bot.sendMessage(chatId, '❌ Error starting registration. Please try again.');
    }
  }

  setupCommands() {
    if (!this.bot) return;

    // Handle /start command for user registration
    this.bot.onText(/\/start/, async (msg) => {
      if (await this.isMessageProcessed(msg)) return;
      
      const chatId = msg.chat.id;
      
      try {
        await this.bot.sendMessage(chatId, 
          `Jai Swaminarayan 🙏\n\n` +
          `👋 Welcome to West Sant Transportation!\n\n` +
          `Choose your registration type:\n\n` +
          `🚗 For Volunteers (Pickup/Dropoff volunteers):\n` +
          `Send: /register_volunteer\n\n` +
          `✈️ For Passengers:\n` +
          `Send: /register_passenger\n\n` +
          `👤 For Dashboard Users (Admin/User access holders):\n` +
          `Send: /register_user\n\n` +
          `Example:\n` +
          `/register_volunteer\n` +
          `/register_passenger\n` +
          `/register_user`, 
        );
      } catch (error) {
        console.error('Error sending start message:', error);
      }
    });

    // Handle volunteer registration - new multi-step flow
    this.bot.onText(/\/register_volunteer$/, async (msg) => {
      if (await this.isMessageProcessed(msg)) return;
      
      const chatId = msg.chat.id;

      try {
        // Start registration flow
        await this.setRegistrationState(chatId, {
          type: 'volunteer_new',
          step: 'full_name',
          data: {}
        });
        
        await this.bot.sendMessage(chatId, 
          `Jai Swaminarayan 🙏\n\n` +
          `✅ Welcome to West Sant Transportation volunteer registration!\n\n` +
          `📝 Please enter your Full Name in First Name & Last Name format.\n\n` +
          `Example: John Smith\n\n` +
          `Enter your full name:`,
        );

      } catch (error) {
        console.error('Error starting volunteer registration:', error);
        await this.bot.sendMessage(chatId, 
          `Jai Swaminarayan 🙏\n\n` +
          `❌ Registration failed. Please try again later.`
        );
      }
    });

    // Handle legacy sevak registration for backward compatibility
    this.bot.onText(/\/register_sevak (.+)/, async (msg, match) => {
      if (await this.isMessageProcessed(msg)) return;
      
      const chatId = msg.chat.id;
      await this.bot.sendMessage(chatId, 
        `Jai Swaminarayan 🙏\n\n` +
        `ℹ️ The \`/register_sevak\` command has been renamed to \`/register_volunteer\`.\n\n` +
        `Please use: \`/register_volunteer ${match[1].trim()}\``, 
      );
    });

    // Handle passenger registration with arguments (guide to proper usage)
    this.bot.onText(/\/register_passenger (.+)/, async (msg, match) => {
      if (await this.isMessageProcessed(msg)) return;
      
      const chatId = msg.chat.id;
      const providedName = match[1].trim();
      
      await this.bot.sendMessage(chatId, 
        `Jai Swaminarayan 🙏\n\n` +
        `ℹ️ I see you're trying to register with the name "${providedName}".\n\n` +
        `Please use the interactive registration flow instead:\n\n` +
        `1. Send: /register_passenger\n` +
        `2. Follow the step-by-step prompts\n\n` +
        `This ensures your registration is completed properly.`, 
      );
    });

    // Handle passenger registration - new multi-step flow
    this.bot.onText(/\/register_passenger$/, async (msg) => {
      if (await this.isMessageProcessed(msg)) return;
      
      const chatId = msg.chat.id;

      try {
        // Check if user already has any roles
        const existingRoles = await this.checkExistingRoles(chatId);
        const hasPassengerRole = existingRoles.find(r => r.type === 'passenger');
        
        if (hasPassengerRole) {
          await this.bot.sendMessage(chatId, 
            `Jai Swaminarayan 🙏\n\n` +
            `✅ You're already registered as a passenger!\n\n` +
            `👤 Name: ${hasPassengerRole.data.name}\n\n` +
            `You'll receive notifications for:\n` +
            `🔔 Flight updates\n` +
            `🔔 Pickup/dropoff information\n` +
            `🔔 Important announcements\n\n` +
            `Use /status to see all your roles.`,
          );
          return;
        }
        
        // Show existing roles if any
        if (existingRoles.length > 0) {
          const rolesList = existingRoles.map(r => {
            if (r.type === 'user') return `👥 Dashboard User (${r.data.role})`;
            if (r.type === 'volunteer') return `🤝 Volunteer`;
            return `👤 ${r.type}`;
          }).join('\n');
          
          await this.bot.sendMessage(chatId, 
            `Jai Swaminarayan 🙏\n\n` +
            `ℹ️ You currently have these roles:\n${rolesList}\n\n` +
            `Adding passenger role as well...`
          );
        }

        // Start registration flow
        console.log(`Starting passenger registration for chatId ${chatId}`);
        await this.setRegistrationState(chatId, {
          type: 'passenger_new',
          step: 'full_name',
          data: { existingRoles }
        });
        
        await this.bot.sendMessage(chatId, 
          `Jai Swaminarayan 🙏\n\n` +
          `✅ Welcome to West Sant Transportation passenger registration!\n\n` +
          `📝 Please enter your Full Name exactly as it appears in the system.\n\n` +
          `Format: First Name Last Name\n` +
          `Example: Sadhu Keshavjivandas\n\n` +
          `💡 Instructions:\n` +
          `1. Send: /register_passenger\n` +
          `2. Enter your full name when prompted\n\n` +
          `Enter your full name now:`,
        );

      } catch (error) {
        console.error('Error starting passenger registration:', error);
        await this.bot.sendMessage(chatId, 
          `Jai Swaminarayan 🙏\n\n` +
          `❌ Registration failed. Please try again later.`
        );
      }
    });

    // Handle dashboard user registration - new multi-step flow
    this.bot.onText(/\/register_user$/, async (msg) => {
      if (await this.isMessageProcessed(msg)) return;
      
      const chatId = msg.chat.id;

      try {
        // Start registration flow
        await this.setRegistrationState(chatId, {
          type: 'user_new',
          step: 'username',
          data: {}
        });
        
        await this.bot.sendMessage(chatId, 
          `Jai Swaminarayan 🙏\n\n` +
          `✅ Welcome to West Sant Transportation dashboard user registration!\n\n` +
          `📝 Please enter your dashboard username.\n\n` +
          `This should be the username you use to login to the dashboard.\n\n` +
          `Enter your username:`,
        );

      } catch (error) {
        console.error('Error starting user registration:', error);
        await this.bot.sendMessage(chatId, 
          `Jai Swaminarayan 🙏\n\n` +
          `❌ Registration failed. Please try again later.`
        );
      }
    });

    // Handle /flights command
    this.bot.onText(/\/flights/, async (msg) => {
      if (await this.isMessageProcessed(msg)) return;
      
      const chatId = msg.chat.id;

      try {
        const users = await readUsers();
        const user = users.find(u => u.telegramChatId === chatId);

        if (!user) {
          // Check if they're registered as a passenger instead
          const passengers = await readPassengers();
          const passenger = passengers.find(p => p.telegramChatId === chatId);
          
          if (passenger) {
            await this.bot.sendMessage(chatId, 
              `Jai Swaminarayan 🙏\n\n` +
              `ℹ️ You're registered as a passenger. For your flights, please use:\n\n` +
              `/myflights - View your passenger flights\n\n` +
              `The /flights command is for volunteers only.`
            );
            return;
          }
          
          await this.bot.sendMessage(chatId, 
            `Jai Swaminarayan 🙏\n\n` +
            `❌ You're not registered. Send /start to register first.`
          );
          return;
        }

        const flights = await readFlights();
        const now = new Date();
        const userFlights = flights.filter(flight => {
          const departureTime = new Date(flight.departureDateTime);
          const hasAccess = user.role === 'superadmin' || user.role === 'admin' || 
                           user.allowedAirports.length === 0 ||
                           user.allowedAirports.includes(flight.from) || 
                           user.allowedAirports.includes(flight.to);
          
          return departureTime >= now && hasAccess;
        }).sort((a, b) => new Date(a.departureDateTime) - new Date(b.departureDateTime));

        if (userFlights.length === 0) {
          await this.bot.sendMessage(chatId, 
            `Jai Swaminarayan 🙏\n\n` +
            `📅 No upcoming flights found.`
          );
          return;
        }

        let message = `Jai Swaminarayan 🙏\n\n` +
                     `✈️ Your Upcoming Flights\n\n`;
        userFlights.slice(0, 5).forEach((flight, index) => {
          message += `${index + 1}. ${flight.airline} ${flight.flightNumber}\n`;
          message += `   ${this.formatAirportDisplay(flight.from)} → ${this.formatAirportDisplay(flight.to)}\n`;
          message += `   🕐 Departure: ${this.formatDateTimeWithTimezone(flight.departureDateTime, flight.from)}\n\n`;
        });

        await this.bot.sendMessage(chatId, message);

      } catch (error) {
        console.error('Error fetching flights:', error);
        await this.bot.sendMessage(chatId, 
          `Jai Swaminarayan 🙏\n\n` +
          `❌ Failed to fetch flights. Please try again later.`
        );
      }
    });

    // Handle /myflights command for passengers
    this.bot.onText(/\/myflights/, async (msg) => {
      if (await this.isMessageProcessed(msg)) return;
      
      const chatId = msg.chat.id;

      try {
        const passengers = await readPassengers();
        const passenger = passengers.find(p => p.telegramChatId === chatId);

        if (!passenger) {
          await this.bot.sendMessage(chatId, 
            `Jai Swaminarayan 🙏\n\n` +
            `❌ You're not registered as a passenger. Send /start to register first.`
          );
          return;
        }

        const flights = await readFlights();
        const now = new Date();
        const passengerFlights = flights.filter(flight => {
          const departureTime = new Date(flight.departureDateTime);
          const isPassenger = flight.passengers && flight.passengers.some(p => 
            p.name.toLowerCase() === passenger.name.toLowerCase()
          );
          return departureTime >= now && isPassenger;
        }).sort((a, b) => new Date(a.departureDateTime) - new Date(b.departureDateTime));

        if (passengerFlights.length === 0) {
          await this.bot.sendMessage(chatId, 
            `Jai Swaminarayan 🙏\n\n` +
            `📅 No upcoming flights found for ${passenger.name}.`
          );
          return;
        }

        let message = `Jai Swaminarayan 🙏\n\n` +
                     `✈️ Your Upcoming Flights\n\n`;
        passengerFlights.slice(0, 5).forEach((flight, index) => {
          message += `${index + 1}. ${flight.airline} ${flight.flightNumber}\n`;
          message += `   ${this.formatAirportDisplay(flight.from)} → ${this.formatAirportDisplay(flight.to)}\n`;
          message += `   🕐 Departure: ${this.formatDateTimeWithTimezone(flight.departureDateTime, flight.from)}\n`;
          if (flight.pickupSevakName) {
            message += `   🚗 Pickup: ${flight.pickupSevakName}\n`;
          }
          message += `\n`;
        });

        await this.bot.sendMessage(chatId, message);

      } catch (error) {
        console.error('Error fetching passenger flights:', error);
        await this.bot.sendMessage(chatId, 
          `Jai Swaminarayan 🙏\n\n` +
          `❌ Failed to fetch flights. Please try again later.`
        );
      }
    });

    // Handle /upcomingflights command for dashboard users
    this.bot.onText(/\/upcomingflights/, async (msg) => {
      if (await this.isMessageProcessed(msg)) return;
      
      const chatId = msg.chat.id;
      
      try {
        await this.handleUpcomingFlightsCommand(chatId);
      } catch (error) {
        console.error('UpcomingFlights onText error:', error);
        await this.bot.sendMessage(chatId, 
          `❌ Error retrieving upcoming flights. Please try again or contact support if the issue persists.`
        );
      }
    });

    // Handle /flightinfo command - get flight details from stored data
    this.bot.onText(/\/flightinfo (.+)/, async (msg, match) => {
      if (await this.isMessageProcessed(msg)) return;
      
      const chatId = msg.chat.id;
      const params = match[1].trim().split(' ');

      if (params.length < 2) {
        await this.bot.sendMessage(chatId, 
          `Jai Swaminarayan 🙏\n\n` +
          `❌ Invalid format. Please use:\n` +
          `/flightinfo FLIGHT_NUMBER DATE\n\n` +
          `Example: /flightinfo UA100 2024-12-01`
        );
        return;
      }

      const flightNumber = params[0].toUpperCase();
      const flightDate = params[1];

      try {
        await this.bot.sendMessage(chatId, 
          `🔍 Looking up ${flightNumber} on ${flightDate}...`
        );

        // Get flight from stored data instead of AeroAPI
        const flights = await readFlights();
        const targetDate = new Date(flightDate);
        
        const flight = flights.find(f => {
          const flightDateObj = new Date(f.departureDateTime);
          return f.flightNumber.toLowerCase() === flightNumber.toLowerCase() && 
                 flightDateObj.toDateString() === targetDate.toDateString();
        });
        
        if (!flight) {
          await this.bot.sendMessage(chatId, 
            `Jai Swaminarayan 🙏\n\n` +
            `❌ Flight ${flightNumber} not found for ${flightDate} in our system.\n\n` +
            `Only flights in our system can be looked up.`
          );
          return;
        }

        let message = `Jai Swaminarayan 🙏\n\n` +
                     `✈️ Flight Information\n\n` +
                     `Flight: ${flight.flightNumber}\n` +
                     `Airline: ${flight.airline}\n\n` +
                     `🛫 Departure\n` +
                     `Airport: ${this.formatAirportDisplay(flight.from)}\n` +
                     `Time: ${this.formatDateTimeWithTimezone(flight.departureDateTime, flight.from)}\n\n` +
                     `🛬 Arrival\n` +
                     `Airport: ${this.formatAirportDisplay(flight.to)}\n` +
                     `Time: ${this.formatDateTimeWithTimezone(flight.arrivalDateTime, flight.to)}\n\n`;

        // Add passenger information if available
        if (flight.passengers && flight.passengers.length > 0) {
          message += `👥 Passengers\n`;
          flight.passengers.forEach(passenger => {
            message += `• ${passenger.name}\n`;
          });
          message += `\n`;
        }

        // Add volunteer information if available
        if (flight.pickupVolunteerName || flight.dropoffVolunteerName) {
          message += `🚐 Volunteers\n`;
          if (flight.pickupVolunteerName) {
            message += `Pickup: ${flight.pickupVolunteerName}\n`;
          }
          if (flight.dropoffVolunteerName) {
            message += `Dropoff: ${flight.dropoffVolunteerName}\n`;
          }
          message += `\n`;
        }

        message += `📝 Notes\n${flight.notes || 'No additional notes'}`;

        await this.bot.sendMessage(chatId, message);

      } catch (error) {
        console.error('Error getting flight info:', error);
        await this.bot.sendMessage(chatId, 
          `Jai Swaminarayan 🙏\n\n` +
          `❌ Failed to get flight information. Please try again later.`
        );
      }
    });

    // Handle /help command
    // Clear registration state command (for debugging/recovery)
    this.bot.onText(/\/clear_registration/, async (msg) => {
      if (await this.isMessageProcessed(msg)) return;
      
      const chatId = msg.chat.id;
      
      if (this.registrationStates.has(chatId)) {
        await this.deleteRegistrationState(chatId);
        await this.bot.sendMessage(chatId, 
          `Jai Swaminarayan 🙏\n\n` +
          `✅ Registration state cleared. You can now start fresh with /register_passenger, /register_volunteer, or /register_user.`
        );
      } else {
        await this.bot.sendMessage(chatId, 
          `Jai Swaminarayan 🙏\n\n` +
          `ℹ️ You don't have any active registration state to clear.`
        );
      }
    });

    this.bot.onText(/\/help/, async (msg) => {
      if (await this.isMessageProcessed(msg)) return;
      
      const chatId = msg.chat.id;
      
      const helpMessage = 
        `Jai Swaminarayan 🙏\n\n` +
        `🤖 West Sant Transportation Bot\n\n` +
        `Registration Commands:\n` +
        `• /start - Start registration process\n` +
        `• /register_volunteer - Register as Volunteer\n` +
        `• /register_passenger - Register as Passenger\n` +
        `• /register_user - Register as Dashboard User\n\n` +
        `Flight Commands:\n` +
        `• /flights - View your assigned flights (Volunteers)\n` +
        `• /myflights - View your passenger flights\n` +
        `• /upcomingflights - View upcoming flights at your airports (Dashboard Users)\n` +
        `• /flightinfo FLIGHT_NUMBER DATE - Get flight details from our system\n` +
        `• /help - Show this help menu\n\n` +
        `Features:\n` +
        `✈️ Flight details and passenger information\n` +
        `🚨 Automatic delay alerts (for flights in our system)\n` +
        `🕐 Real-time notifications for changes\n\n` +
        `Notifications:\n` +
        `🔔 Flight confirmations (Passengers)\n` +
        `🔔 24-hour check-in reminders (Passengers)\n` +
        `🔔 Drop-off: 6-hour & 3-hour reminders (Volunteers)\n` +
        `🔔 Flight changes or delays (All)\n` +
        `🔔 Dashboard system notifications (Dashboard Users)\n\n` +
        `Need help? Contact your administrator.`;

      await this.bot.sendMessage(chatId, helpMessage);
    });

    // Handle general messages (for phone number collection and other registration steps)
    this.bot.on('message', async (msg) => {
      if (await this.isMessageProcessed(msg)) return;
      
      const chatId = msg.chat.id;
      const text = msg.text;
      
      // Skip if message is a command (starts with /)
      if (!text || text.startsWith('/')) return;
      
      // Check if user is in a registration state
      const registrationState = this.registrationStates.get(chatId);
      if (!registrationState) return;
      
      console.log(`Processing registration step for chatId ${chatId}: type=${registrationState.type}, step=${registrationState.step}`);
      
      try {
        if (registrationState.step === 'full_name') {
          // Handle full name input for new passenger registration
          const fullName = text.trim();
          
          // Validate name format (First Name & Last Name)
          const nameParts = fullName.split(/\s+/);
          if (nameParts.length < 2 || fullName.length < 3) {
            await this.bot.sendMessage(chatId, 
              `Jai Swaminarayan 🙏\n\n` +
              `❌ Please enter your name in First Name & Last Name format.\n\n` +
              `Examples:\n` +
              `• John Smith\n` +
              `• Mary Johnson\n` +
              `• Harinivas Swami\n\n` +
              `Please try again:`
            );
            return;
          }
          
          // Create new passenger immediately (no legal name step)
          const passengers = await readPassengers();
          const newPassenger = {
            id: require('uuid').v4(),
            name: fullName,
            legalName: fullName, // Use same name for legal name
            telegramChatId: chatId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            flightCount: 0
          };
          
          passengers.push(newPassenger);
          await writePassengers(passengers);
          
          // Send greeting message
          await this.bot.sendMessage(chatId, 
            `Jai Swaminarayan 🙏\n\n` +
            `🎉 Welcome to West Sant Transportation!\n\n` +
            `✅ Successfully registered as passenger:\n` +
            `👤 Name: ${newPassenger.name}\n\n` +
            `You'll receive notifications for:\n` +
            `🔔 Flight confirmations\n` +
            `🔔 Flight updates and changes\n` +
            `🔔 24-hour check-in reminders\n` +
            `🔔 Volunteer contact information\n\n` +
            `Available commands:\n` +
            `/myflights - View your upcoming flights\n` +
            `/help - Show help menu\n\n` +
            `Thank you for registering! 🙏`,
          );
          
          // Clear registration state
          await this.deleteRegistrationState(chatId);
          return;
          
        } else if (registrationState.type === 'passenger' && registrationState.step === 'waiting_name') {
          // Handle name input for passenger registration
          const fullName = text.trim();
          
          // Validate name format (First Name & Last Name)
          const nameParts = fullName.split(/\s+/);
          if (nameParts.length < 2 || fullName.length < 3) {
            await this.bot.sendMessage(chatId, 
              `Jai Swaminarayan 🙏\n\n` +
              `❌ Please enter your name in First Name & Last Name format.\n\n` +
              `Examples:\n` +
              `• John Smith\n` +
              `• Mary Johnson\n` +
              `• Harinivas Swami\n\n` +
              `Please try again:`
            );
            return;
          }
          
          // First, search for existing passenger using fuzzy matching
          console.log(`🔍 Searching for existing passenger: "${fullName}" for chatId ${chatId}`);
          const existingPassenger = await findPassengerByName(fullName);
          
          if (existingPassenger) {
            // Link existing passenger to Telegram chat ID
            console.log(`✅ Found existing passenger: ${existingPassenger.name} (ID: ${existingPassenger.id})`);
            
            // Check if already linked to a different chat ID
            if (existingPassenger.telegramChatId && existingPassenger.telegramChatId !== chatId) {
              await this.bot.sendMessage(chatId, 
                `Jai Swaminarayan 🙏\n\n` +
                `⚠️ This passenger account is already linked to another Telegram account.\n\n` +
                `If this is your account and you need to update the link, please contact your administrator.\n\n` +
                `👤 Found: ${existingPassenger.name}`
              );
              await this.deleteRegistrationState(chatId);
              return;
            }
            
            // Link the existing passenger to this chat ID
            const passengers = await readPassengers();
            const passengerIndex = passengers.findIndex(p => p.id === existingPassenger.id);
            if (passengerIndex !== -1) {
              passengers[passengerIndex].telegramChatId = chatId;
              passengers[passengerIndex].updatedAt = new Date().toISOString();
              await writePassengers(passengers);
              
              await this.bot.sendMessage(chatId, 
                `Jai Swaminarayan 🙏\n\n` +
                `🎉 Welcome back to West Sant Transportation!\n\n` +
                `✅ Successfully linked your Telegram to existing passenger account:\n` +
                `👤 Name: ${existingPassenger.name}\n` +
                `📊 Previous Flights: ${existingPassenger.flightCount || 0}\n\n` +
                `You'll receive notifications for:\n` +
                `🔔 Flight confirmations\n` +
                `🔔 Flight updates and changes\n` +
                `🔔 24-hour check-in reminders\n` +
                `🔔 Volunteer contact information\n\n` +
                `Available commands:\n` +
                `/myflights - View your upcoming flights\n` +
                `/help - Show help menu\n\n` +
                `Welcome back! 🙏`,
              );
            }
          } else {
            // No existing passenger found, create new one
            console.log(`➕ No existing passenger found for "${fullName}", creating new passenger`);
            const passengers = await readPassengers();
            const newPassenger = {
              id: require('uuid').v4(),
              name: fullName,
              legalName: fullName, // Use same name for legal name
              telegramChatId: chatId,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              flightCount: 0
            };
            
            passengers.push(newPassenger);
            await writePassengers(passengers);
            console.log(`✅ Created new passenger: ${newPassenger.name} (ID: ${newPassenger.id})`);
            
            await this.bot.sendMessage(chatId, 
              `Jai Swaminarayan 🙏\n\n` +
              `🎉 Welcome to West Sant Transportation!\n\n` +
              `✅ Successfully registered as new passenger:\n` +
              `👤 Name: ${newPassenger.name}\n\n` +
              `You'll receive notifications for:\n` +
              `🔔 Flight confirmations\n` +
              `🔔 Flight updates and changes\n` +
              `🔔 24-hour check-in reminders\n` +
              `🔔 Volunteer contact information\n\n` +
              `Available commands:\n` +
              `/myflights - View your upcoming flights\n` +
              `/help - Show help menu\n\n` +
              `Thank you for registering! 🙏`,
            );
          }
          
          // Clear registration state
          await this.deleteRegistrationState(chatId);
          return;
          
        } else if (registrationState.type === 'passenger_new') {
          if (registrationState.step === 'full_name') {
            // Handle full name input for passenger registration
            const fullName = text.trim();
            
            // Validate name format
            const nameParts = fullName.split(/\s+/);
            if (nameParts.length < 2 || fullName.length < 3) {
              await this.bot.sendMessage(chatId, 
                `Jai Swaminarayan 🙏\n\n` +
                `❌ Please enter your name in First Name & Last Name format.\n\n` +
                `Examples:\n` +
                `• John Smith\n` +
                `• Mary Johnson\n\n` +
                `Please try again:`
              );
              return;
            }
            
            // Create new passenger immediately (no legal name step)
            try {
              console.log(`Creating passenger for chatId ${chatId}: fullName=${fullName}`);
              const passengers = await readPassengers();
              const passenger = {
                id: require('uuid').v4(),
                name: fullName,
                legalName: fullName, // Use same name for legal name
                phone: null,
                telegramChatId: chatId,
                flightCount: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };
              passengers.push(passenger);
              await writePassengers(passengers);
              console.log(`Successfully created passenger with ID: ${passenger.id}`);
              
              await this.bot.sendMessage(chatId, 
                `Jai Swaminarayan 🙏\n\n` +
                `🎉 Welcome to West Sant Transportation!\n\n` +
                `✅ Successfully registered as passenger:\n` +
                `👤 Name: ${passenger.name}\n\n` +
                `You'll receive notifications for:\n` +
                `🔔 Flight updates\n` +
                `🔔 Pickup/dropoff information\n` +
                `🔔 Important announcements\n\n` +
                `Available commands:\n` +
                `/myflights - View your upcoming flights\n` +
                `/help - Show help menu\n\n` +
                `Welcome to the system! 🙏`,
              );
              
              // Clear registration state
              await this.deleteRegistrationState(chatId);
              return;
              
            } catch (error) {
              console.error('Error processing passenger registration:', error);
              await this.bot.sendMessage(chatId, 
                `Jai Swaminarayan 🙏\n\n` +
                `❌ Registration failed. Please try again later.`
              );
              await this.deleteRegistrationState(chatId);
              return;
            }
          }
          
        } else if (registrationState.type === 'volunteer_new') {
          if (registrationState.step === 'full_name') {
            // Handle full name input for volunteer registration
            const fullName = text.trim();
            
            // Validate name format
            const nameParts = fullName.split(/\s+/);
            if (nameParts.length < 2 || fullName.length < 3) {
              await this.bot.sendMessage(chatId, 
                `Jai Swaminarayan 🙏\n\n` +
                `❌ Please enter your name in First Name & Last Name format.\n\n` +
                `Examples:\n` +
                `• John Smith\n` +
                `• Mary Johnson\n\n` +
                `Please try again:`
              );
              return;
            }
            
            // Store full name and move to city step
            registrationState.data.fullName = fullName;
            registrationState.step = 'city';
            
            await this.bot.sendMessage(chatId, 
              `Jai Swaminarayan 🙏\n\n` +
              `✅ Full Name: ${fullName}\n\n` +
              `🏙️ Please enter your City where you live.\n\n` +
              `This helps us assign you to nearby airport pickups/dropoffs.\n\n` +
              `Enter your city:`,
            );
            
          } else if (registrationState.step === 'city') {
            // Handle city input
            const city = text.trim();
            
            // Validate city
            if (city.length < 2) {
              await this.bot.sendMessage(chatId, 
                `Jai Swaminarayan 🙏\n\n` +
                `❌ Please enter a valid city name.\n\n` +
                `Enter your city:`
              );
              return;
            }
            
            // Store city and move to phone step
            registrationState.data.city = city;
            registrationState.step = 'phone';
            
            await this.bot.sendMessage(chatId, 
              `Jai Swaminarayan 🙏\n\n` +
              `✅ City: ${city}\n\n` +
              `📱 Please share your phone number so passengers can contact you when needed.\n\n` +
              `Send your phone number (e.g., +1-555-123-4567 or 555-123-4567):`
            );
            
          } else if (registrationState.step === 'phone') {
            // Handle phone for volunteer - will be processed below in phone section
          }
          
        } else if (registrationState.type === 'user_new') {
          if (registrationState.step === 'username') {
            // Handle username input for user registration
            const username = text.trim();
            
            // Validate username
            if (username.length < 3) {
              await this.bot.sendMessage(chatId, 
                `Jai Swaminarayan 🙏\n\n` +
                `❌ Please enter a valid username (at least 3 characters).\n\n` +
                `Enter your dashboard username:`
              );
              return;
            }
            
            // Check if user exists in system
            try {
              const users = await readUsers();
              const user = users.find(u => u.username === username);

              if (!user) {
                await this.bot.sendMessage(chatId, 
                  `Jai Swaminarayan 🙏\n\n` +
                  `❌ Username "${username}" not found in the dashboard system.\n\n` +
                  `Please ensure:\n` +
                  `• You have a dashboard account\n` +
                  `• You're using your exact dashboard username\n` +
                  `• Your account is active\n\n` +
                  `Contact your administrator if you need help.`
                );
                await this.deleteRegistrationState(chatId);
                return;
              }

              // Check if user is a volunteer
              if (user.role === 'volunteer') {
                await this.bot.sendMessage(chatId, 
                  `Jai Swaminarayan 🙏\n\n` +
                  `❌ Volunteers cannot register as dashboard users.\n\n` +
                  `Please use: \`/register_volunteer\`\n\n` +
                  `If you need dashboard access, contact your administrator.`, 
                );
                await this.deleteRegistrationState(chatId);
                return;
              }

              // Check if user already has Telegram linked
              if (user.telegramChatId) {
                await this.bot.sendMessage(chatId, 
                  `Jai Swaminarayan 🙏\n\n` +
                  `✅ You're already registered as dashboard user "${user.name || user.username}"!\n\n` +
                  `Role: ${user.role.charAt(0).toUpperCase() + user.role.slice(1)}\n` +
                  `Access Level: ${user.role === 'superadmin' ? 'Full System Access' : user.role === 'admin' ? 'Administrative Access' : 'Standard User Access'}\n\n` +
                  `You'll receive notifications for:\n` +
                  `🔔 Flight additions and changes\n` +
                  `🔔 Flight delays and updates\n` +
                  `🔔 System notifications\n\n` +
                  `Available commands:\n` +
                  `/help - Show help menu`
                );
                await this.deleteRegistrationState(chatId);
                return;
              }

              // Link Telegram to dashboard user
              user.telegramChatId = chatId;
              user.updatedAt = new Date().toISOString();
              
              const userIndex = users.findIndex(u => u.username === username);
              users[userIndex] = user;
              await writeUsers(users);

              await this.bot.sendMessage(chatId, 
                `Jai Swaminarayan 🙏\n\n` +
                `🎉 Successfully linked to dashboard account!\n\n` +
                `✅ Dashboard User: ${user.name || user.username}\n` +
                `👤 Username: ${user.username}\n` +
                `🔑 Role: ${user.role.charAt(0).toUpperCase() + user.role.slice(1)}\n` +
                `📊 Access Level: ${user.role === 'superadmin' ? 'Full System Access' : user.role === 'admin' ? 'Administrative Access' : 'Standard User Access'}\n\n` +
                `You'll now receive notifications for:\n` +
                `🔔 Flight additions and changes\n` +
                `🔔 Flight delays and updates\n` +
                `🔔 System notifications\n` +
                `🔔 Administrative alerts (if applicable)\n\n` +
                `Available commands:\n` +
                `/status - Check your registration status\n` +
                `/help - Show help menu\n\n` +
                `Welcome to the system! 🙏`,
              );
              
              // Clear registration state
              await this.deleteRegistrationState(chatId);
              return;
              
            } catch (error) {
              console.error('Error processing user registration:', error);
              await this.bot.sendMessage(chatId, 
                `Jai Swaminarayan 🙏\n\n` +
                `❌ Registration failed. Please try again later.`
              );
              await this.deleteRegistrationState(chatId);
              return;
            }
          }
          
        } else if (registrationState.step === 'phone') {
          // Validate phone number format (basic validation)
          const phoneRegex = /^[\+]?[1-9][\d\-\(\)\s]{7,15}$/;
          if (!phoneRegex.test(text.replace(/\s+/g, ''))) {
            await this.bot.sendMessage(chatId, 
              `Jai Swaminarayan 🙏\n\n` +
              `❌ Please enter a valid phone number.\n\n` +
              `Examples:\n` +
              `• +1-555-123-4567\n` +
              `• 555-123-4567\n` +
              `• (555) 123-4567`
            );
            return;
          }
          
          const formattedPhone = text.trim();
          
          if (registrationState.type === 'volunteer_new') {
            // Create new volunteer with full name and city
            const users = await readUsers();
            const user = {
              id: require('uuid').v4(),
              username: registrationState.data.fullName.replace(/\s+/g, '_').toLowerCase(), // Generate username from name
              name: registrationState.data.fullName,
              role: 'volunteer',
              phone: formattedPhone,
              city: registrationState.data.city,
              telegramChatId: chatId,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              allowedAirports: []
            };
            users.push(user);
            await writeUsers(users);
            
            await this.bot.sendMessage(chatId, 
              `Jai Swaminarayan 🙏\n\n` +
              `🎉 Welcome to West Sant Transportation!\n\n` +
              `✅ Successfully registered as volunteer:\n` +
              `👤 Name: ${user.name}\n` +
              `🏙️ City: ${registrationState.data.city}\n` +
              `📱 Phone: ${formattedPhone}\n` +
              `🆔 Username: ${user.username}\n\n` +
              `📝 Note: Your administrator can assign you to specific airports for pickups/dropoffs.\n\n` +
              `You'll receive notifications for:\n` +
              `🔔 Flight assignments\n` +
              `🔔 Passenger contact information\n` +
              `🔔 Schedule updates\n\n` +
              `Available commands:\n` +
              `/flights - View your assigned flights\n` +
              `/help - Show help menu\n\n` +
              `Thank you for volunteering! 🙏`,
            );
            
          } else if (registrationState.type === 'volunteer') {
            // Create new volunteer
            const users = await readUsers();
            const user = {
              id: require('uuid').v4(),
              username: registrationState.data.username,
              name: registrationState.data.username,
              role: 'volunteer',
              phone: formattedPhone,
              telegramChatId: chatId,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              allowedAirports: []
            };
            users.push(user);
            await writeUsers(users);
            
            await this.bot.sendMessage(chatId, 
              `Jai Swaminarayan 🙏\n\n` +
              `✅ Successfully registered as Volunteer "${user.username}" with phone ${formattedPhone}!\n\n` +
              `📝 Note: Your administrator can assign you to specific airports.\n\n` +
              `Available commands:\n` +
              `/flights - View your upcoming flights\n` +
              `/help - Show help menu`
            );
            
          } else if (registrationState.type === 'volunteer_existing') {
            // Update existing volunteer
            const users = await readUsers();
            const user = registrationState.data.user;
            user.phone = formattedPhone;
            user.telegramChatId = chatId;
            user.updatedAt = new Date().toISOString();
            
            const userIndex = users.findIndex(u => u.username === user.username);
            users[userIndex] = user;
            await writeUsers(users);
            
            await this.bot.sendMessage(chatId, 
              `Jai Swaminarayan 🙏\n\n` +
              `✅ Successfully registered as Volunteer with phone ${formattedPhone}!\n\n` +
              `Available commands:\n` +
              `/flights - View your upcoming flights\n` +
              `/help - Show help menu`
            );
            
          } else if (registrationState.type === 'passenger') {
            // Create new passenger
            const passengers = await readPassengers();
            const passenger = {
              id: require('uuid').v4(),
              name: registrationState.data.name,
              phone: formattedPhone,
              telegramChatId: chatId,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              flightCount: 0
            };
            passengers.push(passenger);
            await writePassengers(passengers);
            
            await this.bot.sendMessage(chatId, 
              `Jai Swaminarayan 🙏\n\n` +
              `✅ Successfully registered as passenger "${passenger.name}" with phone ${formattedPhone}!\n\n` +
              `You'll receive notifications for:\n` +
              `🔔 Flight confirmations\n` +
              `🔔 Flight updates and changes\n` +
              `🔔 24-hour check-in reminders\n` +
              `🔔 Volunteer contact information\n\n` +
              `Available commands:\n` +
              `/myflights - View your upcoming flights\n` +
              `/help - Show help menu`
            );
            
          } else if (registrationState.type === 'passenger_existing') {
            // Update existing passenger
            const passengers = await readPassengers();
            const passenger = registrationState.data.passenger;
            passenger.phone = formattedPhone;
            passenger.telegramChatId = chatId;
            passenger.updatedAt = new Date().toISOString();
            
            const passengerIndex = passengers.findIndex(p => p.name.toLowerCase() === passenger.name.toLowerCase());
            passengers[passengerIndex] = passenger;
            await writePassengers(passengers);
            
            await this.bot.sendMessage(chatId, 
              `Jai Swaminarayan 🙏\n\n` +
              `✅ Successfully registered as passenger "${passenger.name}" with phone ${formattedPhone}!\n\n` +
              `You'll receive notifications for:\n` +
              `🔔 Flight confirmations\n` +
              `🔔 Flight updates and changes\n` +
              `🔔 24-hour check-in reminders\n` +
              `🔔 Volunteer contact information\n\n` +
              `Available commands:\n` +
              `/myflights - View your upcoming flights\n` +
              `/help - Show help menu`
            );
          }
          
          // Clear registration state
          await this.deleteRegistrationState(chatId);
        }
        
      } catch (error) {
        console.error('Error processing registration step:', error);
        await this.bot.sendMessage(chatId, 
          `Jai Swaminarayan 🙏\n\n` +
          `❌ Registration failed. Please try again later.`
        );
        // Clear registration state on error
        await this.deleteRegistrationState(chatId);
      }
    });

    // Handle incoming photos for flight ticket processing
    this.bot.on('photo', async (msg) => {
      console.log('🎫 PHOTO_HANDLER: Photo event received, checking if processed...');
      
      if (await this.isPhotoMessageProcessed(msg)) {
        console.log('⚠️ PHOTO_HANDLER: Message already processed, skipping');
        return;
      }
      
      console.log('✅ PHOTO_HANDLER: New photo message, starting processing...');

      const chatId = msg.chat.id;
      let processingMessage;

      try {
        console.log('🎫 PHOTO_HANDLER: Starting enhanced photo processing...');
        
        // Send initial processing message
        processingMessage = await this.bot.sendMessage(chatId, 
          '🔍 Ticket Processing Started\n\n' +
          '• Analyzing image...\n' +
          '• Extracting text with Google Vision API...\n' +
          '• Identifying airline patterns...\n' +
          '• Matching passenger names...\n\n' +
          '_This may take a few seconds..._',
        );

        // Get highest resolution photo
        const photo = msg.photo[msg.photo.length - 1];
        console.log(`🖼️  PHOTO_HANDLER: Processing photo - File ID: ${photo.file_id}`);
        console.log(`   Resolution: ${photo.width}x${photo.height}`);
        
        // Get file info first, then construct download URL manually
        console.log('🔍 PHOTO_HANDLER: Getting file info from Telegram API...');
        const fileInfo = await this.bot.getFile(photo.file_id);
        console.log(`📸 PHOTO_HANDLER: File info received:`, JSON.stringify(fileInfo, null, 2));
        
        // Construct the full download URL manually
        const fileLink = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileInfo.file_path}`;
        console.log(`🔗 PHOTO_HANDLER: Constructed download URL: ${fileLink}`);

        // Process with enhanced system
        const processingResult = await processFlightTicket(fileLink);
        console.log(`✅ PHOTO_HANDLER: Processing completed - Success: ${processingResult.success}`);

        if (processingResult.success) {
          const flight = processingResult.flight;
          const extractedData = processingResult.extractedData;
          const passengerMatch = processingResult.passengerMatch;

          // Build detailed result message
          let resultMessage = `✅ Ticket Processing Successful!\n\n`;
          
          // Flight information
          resultMessage += `🛩️ Flight Details:\n`;
          resultMessage += `• Flight: ${flight.flightNumber}\n`;
          if (flight.airline) {
            resultMessage += `• Airline: ${flight.airline}\n`;
          }
          if (flight.from && flight.to) {
            resultMessage += `• Route: ${flight.from} → ${flight.to}\n`;
          }
          resultMessage += `• Confidence: ${Math.round((extractedData?.confidence?.overall || 0) * 100)}%\n`;
          
          // Passenger information
          resultMessage += `\n👤 Passenger Information:\n`;
          if (passengerMatch && passengerMatch.passenger) {
            resultMessage += `• Matched: ${passengerMatch.passenger.name}\n`;
            resultMessage += `• Extracted Name: ${passengerMatch.extractedName}\n`;
            resultMessage += `• Match Type: ${passengerMatch.matchType.replace('_', ' ')}\n`;
            resultMessage += `• Match Confidence: ${Math.round(passengerMatch.confidence * 100)}%\n`;
          } else {
            resultMessage += `• ⚠️ No passenger match found\n`;
            resultMessage += `• Extracted Name: ${extractedData?.passengerName || 'Unknown'}\n`;
            resultMessage += `• Requires manual passenger assignment\n`;
          }

          // What was extracted
          resultMessage += `\n📋 Extracted Information:\n`;
          const extractedFields = [];
          if (extractedData?.confirmationCode) extractedFields.push(`Confirmation: ${extractedData.confirmationCode}`);
          if (extractedData?.date) extractedFields.push(`Date: ${extractedData.date}`);
          if (extractedData?.departureTime) extractedFields.push(`Departure: ${extractedData.departureTime}`);
          if (extractedData?.seat) extractedFields.push(`Seat: ${extractedData.seat}`);
          
          if (extractedFields.length > 0) {
            resultMessage += extractedFields.map(field => `• ${field}`).join('\n');
          } else {
            resultMessage += '• Basic flight and passenger info only';
          }

          // Next steps
          resultMessage += `\n\n📝 Next Steps:\n`;
          resultMessage += `• Complete departure/arrival times in dashboard\n`;
          if (!flight.from || !flight.to) {
            resultMessage += `• Add airport information manually\n`;
          }
          if (!passengerMatch.passenger) {
            resultMessage += `• Assign correct passenger in dashboard\n`;
          }
          if (flight.processingStatus === 'partial') {
            resultMessage += `• Review and complete flight details\n`;
          }

          // Add notes if available
          if (flight.notes) {
            resultMessage += `\n📝 Flight Notes:\n${flight.notes}\n`;
          }

          resultMessage += `\n🆔 Flight ID: ${flight.id}`;

          // Update the processing message with results
          await this.bot.editMessageText(resultMessage, {
            chat_id: chatId,
            message_id: processingMessage.message_id,
          });

          // Send additional technical details for debugging (if issues exist)
          if (processingResult.issues.length > 0) {
            const debugMessage = `🔧 Processing Issues:\n` +
              processingResult.issues.map(issue => `• ${issue}`).join('\n') + 
              `\n\n📊 Technical Details:\n` +
              `• Parse Strategy: ${extractedData?.parseStrategy || 'Unknown'}\n` +
              `• OCR Processing: ${processingResult.metadata?.ocrResult?.processingTimeMs || 'N/A'}ms\n` +
              `• Text Blocks Found: ${processingResult.metadata?.ocrResult?.detectionCount || 'N/A'}`;
            
            await this.bot.sendMessage(chatId, debugMessage);
          }

        } else {
          // Processing failed
          let errorMessage = `❌ Ticket Processing Failed\n\n`;
          errorMessage += `Error: ${processingResult.error}\n\n`;
          
          if (processingResult.issues.length > 0) {
            errorMessage += `Issues encountered:\n`;
            errorMessage += processingResult.issues.map(issue => `• ${issue}`).join('\n') + '\n\n';
          }
          
          errorMessage += `💡 Troubleshooting Tips:\n`;
          errorMessage += `• Ensure image is clear and well-lit\n`;
          errorMessage += `• Make sure ticket text is readable\n`;
          errorMessage += `• Try with a different angle or closer photo\n`;
          errorMessage += `• Verify passenger name exists in the system\n\n`;
          errorMessage += `If problems persist, contact your administrator.`;

          await this.bot.editMessageText(errorMessage, {
            chat_id: chatId,
            message_id: processingMessage.message_id,
          });
        }

      } catch (error) {
        console.error('❌ PHOTO_HANDLER_ERROR: Comprehensive error occurred:', error);
        
        let errorDetails = '';
        if (error.message.includes('credentials')) {
          errorDetails = `\n\n🔐 Credential Issue Detected\n` +
                        `The Google Vision API credentials may be invalid or missing. ` +
                        `Please check the GOOGLE_CREDENTIALS_JSON environment variable.`;
        } else if (error.message.includes('quota') || error.message.includes('billing')) {
          errorDetails = `\n\n💳 API Quota/Billing Issue\n` +
                        `Google Vision API quota may be exceeded or billing not enabled. ` +
                        `Please check your Google Cloud Console.`;
        } else if (error.message.includes('network') || error.message.includes('ENOTFOUND')) {
          errorDetails = `\n\n🌐 Network Issue\n` +
                        `Unable to connect to Google Vision API. Check your internet connection.`;
        }

        const errorMessage = `❌ Ticket Processing Error\n\n` +
                            `${error.message}${errorDetails}\n\n` +
                            `Please try again or contact your administrator if the problem persists.`;

        if (processingMessage) {
          try {
            await this.bot.editMessageText(errorMessage, {
              chat_id: chatId,
              message_id: processingMessage.message_id,
            });
          } catch (editError) {
            // If edit fails, send new message
            await this.bot.sendMessage(chatId, errorMessage);
          }
        } else {
          await this.bot.sendMessage(chatId, errorMessage);
        }
      }
      
      // Mark message as processed (both success and error cases)
      await this.markPhotoMessageAsProcessed(msg);
    });

    // Handle documents (including photos sent as files)
    this.bot.on('document', async (msg) => {
      console.log('📄 DOCUMENT_HANDLER: Document received, checking if it\'s an image...');
      
      if (await this.isPhotoMessageProcessed(msg)) {
        console.log('⚠️ DOCUMENT_HANDLER: Message already processed, skipping');
        return;
      }
      
      const document = msg.document;
      console.log(`📄 DOCUMENT_HANDLER: Document type: ${document.mime_type}, size: ${document.file_size}`);
      
      // Check if document is an image
      if (!document.mime_type || !document.mime_type.startsWith('image/')) {
        console.log('⚠️ DOCUMENT_HANDLER: Document is not an image, skipping');
        return;
      }
      
      console.log('✅ DOCUMENT_HANDLER: Document is an image, processing as ticket...');

      const chatId = msg.chat.id;
      let processingMessage;

      try {
        console.log('📄 DOCUMENT_HANDLER: Starting enhanced document image processing...');
        
        // Send initial processing message
        processingMessage = await this.bot.sendMessage(chatId, 
          '🔍 Ticket Processing Started (Document)\n\n' +
          '• Analyzing document image...\n' +
          '• Extracting text with Google Vision API...\n' +
          '• Identifying airline patterns...\n' +
          '• Matching passenger names...\n\n' +
          '_This may take a few seconds..._',
        );

        // Get document file link
        console.log(`📄 DOCUMENT_HANDLER: Processing document - File ID: ${document.file_id}`);
        console.log(`   File name: ${document.file_name || 'unknown'}`);
        console.log(`   MIME type: ${document.mime_type}`);
        console.log(`   File size: ${document.file_size} bytes`);
        
        // Get file info first, then construct download URL manually
        console.log('🔍 DOCUMENT_HANDLER: Getting file info from Telegram API...');
        const fileInfo = await this.bot.getFile(document.file_id);
        console.log(`📄 DOCUMENT_HANDLER: File info received:`, JSON.stringify(fileInfo, null, 2));
        
        // Construct the full download URL manually
        const fileLink = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileInfo.file_path}`;
        console.log(`🔗 DOCUMENT_HANDLER: Constructed download URL: ${fileLink}`);

        // Process with enhanced system (same as photo processing)
        const processingResult = await processFlightTicket(fileLink);
        console.log(`✅ DOCUMENT_HANDLER: Processing completed - Success: ${processingResult.success}`);

        if (processingResult.success) {
          const flight = processingResult.flight;
          const extractedData = processingResult.extractedData;
          const passengerMatch = processingResult.passengerMatch;

          // Build detailed result message (same as photo handler)
          let resultMessage = `✅ Ticket Processing Successful! (Document)\n\n`;
          
          // Flight information
          resultMessage += `🛩️ Flight Details:\n`;
          resultMessage += `• Flight: ${flight.flightNumber}\n`;
          if (flight.airline) {
            resultMessage += `• Airline: ${flight.airline}\n`;
          }
          if (flight.from && flight.to) {
            resultMessage += `• Route: ${flight.from} → ${flight.to}\n`;
          }
          resultMessage += `• Confidence: ${Math.round((extractedData?.confidence?.overall || 0) * 100)}%\n`;
          
          // Passenger information
          resultMessage += `\n👤 Passenger Information:\n`;
          if (passengerMatch && passengerMatch.passenger) {
            resultMessage += `• Matched: ${passengerMatch.passenger.name}\n`;
            resultMessage += `• Extracted Name: ${passengerMatch.extractedName}\n`;
            resultMessage += `• Match Type: ${passengerMatch.matchType.replace('_', ' ')}\n`;
            resultMessage += `• Match Confidence: ${Math.round(passengerMatch.confidence * 100)}%\n`;
          } else {
            resultMessage += `• ⚠️ No passenger match found\n`;
            resultMessage += `• Extracted Name: ${extractedData?.passengerName || 'Unknown'}\n`;
            resultMessage += `• Requires manual passenger assignment\n`;
          }

          // What was extracted
          resultMessage += `\n📋 Extracted Information:\n`;
          const extractedFields = [];
          if (extractedData?.confirmationCode) extractedFields.push(`Confirmation: ${extractedData.confirmationCode}`);
          if (extractedData?.date) extractedFields.push(`Date: ${extractedData.date}`);
          if (extractedData?.departureTime) extractedFields.push(`Departure: ${extractedData.departureTime}`);
          if (extractedData?.seat) extractedFields.push(`Seat: ${extractedData.seat}`);
          
          if (extractedFields.length > 0) {
            resultMessage += extractedFields.map(field => `• ${field}`).join('\n');
          } else {
            resultMessage += '• Basic flight and passenger info only';
          }

          // Next steps
          resultMessage += `\n\n📝 Next Steps:\n`;
          resultMessage += `• Complete departure/arrival times in dashboard\n`;
          if (!flight.from || !flight.to) {
            resultMessage += `• Add airport information manually\n`;
          }
          if (!passengerMatch.passenger) {
            resultMessage += `• Assign correct passenger in dashboard\n`;
          }
          if (flight.processingStatus === 'partial') {
            resultMessage += `• Review and complete flight details\n`;
          }

          // Add notes if available
          if (flight.notes) {
            resultMessage += `\n📝 Flight Notes:\n${flight.notes}\n`;
          }

          resultMessage += `\n🆔 Flight ID: ${flight.id}`;

          // Update the processing message with results
          await this.bot.editMessageText(resultMessage, {
            chat_id: chatId,
            message_id: processingMessage.message_id,
          });

          // Send additional technical details for debugging (if issues exist)
          if (processingResult.issues.length > 0) {
            const debugMessage = `🔧 Processing Issues:\n` +
              processingResult.issues.map(issue => `• ${issue}`).join('\n') + 
              `\n\n📊 Technical Details:\n` +
              `• Parse Strategy: ${extractedData?.parseStrategy || 'Unknown'}\n` +
              `• OCR Processing: ${processingResult.metadata?.ocrResult?.processingTimeMs || 'N/A'}ms\n` +
              `• Text Blocks Found: ${processingResult.metadata?.ocrResult?.detectionCount || 'N/A'}`;
            
            await this.bot.sendMessage(chatId, debugMessage);
          }

        } else {
          // Processing failed
          let errorMessage = `❌ Ticket Processing Failed (Document)\n\n`;
          errorMessage += `Error: ${processingResult.error}\n\n`;
          
          if (processingResult.issues.length > 0) {
            errorMessage += `Issues encountered:\n`;
            errorMessage += processingResult.issues.map(issue => `• ${issue}`).join('\n') + '\n\n';
          }
          
          errorMessage += `💡 Troubleshooting Tips:\n`;
          errorMessage += `• Ensure image is clear and well-lit\n`;
          errorMessage += `• Make sure ticket text is readable\n`;
          errorMessage += `• Try sending as photo instead of document\n`;
          errorMessage += `• Verify passenger name exists in the system\n\n`;
          errorMessage += `If problems persist, contact your administrator.`;

          await this.bot.editMessageText(errorMessage, {
            chat_id: chatId,
            message_id: processingMessage.message_id,
          });
        }

      } catch (error) {
        console.error('❌ DOCUMENT_HANDLER_ERROR: Comprehensive error occurred:', error);
        
        let errorDetails = '';
        if (error.message.includes('credentials')) {
          errorDetails = `\n\n🔐 Credential Issue Detected\n` +
                        `The Google Vision API credentials may be invalid or missing. ` +
                        `Please check the GOOGLE_CREDENTIALS_JSON environment variable.`;
        } else if (error.message.includes('quota') || error.message.includes('billing')) {
          errorDetails = `\n\n💳 API Quota/Billing Issue\n` +
                        `Google Vision API quota may be exceeded or billing not enabled. ` +
                        `Please check your Google Cloud Console.`;
        } else if (error.message.includes('network') || error.message.includes('ENOTFOUND')) {
          errorDetails = `\n\n🌐 Network Issue\n` +
                        `Unable to connect to Google Vision API. Check your internet connection.`;
        }

        const errorMessage = `❌ Document Ticket Processing Error\n\n` +
                            `${error.message}${errorDetails}\n\n` +
                            `Please try again or contact your administrator if the problem persists.`;

        if (processingMessage) {
          try {
            await this.bot.editMessageText(errorMessage, {
              chat_id: chatId,
              message_id: processingMessage.message_id,
            });
          } catch (editError) {
            // If edit fails, send new message
            await this.bot.sendMessage(chatId, errorMessage);
          }
        } else {
          await this.bot.sendMessage(chatId, errorMessage);
        }
      }
      
      // Mark message as processed (both success and error cases)
      await this.markPhotoMessageAsProcessed(msg);
    });

    // Handle callback queries for flight navigation
    this.bot.on('callback_query', async (callbackQuery) => {
      const chatId = callbackQuery.message.chat.id;
      const data = callbackQuery.data;
      
      console.log('🔍 CALLBACK_QUERY received:', data);
      
      if (data.startsWith('flight_nav_')) {
        console.log('🔍 FLIGHT_NAV callback processing...');
        try {
          const [, , index, encodedPassengerName] = data.split('_');
          const currentIndex = parseInt(index);
          const passengerName = decodeURIComponent(encodedPassengerName);
          
          console.log('🔍 Parsed data:', { currentIndex, passengerName });
          
          // Find the passenger and get their flights
          const passengers = await readPassengers();
          const passenger = passengers.find(p => 
            p.name.toLowerCase() === passengerName.toLowerCase() && 
            p.telegramChatId === chatId
          );
          
          console.log('🔍 Passenger search result:', passenger ? 'Found' : 'Not found');
          
          if (!passenger) {
            console.log('❌ Passenger not found for navigation');
            await this.bot.answerCallbackQuery(callbackQuery.id, { text: 'Passenger not found' });
            return;
          }
          
          const flights = await readFlights();
          const now = new Date();
          
          // Filter flights for this passenger (upcoming flights only)
          const passengerFlights = flights.filter(flight => {
            const departureDate = new Date(flight.departureDateTime);
            if (departureDate <= now) return false;
            
            return flight.passengers?.some(p => {
              if (p.passengerId === passenger.id) return true;
              if (p.name?.toLowerCase() === passenger.name.toLowerCase()) return true;
              return false;
            });
          });
          
          // Sort flights by departure time
          passengerFlights.sort((a, b) => new Date(a.departureDateTime) - new Date(b.departureDateTime));
          
          console.log('🔍 Flight navigation:', { 
            totalFlights: passengerFlights.length, 
            currentIndex, 
            validIndex: currentIndex >= 0 && currentIndex < passengerFlights.length 
          });
          
          if (currentIndex >= 0 && currentIndex < passengerFlights.length) {
            console.log('✅ Navigating to flight:', currentIndex);
            // Delete the old message
            await this.bot.deleteMessage(chatId, callbackQuery.message.message_id);
            
            // Show the new flight
            await this.showFlightWithNavigation(chatId, passengerFlights, currentIndex, passenger.name, passengers);
          } else {
            console.log('❌ Invalid flight index for navigation');
          }
          
          await this.bot.answerCallbackQuery(callbackQuery.id);
        } catch (error) {
          console.error('Error handling flight navigation:', error);
          await this.bot.answerCallbackQuery(callbackQuery.id, { text: 'Error navigating flights' });
        }
      }
    });
  }

  // Send notification to specific user
  async sendNotification(userId, message, options = {}) {
    if (!this.bot) {
      console.log('Telegram bot not configured. Notification not sent:', message);
      return false;
    }

    try {
      const users = await readUsers();
      const user = users.find(u => u.id === userId);
      
      if (!user || !user.telegramChatId) {
        console.log(`User ${userId} doesn't have Telegram configured`);
        return false;
      }

      await this.bot.sendMessage(user.telegramChatId, message, {
        ...options
      });

      return true;
    } catch (error) {
      console.error('Error sending Telegram notification:', error);
      return false;
    }
  }

  // Send pickup reminder
  async sendPickupReminder(flight, volunteerType = 'pickup', timeUntil = '2 hours') {
    const volunteerName = volunteerType === 'pickup' ? flight.pickupSevakName : flight.dropoffSevakName;
    const volunteerPhone = volunteerType === 'pickup' ? flight.pickupSevakPhone : flight.dropoffSevakPhone;
    
    if (!volunteerName) return false;

    // Find user by phone number or name (you might need to implement this)
    const users = await readUsers();
    const volunteerUser = users.find(u => 
      u.name === volunteerName || 
      u.username === volunteerName.toLowerCase().replace(/\s+/g, '')
    );

    if (!volunteerUser) {
      console.log(`Volunteer user not found: ${volunteerName}`);
      return false;
    }

    const departure = new Date(flight.departureDateTime);
    
    // Get passenger details with phone numbers
    const passengers = await readPassengers();
    let passengerDetails = '';
    
    if (flight.passengers && flight.passengers.length > 0) {
      passengerDetails = flight.passengers.map(flightPassenger => {
        const passenger = passengers.find(p => 
          p.name.toLowerCase() === flightPassenger.name.toLowerCase()
        );
        if (passenger && passenger.phone) {
          return `• ${flightPassenger.name} - ${passenger.phone}`;
        } else {
          return `• ${flightPassenger.name} - (no phone)`;
        }
      }).join('\n');
    } else {
      passengerDetails = 'No passengers listed';
    }
    
    const message = 
      `Jai Swaminarayan 🙏\n\n` +
      `🚨 ${volunteerType.toUpperCase()} REMINDER\n\n` +
      `✈️ Flight: ${flight.airline} ${flight.flightNumber}\n` +
      `📍 Route: ${this.formatAirportDisplay(flight.from)} → ${this.formatAirportDisplay(flight.to)}\n` +
      `🕐 Departure: ${this.formatDateTimeWithTimezone(flight.departureDateTime, flight.from)}\n\n` +
      `👥 Passengers:\n${passengerDetails}\n\n` +
      `📞 Your contact: ${volunteerPhone}\n\n` +
      `⏰ ${timeUntil} until ${volunteerType}\n\n` +
      `Please be ready and confirm receipt of this message.`;

    return await this.sendNotification(volunteerUser.id, message);
  }

  // Send flight confirmation to passenger
  async sendFlightConfirmation(flight, flightPassenger) {
    const passengers = await readPassengers();
    let passenger = null;
    
    // Handle both old name-based and new ID-based passenger references
    if (typeof flightPassenger === 'string') {
      // Old format: passed passenger name as string
      passenger = passengers.find(p => 
        p.name && p.name.toLowerCase() === flightPassenger.toLowerCase()
      );
    } else if (flightPassenger.passengerId) {
      // New format: flight passenger object with passengerId
      passenger = passengers.find(p => p.id === flightPassenger.passengerId);
    } else if (flightPassenger.name) {
      // Old format: flight passenger object with name only
      passenger = passengers.find(p => 
        p.name && p.name.toLowerCase() === flightPassenger.name.toLowerCase()
      );
    }

    if (!passenger || !passenger.telegramChatId) {
      const identifier = typeof flightPassenger === 'string' 
        ? flightPassenger 
        : flightPassenger.passengerId || flightPassenger.name || 'Unknown';
      console.log(`Passenger ${identifier} not found or doesn't have Telegram`);
      return false;
    }

    const message = 
      `Jai Swaminarayan 🙏\n\n` +
      `✅ FLIGHT CONFIRMATION\n\n` +
      `✈️ Flight: ${flight.airline} ${flight.flightNumber}\n` +
      `📍 Route: ${this.formatAirportDisplay(flight.from)} → ${this.formatAirportDisplay(flight.to)}\n` +
      `🛫 Departure: ${this.formatDateTimeWithTimezone(flight.departureDateTime, flight.from)}\n` +
      `🛬 Arrival: ${this.formatDateTimeWithTimezone(flight.arrivalDateTime, flight.to)}\n\n` +
      `${flight.pickupSevakName ? `🚗 Pickup Volunteer: ${flight.pickupSevakName} (${flight.pickupSevakPhone})\n` : ''}` +
      `${flight.dropoffSevakName ? `🚗 Dropoff Volunteer: ${flight.dropoffSevakName} (${flight.dropoffSevakPhone})\n` : ''}` +
      `${flight.notes ? `📝 Notes: ${flight.notes}\n` : ''}` +
      `\nHave a safe journey! ✈️`;

    try {
      await this.bot.sendMessage(passenger.telegramChatId, message);
      return true;
    } catch (error) {
      console.error('Error sending flight confirmation:', error);
      return false;
    }
  }

  // Send flight update notification
  async sendFlightUpdate(flight, updateType = 'changed') {
    const users = await readUsers();
    const notifiedUsers = [];

    // Notify pickup and dropoff volunteers
    if (flight.pickupSevakName) {
      const pickupUser = users.find(u => 
        u.name === flight.pickupSevakName || 
        u.username === flight.pickupSevakName.toLowerCase().replace(/\s+/g, '')
      );
      if (pickupUser) notifiedUsers.push(pickupUser.id);
    }

    if (flight.dropoffSevakName) {
      const dropoffUser = users.find(u => 
        u.name === flight.dropoffSevakName || 
        u.username === flight.dropoffSevakName.toLowerCase().replace(/\s+/g, '')
      );
      if (dropoffUser) notifiedUsers.push(dropoffUser.id);
    }

    const departure = new Date(flight.departureDateTime);
    
    // Get passenger details with phone numbers
    const passengers = await readPassengers();
    let passengerDetails = '';
    
    if (flight.passengers && flight.passengers.length > 0) {
      passengerDetails = flight.passengers.map(flightPassenger => {
        const passenger = passengers.find(p => 
          p.name.toLowerCase() === flightPassenger.name.toLowerCase()
        );
        if (passenger && passenger.phone) {
          return `• ${flightPassenger.name} - ${passenger.phone}`;
        } else {
          return `• ${flightPassenger.name} - (no phone)`;
        }
      }).join('\n');
    } else {
      passengerDetails = 'No passengers listed';
    }
    
    const message = 
      `Jai Swaminarayan 🙏\n\n` +
      `🔄 FLIGHT ${updateType.toUpperCase()}\n\n` +
      `✈️ Flight: ${flight.airline} ${flight.flightNumber}\n` +
      `📍 Route: ${this.formatAirportDisplay(flight.from)} → ${this.formatAirportDisplay(flight.to)}\n` +
      `🛫 New Departure: ${this.formatDateTimeWithTimezone(flight.departureDateTime, flight.from)}\n\n` +
      `👥 Passengers:\n${passengerDetails}\n\n` +
      `Please update your schedule accordingly.`;

    const results = await Promise.all(
      notifiedUsers.map(userId => this.sendNotification(userId, message))
    );

    return results.some(result => result === true);
  }

  // Send notification to dashboard users
  async sendDashboardNotification(message, notificationType = 'general') {
    if (!this.bot) {
      console.log('Telegram bot not configured. Dashboard notification not sent:', message);
      return false;
    }

    try {
      const users = await readUsers();
      
      // Filter dashboard users with Telegram linked (excluding volunteers)
      const eligibleUsers = users.filter(user => {
        // Must have Telegram linked and not be a volunteer role
        if (!user.telegramChatId || user.role === 'volunteer') return false;
        
        // All dashboard users (user, admin, superadmin) get notifications
        return ['user', 'admin', 'superadmin'].includes(user.role);
      });

      const results = await Promise.all(
        eligibleUsers.map(async (user) => {
          try {
            await this.bot.sendMessage(user.telegramChatId, message);
            return true;
          } catch (error) {
            console.error(`Failed to send notification to dashboard user ${user.username}:`, error.message);
            return false;
          }
        })
      );

      console.log(`📢 Sent dashboard notification to ${results.filter(r => r).length}/${eligibleUsers.length} users`);
      return results.some(result => result === true);

    } catch (error) {
      console.error('Error sending dashboard notification:', error);
      return false;
    }
  }

  // Send flight addition notification
  async sendFlightAddedNotification(flight) {
    // Get passenger names, handling both old name format and new passengerId format
    let passengers = 'No passengers';
    if (flight.passengers?.length > 0) {
      const { resolveFlightPassengerNames } = require('./data-helpers');
      const resolvedPassengers = await resolveFlightPassengerNames(flight.passengers);
      passengers = resolvedPassengers.map(p => p.name).join(', ');
    }
    
    const message = 
      `Jai Swaminarayan 🙏\n\n` +
      `✅ NEW FLIGHT ADDED\n\n` +
      `✈️ Flight: ${flight.airline} ${flight.flightNumber}\n` +
      `📍 Route: ${this.formatAirportDisplay(flight.from)} → ${this.formatAirportDisplay(flight.to)}\n` +
      `👥 Passengers: ${passengers}\n` +
      `🛫 Departure: ${this.formatDateTimeWithTimezone(flight.departureDateTime, flight.from)}\n` +
      `🛬 Arrival: ${this.formatDateTimeWithTimezone(flight.arrivalDateTime, flight.to)}\n` +
      `${flight.pickupSevakName ? `🚗 Pickup: ${flight.pickupSevakName}\n` : ''}` +
      `${flight.dropoffSevakName ? `🚗 Dropoff: ${flight.dropoffSevakName}\n` : ''}` +
      `${flight.notes ? `📝 Notes: ${flight.notes}\n` : ''}`;

    // Send to dashboard users
    await this.sendDashboardNotification(message, 'flightUpdates');

    // Send confirmation to passengers
    if (flight.passengers) {
      for (const passenger of flight.passengers) {
        await this.sendFlightConfirmation(flight, passenger);
      }
    }

    return true;
  }

  // Send flight update notification with real-time data
  async sendFlightUpdateNotification(flight, updateType = 'updated') {
    try {
      // Get real-time flight data if available
      let flightInfo = null;
      const flightDate = new Date(flight.departureDateTime).toISOString().split('T')[0];
      
      try {
        flightInfo = await this.flightInfoService.getFlightInfo(flight.flightNumber, flightDate, flight.airline);
      } catch (error) {
        console.log('Could not fetch real-time flight data:', error.message);
      }

      const departure = new Date(flight.departureDateTime);
      const passengers = flight.passengers?.map(p => p.name).join(', ') || 'No passengers';
      
      let message = 
        `Jai Swaminarayan 🙏\n\n` +
        `🔄 FLIGHT ${updateType.toUpperCase()}\n\n` +
        `✈️ Flight: ${flight.airline} ${flight.flightNumber}\n` +
        `📍 Route: ${this.formatAirportDisplay(flight.from)} → ${this.formatAirportDisplay(flight.to)}\n` +
        `👥 Passengers: ${passengers}\n` +
        `🛫 Departure: ${this.formatDateTimeWithTimezone(flight.departureDateTime, flight.from)}\n`;

      // Add real-time information if available
      if (flightInfo && !flightInfo.error) {
        message += `\n🔴 REAL-TIME STATUS\n` +
                  `Status: ${flightInfo.flightStatus.toUpperCase()}\n` +
                  `${flightInfo.delayNotification}\n`;
        
        if (flightInfo.estimatedDeparture !== 'Not available') {
          message += `Estimated Departure: ${flightInfo.estimatedDeparture}\n`;
        }
        if (flightInfo.estimatedArrival !== 'Not available') {
          message += `Estimated Arrival: ${flightInfo.estimatedArrival}\n`;
        }
      }

      message += `\n📱 Please check for any schedule changes.`;

      // Send to all relevant parties
      await this.sendDashboardNotification(message, 'flightUpdates');
      await this.sendFlightUpdate(flight, updateType);

      // Send to passengers
      if (flight.passengers) {
        for (const passenger of flight.passengers) {
          await this.sendPassengerFlightUpdate(flight, passenger.name, flightInfo);
        }
      }

      return true;
    } catch (error) {
      console.error('Error sending flight update notification:', error);
      return false;
    }
  }

  // Send flight update to specific passenger
  async sendPassengerFlightUpdate(flight, passengerName, flightInfo = null) {
    const passengers = await readPassengers();
    const passenger = passengers.find(p => 
      p.name.toLowerCase() === passengerName.toLowerCase()
    );

    if (!passenger || !passenger.telegramChatId) {
      console.log(`Passenger ${passengerName} not found or doesn't have Telegram`);
      return false;
    }

    const departure = new Date(flight.departureDateTime);
    
    let message = 
      `Jai Swaminarayan 🙏\n\n` +
      `📱 YOUR FLIGHT HAS BEEN UPDATED\n\n` +
      `✈️ Flight: ${flight.airline} ${flight.flightNumber}\n` +
      `📍 Route: ${this.formatAirportDisplay(flight.from)} → ${this.formatAirportDisplay(flight.to)}\n` +
      `🛫 Departure: ${this.formatDateTimeWithTimezone(flight.departureDateTime, flight.from)}\n`;

    // Add real-time status if available
    if (flightInfo && !flightInfo.error) {
      message += `\n🔴 CURRENT STATUS\n` +
                `Status: ${flightInfo.flightStatus.toUpperCase()}\n` +
                `${flightInfo.delayNotification}\n`;
    }

    message += `\n${flight.pickupSevakName ? `🚗 Pickup: ${flight.pickupSevakName} (${flight.pickupSevakPhone})\n` : ''}` +
              `${flight.dropoffSevakName ? `🚗 Dropoff: ${flight.dropoffSevakName} (${flight.dropoffSevakPhone})\n` : ''}` +
              `\n💡 Use /flightinfo ${flight.flightNumber} ${new Date(flight.departureDateTime).toISOString().split('T')[0]} for latest updates.`;

    try {
      await this.bot.sendMessage(passenger.telegramChatId, message);
      return true;
    } catch (error) {
      console.error('Error sending passenger flight update:', error);
      return false;
    }
  }

  // Check for delays and send alerts
  async checkFlightDelays() {
    if (!this.bot) return;

    try {
      const flights = await readFlights();
      const now = new Date();
      
      // Check flights departing in the next 24 hours
      const upcomingFlights = flights.filter(flight => {
        const departureTime = new Date(flight.departureDateTime);
        const timeDiff = departureTime - now;
        return timeDiff > 0 && timeDiff <= 24 * 60 * 60 * 1000; // Next 24 hours
      });

      for (const flight of upcomingFlights) {
        try {
          const flightDate = new Date(flight.departureDateTime).toISOString().split('T')[0];
          const flightInfo = await this.flightInfoService.getFlightInfo(flight.flightNumber, flightDate, flight.airline);
          
          if (!flightInfo.error && flightInfo.flightStatus !== 'scheduled') {
            // Flight has status update or delay
            if (flightInfo.delayNotification.includes('Delayed') || 
                flightInfo.flightStatus === 'cancelled' ||
                flightInfo.flightStatus === 'diverted') {
              
              await this.sendDelayAlert(flight, flightInfo);
            }
          }
        } catch (error) {
          console.log(`Could not check delay for flight ${flight.flightNumber}:`, error.message);
        }
      }
    } catch (error) {
      console.error('Error checking flight delays:', error);
    }
  }

  // Send delay alert
  async sendDelayAlert(flight, flightInfo) {
    const passengers = flight.passengers?.map(p => p.name).join(', ') || 'No passengers';
    
    const message = 
      `Jai Swaminarayan 🙏\n\n` +
      `🚨 FLIGHT DELAY ALERT\n\n` +
      `✈️ Flight: ${flight.airline} ${flight.flightNumber}\n` +
      `📍 Route: ${this.formatAirportDisplay(flight.from)} → ${this.formatAirportDisplay(flight.to)}\n` +
      `👥 Passengers: ${passengers}\n` +
      `🛫 Departure: ${this.formatDateTimeWithTimezone(flight.departureDateTime, flight.from)}\n\n` +
      `🔴 CURRENT STATUS\n` +
      `Status: ${flightInfo.flightStatus.toUpperCase()}\n` +
      `${flightInfo.delayNotification}\n\n` +
      `${flightInfo.estimatedDeparture !== 'Not available' ? `🕐 New Estimated Departure: ${flightInfo.estimatedDeparture}\n` : ''}` +
      `\n📱 Please adjust your schedule accordingly.`;

    // Send to all relevant parties
    await this.sendDashboardNotification(message, 'delays');
    
    // Send to passengers
    if (flight.passengers) {
      for (const passenger of flight.passengers) {
        await this.sendPassengerFlightUpdate(flight, passenger.name, flightInfo);
      }
    }

    // Send to volunteers
    await this.sendFlightUpdate(flight, 'delay alert');

    console.log(`🚨 Sent delay alert for flight ${flight.flightNumber}`);
    return true;
  }

  // Set up webhook for production
  async setupWebhook(webhookUrl) {
    if (!this.bot) return false;
    
    try {
      await this.bot.setWebHook(webhookUrl);
      console.log(`🌐 Telegram webhook set to: ${webhookUrl}`);
      return true;
    } catch (error) {
      console.error('Failed to set webhook:', error);
      return false;
    }
  }

  // Process webhook update
  async processWebhookUpdate(req, res) {
    if (!this.bot) {
      console.error('Webhook called but bot not initialized');
      return res.status(500).json({ error: 'Bot not initialized' });
    }

    try {
      console.log('Processing webhook update:', JSON.stringify(req.body, null, 2));
      
      // Handle different message types
      if (req.body.message) {
        const message = req.body.message;
        
        if (message.text) {
          // Handle text messages manually to avoid conflicts
          console.log(`📨 Processing text message: "${message.text}" from chat ${message.chat.id}`);
          await this.processManualCommand(message);
        } else if (message.photo || message.document) {
          // Handle photo/document messages through normal bot processing for Gemini
          console.log(`📷 Processing photo/document message from chat ${message.chat.id}`);
          this.bot.processUpdate(req.body);
        } else {
          // Handle other message types through normal processing
          this.bot.processUpdate(req.body);
        }
      } else if (req.body.callback_query) {
        // Handle callback queries (inline keyboard buttons)
        console.log(`🔘 Processing callback query from chat ${req.body.callback_query.message.chat.id}`);
        this.bot.processUpdate(req.body);
      }
      
      res.status(200).json({ ok: true });
    } catch (error) {
      console.error('Error processing webhook update:', error);
      console.error('Request body:', JSON.stringify(req.body, null, 2));
      res.status(500).json({ error: 'Failed to process update', details: error.message });
    }
  }

  // Manual command processing for webhook mode
  async processManualCommand(message) {
    try {
      const text = message.text;
      const chatId = message.chat.id;
      
      // Mark message as processed to prevent duplicate processing
      const messageId = `${message.chat.id}_${message.message_id}`;
      if (this.processedMessages.has(messageId)) {
        console.log('Message already processed, skipping');
        return;
      }
      this.processedMessages.add(messageId);
      
      console.log(`🎯 Manual command processing for: ${text}`);
      
      // First check if user is in a registration state (for non-command text)
      if (!text.startsWith('/')) {
        const registrationState = this.registrationStates.get(chatId);
        if (registrationState) {
          console.log(`📝 Processing registration input for chatId ${chatId}: type=${registrationState.type}, step=${registrationState.step}`);
          
          // Handle passenger registration name input
          if (registrationState.type === 'passenger' && registrationState.step === 'waiting_name') {
            const fullName = text.trim();
            
            // Validate name format (First Name & Last Name)
            const nameParts = fullName.split(/\s+/);
            if (nameParts.length < 2 || fullName.length < 3) {
              await this.bot.sendMessage(chatId, 
                `Jai Swaminarayan 🙏\n\n` +
                `❌ Please enter your name in First Name & Last Name format.\n\n` +
                `Examples:\n` +
                `• John Smith\n` +
                `• Mary Johnson\n` +
                `• Harinivas Swami\n\n` +
                `Please try again:`
              );
              return;
            }
            
            // First, search for existing passenger using fuzzy matching
            console.log(`🔍 Searching for existing passenger: "${fullName}" for chatId ${chatId}`);
            const existingPassenger = await findPassengerByName(fullName);
            
            if (existingPassenger) {
              // Link existing passenger to Telegram chat ID
              console.log(`✅ Found existing passenger: ${existingPassenger.name} (ID: ${existingPassenger.id})`);
              
              // Check if already linked to a different chat ID
              if (existingPassenger.telegramChatId && existingPassenger.telegramChatId !== chatId) {
                await this.bot.sendMessage(chatId, 
                  `Jai Swaminarayan 🙏\n\n` +
                  `⚠️ This passenger account is already linked to another Telegram account.\n\n` +
                  `If this is your account and you need to update the link, please contact your administrator.\n\n` +
                  `👤 Found: ${existingPassenger.name}`
                );
                await this.deleteRegistrationState(chatId);
                return;
              }
              
              // Link the existing passenger to this chat ID
              const passengers = await readPassengers();
              const passengerIndex = passengers.findIndex(p => p.id === existingPassenger.id);
              if (passengerIndex !== -1) {
                passengers[passengerIndex].telegramChatId = chatId;
                passengers[passengerIndex].updatedAt = new Date().toISOString();
                await writePassengers(passengers);
                
                await this.bot.sendMessage(chatId, 
                  `Jai Swaminarayan 🙏\n\n` +
                  `🎉 Welcome back to West Sant Transportation!\n\n` +
                  `✅ Successfully linked your Telegram to existing passenger account:\n` +
                  `👤 Name: ${existingPassenger.name}\n` +
                  `📊 Previous Flights: ${existingPassenger.flightCount || 0}\n\n` +
                  `You'll receive notifications for:\n` +
                  `🔔 Flight confirmations\n` +
                  `🔔 Flight updates and changes\n` +
                  `🔔 24-hour check-in reminders\n` +
                  `🔔 Volunteer contact information\n\n` +
                  `Available commands:\n` +
                  `/myflights - View your upcoming flights\n` +
                  `/help - Show help menu\n\n` +
                  `Welcome back! 🙏`
                );
              }
            } else {
              // No existing passenger found, create new one
              console.log(`➕ No existing passenger found for "${fullName}", creating new passenger`);
              const passengers = await readPassengers();
              const newPassenger = {
                id: require('uuid').v4(),
                name: fullName,
                legalName: fullName, // Use same name for legal name
                telegramChatId: chatId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                flightCount: 0
              };
              
              passengers.push(newPassenger);
              await writePassengers(passengers);
              console.log(`✅ Created new passenger: ${newPassenger.name} (ID: ${newPassenger.id})`);
              
              await this.bot.sendMessage(chatId, 
                `Jai Swaminarayan 🙏\n\n` +
                `🎉 Welcome to West Sant Transportation!\n\n` +
                `✅ Successfully registered as new passenger:\n` +
                `👤 Name: ${newPassenger.name}\n\n` +
                `You'll receive notifications for:\n` +
                `🔔 Flight confirmations\n` +
                `🔔 Flight updates and changes\n` +
                `🔔 24-hour check-in reminders\n` +
                `🔔 Volunteer contact information\n\n` +
                `Available commands:\n` +
                `/myflights - View your upcoming flights\n` +
                `/help - Show help menu\n\n` +
                `Thank you for registering! 🙏`
              );
            }
            
            // Clear registration state
            await this.deleteRegistrationState(chatId);
            return;
          }
          
          // Handle other registration types if needed
          // (volunteer, user registration states would go here)
        }
      }
      
      // Since onText handlers might not work in webhook mode, directly execute command logic
      if (text === '/help') {
        console.log('Processing /help command manually');
        await this.handleHelpCommand(chatId);
      } else if (text === '/start') {
        console.log('Processing /start command manually');
        await this.handleStartCommand(chatId);
      } else if (text === '/upcomingflights') {
        console.log('Processing /upcomingflights command manually');
        await this.handleUpcomingFlightsCommand(chatId);
      } else if (text === '/flights') {
        console.log('Processing /flights command manually');
        await this.handleFlightsCommand(chatId);
      } else if (text === '/myflights') {
        console.log('Processing /myflights command manually');
        await this.handleMyFlightsCommand(chatId);
      } else if (text.startsWith('/flightinfo ')) {
        console.log('Processing /flightinfo command manually');
        const match = text.match(/\/flightinfo\s+(.+)/);
        if (match) {
          await this.handleFlightInfoCommand(chatId, match);
        }
      } else if (text === '/register_volunteer') {
        console.log('Processing /register_volunteer command manually');
        await this.handleRegisterVolunteerCommand(chatId);
      } else if (text === '/register_passenger') {
        console.log('Processing /register_passenger command manually');
        await this.handleRegisterPassengerCommand(chatId);
      } else if (text === '/register_user') {
        console.log('Processing /register_user command manually');
        await this.handleRegisterUserCommand(chatId);
      }
    } catch (error) {
      console.error('Error in manual command processing:', error);
    }
  }

  // Send message to specific chat ID
  async sendMessage(chatId, message, options = {}) {
    if (!this.bot) {
      console.log('Telegram bot not configured. Message not sent:', message);
      return false;
    }

    try {
      await this.bot.sendMessage(chatId, message, options);
      return true;
    } catch (error) {
      console.error('Error sending Telegram message:', error);
      return false;
    }
  }

  // Find volunteer by name (for flight monitoring notifications)
  async findVolunteerByName(volunteerName) {
    try {
      const users = await readUsers();
      
      // Search for volunteer user by various matching criteria
      const volunteer = users.find(user => {
        // Only volunteers can be found by this method
        if (user.role !== 'volunteer') return false;
        
        // Match by exact name
        if (user.name && user.name.toLowerCase() === volunteerName.toLowerCase()) return true;
        
        // Match by username
        if (user.username && user.username.toLowerCase() === volunteerName.toLowerCase()) return true;
        
        // Match by name with spaces converted to underscores (common pattern)
        const normalizedVolunteerName = volunteerName.toLowerCase().replace(/\s+/g, '_');
        if (user.username && user.username.toLowerCase() === normalizedVolunteerName) return true;
        
        // Match by username with underscores converted to spaces
        const normalizedUsername = (user.username || '').toLowerCase().replace(/_/g, ' ');
        if (normalizedUsername === volunteerName.toLowerCase()) return true;
        
        return false;
      });
      
      if (volunteer) {
        console.log(`✅ Found volunteer: ${volunteer.name || volunteer.username} for search: ${volunteerName}`);
        return {
          id: volunteer.id,
          name: volunteer.name || volunteer.username,
          username: volunteer.username,
          telegramChatId: volunteer.telegramChatId,
          role: volunteer.role
        };
      } else {
        console.log(`⚠️ Volunteer not found: ${volunteerName}`);
        return null;
      }
    } catch (error) {
      console.error('Error finding volunteer by name:', error);
      return null;
    }
  }

  // Find users by airport (for flight monitoring notifications)
  async findUsersByAirport(airportCode) {
    try {
      const users = await readUsers();
      
      // Find users who have access to this airport
      const airportUsers = users.filter(user => {
        // Skip volunteers (they don't get airport-based notifications)
        if (user.role === 'volunteer') return false;
        
        // Must have Telegram linked
        if (!user.telegramChatId) return false;
        
        // Superadmins and admins get notifications for all airports
        if (user.role === 'superadmin' || user.role === 'admin') return true;
        
        // Regular users: check their allowedAirports
        if (user.role === 'user') {
          // If no allowedAirports specified, they have access to all airports
          if (!user.allowedAirports || user.allowedAirports.length === 0) return true;
          
          // Check if they have access to this specific airport
          return user.allowedAirports.includes(airportCode);
        }
        
        return false;
      });
      
      console.log(`✅ Found ${airportUsers.length} users with access to airport: ${airportCode}`);
      
      return airportUsers.map(user => ({
        id: user.id,
        name: user.name || user.username,
        username: user.username,
        telegramChatId: user.telegramChatId,
        role: user.role,
        allowedAirports: user.allowedAirports || []
      }));
    } catch (error) {
      console.error('Error finding users by airport:', error);
      return [];
    }
  }

  // Send 24-hour check-in reminder to passengers
  async sendCheckInReminder(flight) {
    if (!this.bot) {
      console.log('Telegram bot not configured. Check-in reminder not sent.');
      return false;
    }

    try {
      const passengers = await readPassengers();
      const flightPassengers = flight.passengers || [];
      let remindersSent = 0;

      const departure = new Date(flight.departureDateTime);
      const departureLocal = this.formatDateTimeWithTimezone(flight.departureDateTime, flight.from);
      
      // Get airline-specific check-in URL if available
      const checkInUrls = {
        'American Airlines': 'https://www.aa.com/checkin',
        'Delta Air Lines': 'https://www.delta.com/checkin',
        'United Airlines': 'https://www.united.com/checkin',
        'Southwest Airlines': 'https://www.southwest.com/air/check-in/',
        'JetBlue Airways': 'https://www.jetblue.com/checkin',
        'Alaska Airlines': 'https://www.alaskaair.com/checkin',
        'Spirit Airlines': 'https://www.spirit.com/check-in',
        'Frontier Airlines': 'https://www.flyfrontier.com/checkin'
      };

      const checkInUrl = checkInUrls[flight.airline] || 'your airline\'s website or mobile app';
      const checkInText = checkInUrls[flight.airline] ? `online at ${checkInUrl}` : `via ${checkInUrl}`;

      for (const flightPassenger of flightPassengers) {
        const passenger = passengers.find(p => 
          p.name.toLowerCase() === flightPassenger.name.toLowerCase()
        );

        if (passenger && passenger.telegramChatId) {
          const message = 
            `Jai Swaminarayan 🙏\n\n` +
            `⏰ CHECK-IN REMINDER - 24 Hours Notice\n\n` +
            `✈️ Flight: ${flight.airline} ${flight.flightNumber}\n` +
            `📍 Route: ${this.formatAirportDisplay(flight.from)} → ${this.formatAirportDisplay(flight.to)}\n` +
            `🛫 Departure: ${departureLocal}\n\n` +
            `🎫 Time to check in!\n` +
            `Most airlines allow online check-in 24 hours before departure.\n\n` +
            `📱 Check in ${checkInText}\n\n` +
            `💡 Tips:\n` +
            `• Check in early to get better seat selection\n` +
            `• Download your boarding pass to your phone\n` +
            `• Arrive at airport 2-3 hours early for international flights\n` +
            `• Check baggage requirements and restrictions\n\n` +
            `${flight.pickupSevakName ? `🚗 Pickup: ${flight.pickupSevakName} (${flight.pickupSevakPhone})\n` : ''}` +
            `${flight.dropoffSevakName ? `🚗 Dropoff: ${flight.dropoffSevakName} (${flight.dropoffSevakPhone})\n` : ''}` +
            `\n💡 Use /flightinfo ${flight.flightNumber} ${new Date(flight.departureDateTime).toISOString().split('T')[0]} for latest flight updates.`;

          try {
            await this.bot.sendMessage(passenger.telegramChatId, message);
            remindersSent++;
            console.log(`✅ Check-in reminder sent to passenger: ${passenger.name}`);
          } catch (error) {
            console.error(`Error sending check-in reminder to ${passenger.name}:`, error);
          }
        }
      }

      if (remindersSent > 0) {
        console.log(`✅ Sent ${remindersSent} check-in reminders for flight ${flight.flightNumber}`);
      }

      return remindersSent > 0;
    } catch (error) {
      console.error('Error sending check-in reminders:', error);
      return false;
    }
  }

  // Show flight with navigation buttons
  async showFlightWithNavigation(chatId, flights, currentIndex, passengerName, allPassengers) {
    if (!flights || flights.length === 0) return;
    
    const flight = flights[currentIndex];
    
    // Get all passenger names
    const allPassengerNames = [];
    if (flight.passengers?.length > 0) {
      for (const p of flight.passengers) {
        if (p.name) {
          allPassengerNames.push(p.name);
        } else if (p.passengerId) {
          const passengerData = allPassengers.find(passenger => passenger.id === p.passengerId);
          if (passengerData) {
            allPassengerNames.push(passengerData.name);
          } else {
            allPassengerNames.push('Unknown Passenger');
          }
        }
      }
    }
    
    let message = `Jai Swaminarayan 🙏\n\n` +
                  `✈️ Flight ${currentIndex + 1} of ${flights.length}\n\n` +
                  `✈️ ${flight.airline} ${flight.flightNumber}\n\n` +
                  `🛫 Departure\n` +
                  `${this.formatAirportDisplay(flight.from)}\n` +
                  `${this.formatDateTimeWithTimezone(flight.departureDateTime, flight.from)}\n\n` +
                  `🛬 Arrival\n` +
                  `${this.formatAirportDisplay(flight.to)}\n` +
                  `${this.formatDateTimeWithTimezone(flight.arrivalDateTime, flight.to)}\n\n`;
    
    // Show all passengers
    if (allPassengerNames.length > 0) {
      message += `👥 Passengers\n${allPassengerNames.join(', ')}\n\n`;
    }
    
    // Transportation Details
    if (flight.pickupSevakName || flight.dropoffSevakName) {
      message += `🚗 Transportation\n`;
      if (flight.pickupSevakName) {
        message += `Pickup: ${flight.pickupSevakName}`;
        if (flight.pickupSevakPhone) {
          message += ` • ${flight.pickupSevakPhone}`;
        }
        message += `\n`;
      }
      if (flight.dropoffSevakName) {
        message += `Dropoff: ${flight.dropoffSevakName}`;
        if (flight.dropoffSevakPhone) {
          message += ` • ${flight.dropoffSevakPhone}`;
        }
        message += `\n`;
      }
      message += `\n`;
    }
    
    // Notes
    if (flight.notes && flight.notes.trim()) {
      message += `📝 Notes\n${flight.notes}`;
    }
    
    // Create navigation buttons
    const keyboard = [];
    
    if (flights.length > 1) {
      const navRow = [];
      
      if (currentIndex > 0) {
        navRow.push({ 
          text: '⬅️ Previous', 
          callback_data: `flight_nav_${currentIndex - 1}_${encodeURIComponent(passengerName)}` 
        });
      }
      
      if (currentIndex < flights.length - 1) {
        navRow.push({ 
          text: 'Next ➡️', 
          callback_data: `flight_nav_${currentIndex + 1}_${encodeURIComponent(passengerName)}` 
        });
      }
      
      if (navRow.length > 0) {
        keyboard.push(navRow);
      }
    }
    
    const options = {
      reply_markup: {
        inline_keyboard: keyboard
      }
    };
    
    await this.bot.sendMessage(chatId, message, options);
  }

  // Get bot instance (for accessing from express routes)
  getBot() {
    return this.bot;
  }
}

module.exports = TelegramNotificationService;