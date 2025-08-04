# Flight Information Service & Automated Monitoring

A comprehensive flight information system with real-time data fetching using FlightAware AeroAPI and fully automated monitoring capabilities.

## 📋 Features

### 🚨 NEW: Automated Flight Monitoring System
- ✅ **Fully Automated**: Monitors flights starting 6 hours before departure
- ✅ **Zero Manual Intervention**: No start/stop buttons needed
- ✅ **Real-time Alerts**: Automatic delay notifications over 15 minutes
- ✅ **Multi-user Notifications**: Alerts passengers, volunteers, and dashboard users
- ✅ **24/7 Operation**: Continuous monitoring with 30-minute check intervals

### ✈️ Real-time Flight Data
- ✅ Fetch live flight data from FlightAware AeroAPI
- ✅ Input validation for flight numbers and dates
- ✅ Comprehensive error handling
- ✅ Mock data fallback for testing/demo
- ✅ Multiple output formats (JSON and formatted text)
- ✅ Delay calculation and notifications
- ✅ Flight status tracking (scheduled, active, landed, cancelled, diverted)

## 🚀 Quick Start

### JavaScript/Node.js Implementation

```javascript
const FlightInfoService = require('./server/flight-info-service');
const FlightMonitorService = require('./server/flight-monitor-service');

// Get real-time flight information
const flightService = new FlightInfoService();

async function lookupFlight() {
  const result = await flightService.getFlightInfo("UA100", "2024-01-15");
  
  if (result.error) {
    console.log(`Error: ${result.message}`);
  } else {
    console.log(`Flight ${result.flightNumber} is ${result.flightStatus}`);
    if (result.delayNotification.includes('Delayed')) {
      console.log(`⚠️ ${result.delayNotification}`);
    }
  }
}

// Automated monitoring starts automatically when server boots
// No manual intervention required!
```

### Telegram Bot Integration

```javascript
// Users can get real-time flight info via Telegram
// /flightinfo UA100 2024-01-15

// Bot automatically sends delay alerts to:
// - Passengers: for their specific flights
// - Volunteers: for flights they're assigned to
// - Dashboard users: for flights at their airports
```

## 📊 Enhanced Response Format

### Success Response with FlightAware Data
```json
{
  "error": false,
  "flightNumber": "UA100",
  "airlineName": "United Airlines",
  "airlineIata": "UA",
  "departureAirport": "John F. Kennedy International Airport",
  "departureIata": "JFK",
  "arrivalAirport": "Los Angeles International Airport",
  "arrivalIata": "LAX",
  "scheduledDeparture": "2024-01-15 08:00 EST",
  "scheduledArrival": "2024-01-15 11:30 PST",
  "actualDeparture": "2024-01-15 08:15 EST",
  "estimatedDeparture": "Not available",
  "actualArrival": "Not available",
  "estimatedArrival": "2024-01-15 11:45 PST",
  "flightStatus": "active",
  "delayNotification": "Delayed by 15 minutes",
  "flightDate": "2024-01-15",
  "scheduledDepartureRaw": "2024-01-15T13:00:00Z",
  "actualDepartureRaw": "2024-01-15T13:15:00Z"
}
```

### Error Response
```json
{
  "error": true,
  "message": "No flight found for INVALID123 on 2024-01-15"
}
```

## 🔧 API Configuration

### FlightAware AeroAPI Integration
- **API Provider**: FlightAware AeroAPI (upgraded from AviationStack)
- **Base URL**: `https://aeroapi.flightaware.com/aeroapi/`
- **Authentication**: API Key via headers
- **Rate Limits**: Configurable with 2-second delays between requests

### Environment Variables
```bash
FLIGHTAWARE_API_KEY=your-api-key-here
NODE_ENV=production
```

## 🚨 Automated Monitoring System

### How It Works
1. **Automatic Start**: System monitors each flight starting 6 hours before departure
2. **Continuous Checking**: Status checked every 30 minutes until takeoff
3. **Smart Detection**: Alerts triggered for delays over 15 minutes
4. **Multi-user Alerts**: Comprehensive notification system

### Notification Recipients
- **Passengers**: Get alerts for their specific flights
- **Volunteers**: Receive alerts for flights they're assigned to
- **Dashboard Users**: Notified about flights at their assigned airports

### Monitoring Architecture
```javascript
class FlightMonitorService {
  constructor() {
    this.hoursBeforeDeparture = 6;  // Start monitoring 6 hours before
    this.checkIntervalMinutes = 30; // Check every 30 minutes
    this.startAutomaticMonitoring(); // Starts immediately
  }
  
  async checkFlightsInMonitoringWindow() {
    // Automatically finds flights within 6-hour window
    // Checks FlightAware API for current status
    // Sends alerts if delays detected
  }
}
```

## 📝 Usage Examples

### 1. Real-time Flight Status Check
```javascript
const flightService = new FlightInfoService();
const result = await flightService.getFlightInfo("UA100", "2024-01-15");

if (!result.error) {
  console.log(`Status: ${result.flightStatus}`);
  console.log(`Departure: ${result.scheduledDeparture}`);
  if (result.delayNotification.includes('Delayed')) {
    console.log(`⚠️ Alert: ${result.delayNotification}`);
  }
}
```

