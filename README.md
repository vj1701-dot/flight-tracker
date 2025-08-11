# West Sant Transportation Dashboard

A comprehensive flight tracking and volunteer coordination system designed for managing group travel logistics with automated monitoring and intelligent notifications.

## Features

### 🛫 Flight Management
- Create, edit, and delete flight bookings
- Track passenger lists with autocomplete
- Assign pickup and dropoff volunteers
- Sort flights by departure date
- Archive completed flights
- Real-time flight status updates via FlightAware API

### 🚨 Smart Flight Information & Monitoring System
- **Auto-population**: Flight details automatically fetched using FlightAware API
- **Multiple flight selection**: When multiple flights exist for same flight number/date, users can select the correct one
- **Real-time monitoring**: Automated flight status monitoring with admin dashboard
- **Telegram alerts**: Instant delay notifications sent to passengers, volunteers, and users
- **24-hour check-in reminders**: Automated reminders sent to passengers via Telegram with airline-specific check-in links
- **Backend automation**: 24/7 monitoring starting 6 hours before each departure
- **Superadmin control**: Exclusive frontend monitoring dashboard to manage alerts and settings
- **Timezone-aware validation**: Handles international flights crossing timezones
- **FlightAware Integration**: Advanced flight data and status updates

### 👥 User Management
- Role-based access control (Super Admin, Admin, User)
- Airport-specific permissions with smart selector (IATA code input and auto-population)
- Secure authentication with JWT tokens
- Streamlined user creation (no email required)
- Comprehensive audit trail for all user actions

### 🚗 Volunteer Coordination
- Volunteer autocomplete with phone number lookup
- Separate pickup/dropoff volunteer management
- Location-based volunteer assignment restrictions
- Automatic delay notifications for assigned flights

### 🤖 Advanced Telegram Bot Integration
- **Multi-User Support**: Passengers, volunteers, and dashboard users
- **Automated Monitoring**: Backend system monitors flights with admin dashboard control
- **Real-time Flight Info**: Live flight status and delay information via bot commands
- **Smart Registration**: Multi-step guided registration with validation
- **AI-Powered Ticket Processing**: Send flight ticket images to auto-extract flight details, passenger info, and seat assignments using Google Gemini AI with OCR fallback
- **Comprehensive Commands**: Flight queries, status checks, and help
- **Check-in Reminders**: Automated 24-hour reminders with airline-specific links and helpful tips
- **Airport-based Notifications**: Dashboard users get alerts for their airports
- **24/7 Monitoring**: Continuous backend monitoring with frontend management interface
- **Superadmin Controls**: Exclusive dashboard interface for managing monitoring settings and manual checks

### 📱 Enhanced User Experience
- Mobile-friendly responsive interface
- Sidebar navigation with clean design
- **Enhanced shareable flight form** with auto-population and user instructions
- **Smart airport selector** with IATA code search
- **Timezone-aware flight validation** for international travel
- Real-time updates and intuitive UI

### 💾 Automated Backup System
- **Pre-deployment backups**: Automatic data backup before each deployment
- **Post-deployment restore**: Seamless data restoration after deployment
- **Cross-deployment continuity**: Passenger, volunteer, user, and flight data persists
- **Google Cloud Storage integration**: Secure, durable backup storage
- **Manual backup management**: On-demand backup creation and restoration

## Technology Stack

- **Frontend**: React.js with Lucide icons
- **Backend**: Node.js with Express
- **Authentication**: JWT with bcrypt
- **Database**: JSON file storage
- **Deployment**: Google Cloud App Engine
- **Bot Integration**: Telegram Bot API
- **Flight Data**: FlightAware AeroAPI
- **Monitoring**: Automated flight status tracking

## 🚀 Quick Start

### Production Deployment (Recommended)

Deploy with automatic backup and restore:
```bash
./deploy-backup.sh deploy
```

