# Flight Information Service

A comprehensive flight information system with real-time data fetching using FlightAware AeroAPI and intelligent auto-population features.

## 📋 Features

### ✈️ Real-time Flight Data
- ✅ Fetch live flight data from FlightAware AeroAPI
- ✅ Auto-population of flight forms when users enter flight number and date
- ✅ Input validation for flight numbers and dates
- ✅ Comprehensive error handling with fallback messages
- ✅ Multiple output formats (JSON and formatted text)
- ✅ Flight status tracking (scheduled, active, landed, cancelled, diverted)
- ✅ Timezone-aware flight duration calculation

### 🎯 Smart Auto-population
- ✅ **Automatic Form Filling**: Flight details auto-populate when flight number and departure date are entered
- ✅ **User Verification Prompts**: Reminds users to verify information with their booking
- ✅ **Graceful Fallbacks**: Handles API limitations with helpful suggestions
- ✅ **Real-time Status Indicators**: Shows when flight info is being fetched or populated

## 🚀 Quick Start

### JavaScript/Node.js Implementation

```javascript
const FlightInfoService = require('./server/flight-info-service');

// Get real-time flight information
const flightService = new FlightInfoService();

async function lookupFlight() {
  const result = await flightService.getFlightInfo("UA100", "2024-01-15");
  
  if (result.error) {
    console.log(`Error: ${result.message}`);
  } else {
    console.log(`Flight ${result.flightNumber} is ${result.flightStatus}`);
    console.log(`From: ${result.departure.airport} to ${result.arrival.airport}`);
    console.log(`Departure: ${result.departure.scheduled}`);
    console.log(`Arrival: ${result.arrival.scheduled}`);
  }
}

// Auto-population in forms
async function autoPopulateFlightForm(flightNumber, departureDate) {
  const response = await fetch(`/api/flights/info/${flightNumber}/${departureDate}`);
  const flightInfo = await response.json();
  
  if (flightInfo.success && flightInfo.data) {
    // Auto-populate form fields
    document.getElementById('airline').value = flightInfo.data.airline;
    document.getElementById('from').value = flightInfo.data.departure.airport;
    document.getElementById('to').value = flightInfo.data.arrival.airport;
    document.getElementById('departureTime').value = flightInfo.data.departure.scheduledForInput;
    document.getElementById('arrivalTime').value = flightInfo.data.arrival.scheduledForInput;
  }
}
```

## 🔌 API Endpoints

### Flight Information Lookup
```http
GET /api/flights/info/{flightNumber}/{date}
```

**Parameters:**
- `flightNumber`: IATA flight code (e.g., "UA100", "AA1234")
- `date`: Date in YYYY-MM-DD format (e.g., "2024-01-15")

**Response Format:**
```json
{
  "success": true,
  "data": {
    "flightNumber": "UA100",
    "airline": "United Airlines",
    "flightStatus": "scheduled",
    "departure": {
      "airport": "LAX",
      "scheduled": "2024-01-15 14:30:00",
      "estimated": "2024-01-15 14:30:00",
      "scheduledForInput": "2024-01-15T14:30"
    },
    "arrival": {
      "airport": "SFO", 
      "scheduled": "2024-01-15 16:00:00",
      "estimated": "2024-01-15 16:00:00",
      "scheduledForInput": "2024-01-15T16:00"
    },
    "delayMinutes": 0,
    "delayNotification": "On time"
  }
}
```

### Error Response Format:
```json
{
  "success": false,
  "error": "Flight not found",
  "fallback": {
    "airline": "United Airlines",
    "message": "Please enter flight details manually and verify with your booking"
  }
}
```

## 🌐 Frontend Integration

### Enhanced Flight Forms

The system automatically enhances flight forms with:

1. **Auto-fetch on Input**: When users enter flight number and date
2. **Visual Feedback**: Loading indicators and success messages  
3. **User Guidance**: Instructions on how to use the auto-population
4. **Verification Prompts**: Reminders to check against booking confirmations

### Implementation Example:

```javascript
// Auto-fetch flight information when inputs change
useEffect(() => {
  if (flightNumber && departureDate && flightNumber.length >= 3) {
    fetchFlightInformation();
  }
}, [flightNumber, departureDate]);

const fetchFlightInformation = async () => {
  setFetchingFlightInfo(true);
  try {
    const response = await fetch(`/api/flights/info/${flightNumber}/${departureDate}`);
    const flightInfo = await response.json();
    
    if (flightInfo.success && flightInfo.data) {
      // Auto-populate form
      setFormData(prev => ({
        ...prev,
        airline: flightInfo.data.airline,
        from: flightInfo.data.departure.airport,
        to: flightInfo.data.arrival.airport,
        departureDateTime: flightInfo.data.departure.scheduledForInput,
        arrivalDateTime: flightInfo.data.arrival.scheduledForInput
      }));
      
      setFlightInfoMessage('Flight details auto-populated successfully! Please verify with your booking.');
    }
  } finally {
    setFetchingFlightInfo(false);
  }
};
```

## 🕐 Timezone Handling

The system includes intelligent timezone handling:

- ✅ **Airport Timezone Detection**: Automatically detects airport timezones
- ✅ **Smart Duration Validation**: Allows flights crossing timezones 
- ✅ **International Flight Support**: Handles overnight flights correctly
- ✅ **Flexible Validation**: Accepts arrival times "before" departure for timezone differences

### Example Timezone Scenarios:
- LAX 11:00 PM → NRT 5:00 AM+1 (valid international flight)
- JFK 10:00 PM → LHR 9:00 AM+1 (valid overnight flight)
- Validates reasonable flight durations (5 minutes to 20 hours)

## 🔧 Configuration

### Environment Variables

```bash
# Required for live flight data
FLIGHTAWARE_API_KEY=your_flightaware_api_key_here

# Optional - defaults to production if not set
NODE_ENV=production
```

### API Key Setup

1. Get your FlightAware AeroAPI key from [FlightAware Commercial](https://flightaware.com/commercial/aeroapi/)
2. Set the environment variable in your deployment
3. The system gracefully falls back to manual entry if API key is not configured

## 📊 Features Summary

| Feature | Status | Description |
|---------|--------|-------------|
| Real-time Data | ✅ | Live flight information from FlightAware |
| Auto-population | ✅ | Form fields auto-fill with flight details |
| Error Handling | ✅ | Graceful degradation with helpful messages |
| Timezone Support | ✅ | International flight timezone handling |
| User Guidance | ✅ | Instructions and verification prompts |
| Fallback Support | ✅ | Manual entry when API unavailable |
| Status Indicators | ✅ | Visual feedback during data fetching |
| Form Validation | ✅ | Smart validation for international flights |

## 🛠️ Development

### Testing Flight Lookups

```bash
# Test flight information service
curl "http://localhost:3333/api/flights/info/UA100/2024-01-15"

# Test with invalid flight
curl "http://localhost:3333/api/flights/info/INVALID/2024-01-15"
```

### Mock Data Support

The system includes comprehensive mock data for testing and development, covering various flight statuses and scenarios.

---

For more information about deployment and configuration, see [DEPLOYMENT.md](./DEPLOYMENT.md).