### 2. Automated Monitoring (No Code Required)
```javascript
// The monitoring system starts automatically when the server boots
// No manual intervention needed!

// Monitor logs will show:
// 🚁 Starting automatic flight monitoring system
// 📅 Will monitor flights starting 6 hours before departure
// ⏰ Check interval: every 30 minutes
// 🔍 Checking flights within monitoring window...
// 📊 Found 3 flights in monitoring window
// 🚨 Sent delay alert for flight UA100
```

### 3. Telegram Bot Commands
```bash
# Users can check flight status anytime
/flightinfo UA100 2024-01-15

# System automatically sends alerts like:
# 🚨 FLIGHT DELAY ALERT
# ✈️ Flight: United Airlines UA100
# 📍 Route: JFK → LAX  
# 🔴 CURRENT STATUS: Delayed by 25 minutes
# 🕐 New Estimated Departure: 8:25 AM EST
```

## 🎯 Integration with Flight Tracker

### API Endpoints
```javascript
// Manual flight status check (admin only)
POST /api/monitoring/check-now

// Get monitoring system status
GET /api/monitoring/status

// Update check interval (admin only)
POST /api/monitoring/interval
```

### Flight Creation Enhancement
```javascript
// When creating flights, system automatically:
// 1. Validates flight number against FlightAware
// 2. Pre-populates airport and time data
// 3. Sets up automatic monitoring
// 4. Schedules delay alert notifications
```

## 🔍 Available Flight Statuses

- `Scheduled` - Flight is scheduled but not yet active
- `Active` - Flight is currently in progress  
- `Landed` - Flight has completed successfully
- `Cancelled` - Flight has been cancelled
- `Diverted` - Flight has been diverted to another airport
- `Unknown` - Status cannot be determined

## ⚠️ Enhanced Error Handling

The system handles various scenarios:

1. **API Limitations**: FlightAware's 2-day future flight limit
2. **Network Errors**: Connection timeouts or API unavailability
3. **Authentication Errors**: Invalid API key or expired credentials
4. **Rate Limiting**: Automatic delays between requests
5. **Flight Not Found**: When no matching flight exists
6. **Date Validation**: Past dates and invalid formats

## 🧪 Testing & Development

### Development Mode
```bash
# Start with automatic monitoring
npm run dev

# Logs will show monitoring activity:
# 🚁 Starting automatic flight monitoring system
# 📅 Will monitor flights starting 6 hours before departure
# 😴 No flights to monitor at this time
```

### Manual Testing
```javascript
// Test real-time flight lookup
const result = await flightService.getFlightInfo("UA100", "2024-12-01");
console.log(flightService.formatFlightInfoString(result));
```

## 📚 System Architecture

### Core Components
1. **FlightInfoService** (`flight-info-service.js`) - FlightAware API integration
2. **FlightMonitorService** (`flight-monitor-service.js`) - Automated monitoring
3. **TelegramNotificationService** (`telegram-bot.js`) - Multi-user notifications
4. **FlightMonitoring Component** (`FlightMonitoring.jsx`) - Dashboard interface

### Data Flow
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Flight Data   │───▶│  Monitor Service │───▶│  Delay Detection│
│   (6hrs before) │    │  (Every 30min)   │    │  (15min+ delays)│
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Passengers    │◀───│  Telegram Bot    │◀───│  Alert System   │
│   Volunteers    │    │  Notifications   │    │  (Multi-user)   │
│  Dashboard Users│    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 🔐 Security & Performance

### Security Features
- API key stored in environment variables
- Rate limiting to respect FlightAware limits
- Input validation and sanitization
- Error logging without exposing sensitive data

### Performance Optimizations
- 2-second delays between API calls
- Efficient flight filtering (only monitor relevant flights)
- Caching of flight status to avoid redundant alerts
- Graceful error handling with fallbacks

## 📈 Monitoring Dashboard

### Admin Features
- **System Status**: View automatic monitoring status
- **Manual Check**: Trigger immediate flight status check
- **Interval Control**: Adjust check frequency (15-120 minutes)
- **Activity Logs**: View monitoring activity and alerts sent

### Dashboard Display
```
🚀 Fully Automated System
This monitoring system runs automatically without manual intervention. 
It starts monitoring each flight exactly 6 hours before departure 
and continues until takeoff.

System Status: Always Active
Auto-Check Frequency: Every 30 minutes
```

## 🚀 Production Deployment

### Environment Setup
```bash
# Required environment variables
FLIGHTAWARE_API_KEY=your-api-key
TELEGRAM_BOT_TOKEN=your-bot-token
JWT_SECRET=your-jwt-secret
NODE_ENV=production
```

### Automatic Startup
- Monitoring system starts automatically when server boots
- No manual configuration required
- Scales automatically with flight volume
- Handles server restarts gracefully

## 🎉 Key Benefits

### For Users
- **Zero Manual Work**: System operates completely automatically
- **Proactive Alerts**: Get notified before you even think to check
- **Multi-channel**: Telegram notifications reach everyone relevant
- **Real-time Data**: Always current flight information

### For Administrators  
- **Set and Forget**: No daily management required
- **Comprehensive Coverage**: All flights monitored automatically
- **Detailed Logging**: Complete audit trail of all monitoring activity
- **Scalable**: Handles unlimited flights and users

### For the Organization
- **Improved Service**: Passengers know about delays immediately
- **Better Coordination**: Volunteers get schedule updates automatically
- **Reduced Calls**: Fewer "is my flight delayed?" inquiries
- **Professional Operation**: Automated, reliable, and comprehensive

---

**The system now provides fully automated, comprehensive flight monitoring with zero manual intervention required!** 🚀✈️