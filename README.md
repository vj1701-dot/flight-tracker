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

### 🚨 Automated Monitoring System
- **Fully Automated Delay Detection**: Monitors all flights starting 6 hours before departure
- **Real-time Alerts**: Automatic notifications for delays over 15 minutes
- **24/7 Operation**: No manual intervention required
- **Comprehensive Coverage**: Alerts sent to passengers, volunteers, and dashboard users
- **FlightAware Integration**: Live flight data and status updates

### 👥 User Management
- Role-based access control (Super Admin, Admin, User, Volunteer)
- Airport-specific permissions for regional coordinators
- Secure authentication with JWT tokens
- Comprehensive audit trail for all user actions

### 🚗 Volunteer Coordination
- Volunteer autocomplete with phone number lookup
- Separate pickup/dropoff volunteer management
- Location-based volunteer assignment restrictions
- Automatic delay notifications for assigned flights

### 🤖 Advanced Telegram Bot Integration
- **Multi-User Support**: Passengers, volunteers, and dashboard users
- **Automatic Flight Notifications**: Flight confirmations, changes, and delays
- **Real-time Flight Info**: Live flight status and delay information
- **Smart Registration**: Role-based registration with validation
- **Comprehensive Commands**: Flight queries, status checks, and help
- **Airport-based Notifications**: Dashboard users get alerts for their airports

### 📱 Responsive Design
- Mobile-friendly interface
- Sidebar navigation
- Real-time updates
- Clean, intuitive UI

## Technology Stack

- **Frontend**: React.js with Lucide icons
- **Backend**: Node.js with Express
- **Authentication**: JWT with bcrypt
- **Database**: JSON file storage
- **Deployment**: Google Cloud App Engine
- **Bot Integration**: Telegram Bot API
- **Flight Data**: FlightAware AeroAPI
- **Monitoring**: Automated flight status tracking

## Quick Start

### Development Setup

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
│   │   ├── components/     # Reusable React components
│   │   ├── pages/         # Main application pages
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
- Monitoring system oversight

### Admin
- User management (limited)
- All flight operations
- Flight monitoring dashboard access
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

### Monitoring
- `GET /api/monitoring/status` - Get monitoring system status
- `POST /api/monitoring/check-now` - Manual flight status check
- `POST /api/monitoring/interval` - Update check interval

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