### Simple Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd "Flight Tracker"
   ```

2. **Install dependencies**
   ```bash
   npm run install:all
   ```

3. **Start development servers**
   ```bash
   npm run dev
   ```

4. **Access the application**
   - Frontend: http://localhost:5173
   - Backend: http://localhost:3333
   - Default login: `superadmin` / `admin123`

### Production Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed Google Cloud Platform deployment instructions.

## Project Structure

```
Flight Tracker/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable React components (includes FlightMonitoring)
│   │   ├── pages/         # Main application pages (Dashboard with monitoring tab)
│   │   └── utils/         # Utility functions
├── server/                # Node.js backend
│   ├── index.js          # Main server file
│   ├── telegram-bot.js   # Telegram bot service
│   ├── flight-monitor-service.js # Automated monitoring system
│   ├── flight-info-service.js   # FlightAware API integration
│   └── data-helpers.js   # Data management utilities
├── app.yaml              # GCP App Engine configuration
├── package.json          # Root package configuration
└── DEPLOYMENT.md         # Deployment guide
```

## User Roles

### Super Admin
- Full system access
- User management
- Flight-specific audit trail access
- All flight operations
- **Exclusive monitoring system control** (dashboard access, settings management)
- **Exclusive backup management system access**

### Admin
- User management (limited)
- All flight operations
- No monitoring dashboard access (superadmin exclusive)
- No backup management access (superadmin exclusive)
- No audit trail access

### User
- Limited to assigned airports
- Create/edit flights for authorized locations
- View relevant flights only
- Airport-based delay notifications

### Volunteer
- View assigned flights
- Receive pickup/dropoff notifications
- Automatic delay alerts for assigned flights

## API Endpoints

### Authentication
- `POST /api/login` - User authentication
- `GET /api/users` - List users (admin+)
- `POST /api/users` - Create user (admin+)

### Flights
- `GET /api/flights` - List flights
- `POST /api/flights` - Create flight
- `PUT /api/flights/:id` - Update flight
- `DELETE /api/flights/:id` - Delete flight

### Data
- `GET /api/airlines` - List airlines
- `GET /api/airports` - List airports
- `GET /api/passengers/search` - Search passengers
- `GET /api/volunteers/search` - Search volunteers

### Flight Monitoring
- `GET /api/monitoring/status` - Get monitoring system status and statistics
- `POST /api/monitoring/check-now` - Trigger manual flight status check
- `POST /api/monitoring/interval` - Update automatic check interval (admin+)

### Audit Trail
- `GET /api/audit-logs` - List all audit logs (superadmin only)
- `GET /api/audit-logs/flight/:id` - Get flight-specific audit trail (superadmin only)

### Public
- `POST /api/flights/public` - Public flight creation form

## Configuration

### Environment Variables

```bash
NODE_ENV=production                    # Environment mode
JWT_SECRET=your-secure-secret-here     # JWT signing secret
TELEGRAM_BOT_TOKEN=your-bot-token      # Telegram bot token
FLIGHTAWARE_API_KEY=your-api-key       # FlightAware AeroAPI key
GEMINI_API_KEY=your-gemini-api-key     # Google Gemini API key (for AI ticket processing)
GOOGLE_CREDENTIALS_JSON="{...}"        # Google Cloud credentials (for OCR fallback)
PORT=3333                              # Server port (optional)
```

### Default Users

On first startup, a default super admin is created:
- **Username**: `superadmin`
- **Password**: `admin123`
- **⚠️ Change this immediately in production!**

## Security Features

- JWT token authentication with 24-hour expiration
- bcrypt password hashing
- Rate limiting (100 requests per 15 minutes)
- Security headers (XSS protection, content type sniffing prevention)
- Role-based access control
- Audit trail logging
- Input validation and sanitization

## Telegram Bot Commands

### For Passengers
```
/start - Begin registration
/register_passenger Full Name - Register as passenger
/myflights - View your flights
/flightinfo FLIGHT DATE - Get real-time flight info
/status - Check registration status
/help - Show help menu
```

### For Volunteers
```
/start - Begin registration
/register_volunteer username - Register as volunteer
/flights - View assigned flights
/flightinfo FLIGHT DATE - Get real-time flight info
/status - Check registration status
/help - Show help menu
```

### For Dashboard Users
```
/start - Begin registration
/register_user dashboard_username - Register as dashboard user
/flights - View flights for your airports
/flightinfo FLIGHT DATE - Get real-time flight info
/status - Check registration status
/help - Show help menu
```

## Data Management

### Flight Data
- Stored in `server/flights.json`
- Includes passenger lists, volunteer assignments, and notes
- Automatic backup on each change

### User Data
- Stored in `server/users.json`
- Passwords are bcrypt hashed
- Role and permission settings included

### Audit Trail
- Stored in `server/audit_log.json`
- Flight-specific change tracking accessible via dashboard
- Tracks all user actions with timestamps
- Includes IP addresses and user agents
- Superadmin-only access for security

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For technical support or deployment assistance:
1. Check the logs: `gcloud app logs tail` (GCP) or browser console
2. Verify environment variables are set correctly
3. Ensure all dependencies are installed
4. Review the troubleshooting section in DEPLOYMENT.md

## License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**Jai Swaminarayan** 🙏

*Built with ❤️ for the West Sant Transportation community*