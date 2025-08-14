const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const TelegramNotificationService = require('./telegram-bot');
const TimezoneService = require('./timezone-service');
const FlightMonitorService = require('./flight-monitor-service');
const { 
  getFlightsWithResolvedNames, 
  findPassengerByName,
  readFlights,
  writeFlights,
  readUsers,
  writeUsers,
  readPassengers,
  writePassengers,
  readVolunteers,
  writeVolunteers
} = require('./data-helpers');
const { googleSheets } = require('./google-sheets-helpers');

const app = express();
const PORT = process.env.PORT || 8080;

// Environment configuration
const JWT_SECRET = process.env.JWT_SECRET || 'flight-tracker-secret-key';

// Security validation for production
if (process.env.NODE_ENV === 'production' && JWT_SECRET === 'flight-tracker-secret-key') {
  console.error('⚠️  WARNING: Using default JWT secret in production! Set JWT_SECRET environment variable.');
}

// Initialize services
const telegramBot = new TelegramNotificationService();
const timezoneService = new TimezoneService();
const flightMonitor = new FlightMonitorService();

// Trust proxy for Cloud Run (required for rate limiting)
if (process.env.NODE_ENV === 'production') {
  // For Google Cloud Run, trust the first proxy only
  app.set('trust proxy', 1);
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Audit log file (still used for local logging)
const AUDIT_LOG_FILE = path.join(__dirname, 'audit_log.json');

// Auth middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

function authorizeRole(roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

// Rate limiting for API routes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', limiter);

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
}

// Storage health check endpoint
app.get('/api/storage/health', authenticateToken, async (req, res) => {
  try {
    const isUsingGoogleSheets = process.env.GOOGLE_SHEETS_ID ? true : false;
    let healthStatus = {
      primaryStorage: isUsingGoogleSheets ? 'Google Sheets' : 'Local Files',
      status: 'unknown',
      details: {}
    };

    if (isUsingGoogleSheets) {
      // Check Google Sheets health
      const sheetsHealth = await googleSheets.healthCheck();
      healthStatus.status = sheetsHealth.status;
      healthStatus.details = {
        spreadsheetTitle: sheetsHealth.spreadsheetTitle,
        sheetCount: sheetsHealth.sheetCount,
        lastAccess: sheetsHealth.lastAccess
      };
    } else {
      // Check local storage health by reading a small amount of data
      try {
        const flights = await readFlights();
        healthStatus.status = 'healthy';
        healthStatus.details = {
          flightCount: flights.length,
          lastAccess: new Date().toISOString()
        };
      } catch (error) {
        healthStatus.status = 'error';
        healthStatus.details = { error: error.message };
      }
    }

    res.json(healthStatus);
  } catch (error) {
    res.status(500).json({ 
      status: 'error',
      details: error.message 
    });
  }
});

// All data operations now handled by data-helpers.js with Google Sheets integration

async function addOrUpdatePassenger(name, telegramChatId = null) {
  try {
    const passengers = await readPassengers();
    const existingPassenger = passengers.find(p => 
      p.name.toLowerCase() === name.toLowerCase()
    );

    if (existingPassenger) {
      if (telegramChatId && !existingPassenger.telegramChatId) {
        existingPassenger.telegramChatId = telegramChatId;
        existingPassenger.updatedAt = new Date().toISOString();
        await writePassengers(passengers);
      }
      return existingPassenger;
    } else {
      const newPassenger = {
        id: uuidv4(),
        name: name.trim(),
        telegramChatId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        flightCount: 1
      };
      passengers.push(newPassenger);
      await writePassengers(passengers);
      
      return newPassenger;
    }
  } catch (error) {
    console.error('Error managing passenger:', error);
    return null;
  }
}

async function addOrUpdateVolunteer(name, phone = null, telegramChatId = null) {
  try {
    const volunteers = await readVolunteers();
    const existingVolunteer = volunteers.find(v => 
      v.name.toLowerCase() === name.toLowerCase()
    );

    if (existingVolunteer) {
      let updated = false;
      if (phone && phone !== existingVolunteer.phone) {
        existingVolunteer.phone = phone;
        updated = true;
      }
      if (telegramChatId && !existingVolunteer.telegramChatId) {
        existingVolunteer.telegramChatId = telegramChatId;
        updated = true;
      }
      if (updated) {
        existingVolunteer.updatedAt = new Date().toISOString();
        await writeVolunteers(volunteers);
      }
      return existingVolunteer;
    } else {
      const newVolunteer = {
        id: uuidv4(),
        name: name.trim(),
        phone: phone ? phone.trim() : null,
        telegramChatId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        flightCount: 0
      };
      volunteers.push(newVolunteer);
      await writeVolunteers(volunteers);
      
      return newVolunteer;
    }
  } catch (error) {
    console.error('Error adding/updating volunteer:', error);
    return null;
  }
}

async function readAuditLog() {
  try {
    const data = await fs.readFile(AUDIT_LOG_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function writeAuditLog(logs) {
  await fs.writeFile(AUDIT_LOG_FILE, JSON.stringify(logs, null, 2));
}

async function logAuditEvent(action, entityType, entityId, userId, username, changes = null, oldData = null, newData = null) {
  try {
    const logs = await readAuditLog();
    const auditEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      action, // 'CREATE', 'UPDATE', 'DELETE'
      entityType, // 'FLIGHT', 'USER'
      entityId,
      userId,
      username,
      changes,
      oldData,
      newData,
      ipAddress: null // Could be added later if needed
    };
    
    logs.push(auditEntry);
    
    // Keep only last 10000 entries to prevent file from growing too large
    if (logs.length > 10000) {
      logs.splice(0, logs.length - 10000);
    }
    
    await writeAuditLog(logs);
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
}

function getChanges(oldObj, newObj, excludeFields = ['id', 'updatedAt']) {
  const changes = {};
  const allKeys = new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})]);
  
  for (const key of allKeys) {
    if (excludeFields.includes(key)) continue;
    
    const oldValue = oldObj?.[key];
    const newValue = newObj?.[key];
    
    // Handle array comparison
    if (Array.isArray(oldValue) && Array.isArray(newValue)) {
      if (JSON.stringify(oldValue.sort()) !== JSON.stringify(newValue.sort())) {
        changes[key] = { from: oldValue, to: newValue };
      }
    } else if (oldValue !== newValue) {
      changes[key] = { from: oldValue, to: newValue };
    }
  }
  
  return Object.keys(changes).length > 0 ? changes : null;
}

// Initialize default users
const initializeDefaultUsers = async () => {
  try {
    const users = await readUsers();
    if (users.length === 0) {
      console.log('No users found, creating default super admin...');
    }
    
    const superAdminExists = users.some(user => user.role === 'superadmin');
    if (superAdminExists) return;
    
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const superAdmin = {
      id: uuidv4(),
      username: 'superadmin',
      name: 'Super Admin',
      email: 'superadmin@flighttracker.com',
      password: hashedPassword,
      role: 'superadmin',
      allowedAirports: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await writeUsers([superAdmin]);
    console.log('Default super admin created: username=superadmin, password=admin123');
  } catch (error) {
    console.error('Error initializing default users:', error);
  }
};

const migrateFlightUserNames = async () => {
  try {
    const flights = await readFlights();
    const users = await readUsers();
    let needsUpdate = false;

    // Create a map of username to name for quick lookup
    const usernameToName = {};
    users.forEach(user => {
      usernameToName[user.username] = user.name;
    });

    const updatedFlights = flights.map(flight => {
      const updated = { ...flight };
      
      // Add createdByName if missing but createdBy exists
      if (flight.createdBy && !flight.createdByName) {
        updated.createdByName = usernameToName[flight.createdBy] || flight.createdBy;
        needsUpdate = true;
      }
      
      // Add updatedByName if missing but updatedBy exists
      if (flight.updatedBy && !flight.updatedByName) {
        updated.updatedByName = usernameToName[flight.updatedBy] || flight.updatedBy;
        needsUpdate = true;
      }
      
      return updated;
    });

    if (needsUpdate) {
      await writeFlights(updatedFlights);
    }
  } catch (error) {
    console.error('Error during flight user names migration:', error);
  }
};

function validateFlight(flight) {
  const required = ['airline', 'flightNumber', 'from', 'to', 'departureDateTime', 'arrivalDateTime'];
  for (const field of required) {
    if (!flight[field]) {
      return `${field} is required`;
    }
  }
  return null;
}

// Telegram webhook endpoint (must be before rate limiting)
app.post('/telegram/webhook', (req, res) => {
  console.log('Webhook endpoint called');
  try {
    telegramBot.processWebhookUpdate(req, res);
  } catch (error) {
    console.error('Webhook endpoint error:', error);
    res.status(500).json({ error: 'Webhook processing failed', details: error.message });
  }
});

// Set up webhook in production
if (process.env.NODE_ENV === 'production') {
  if (telegramBot && telegramBot.getBot()) {
    if (process.env.WEBHOOK_URL) {
      const webhookUrl = `${process.env.WEBHOOK_URL}/telegram/webhook`;
      telegramBot.getBot().setWebhook(webhookUrl).then(success => {
        if (success) {
          console.log('✅ Telegram webhook configured for production');
        } else {
          console.error('❌ Failed to configure Telegram webhook');
        }
      }).catch(error => {
        console.error('❌ Error setting up Telegram webhook:', error.message);
      });
    } else {
      console.log('⚠️ WEBHOOK_URL environment variable not set - Telegram webhook setup skipped');
    }
  } else {
    console.log('⚠️ Telegram bot not configured - webhook setup skipped');
  }
}

// Authentication endpoints
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const users = await readUsers();
    const user = users.find(u => u.username === username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, name: user.name, role: user.role, allowedAirports: user.allowedAirports },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        allowedAirports: user.allowedAirports
      }
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Data endpoints
app.get('/api/airlines', async (req, res) => {
  try {
    const airlines = JSON.parse(await fs.readFile(path.join(__dirname, 'data/airlines.json'), 'utf8'));
    res.json(airlines);
  } catch (error) {
    console.error('Error reading airlines:', error);
    res.status(500).json({ error: 'Failed to read airlines' });
  }
});

app.get('/api/airports', async (req, res) => {
  try {
    const airports = JSON.parse(await fs.readFile(path.join(__dirname, 'data/airports.json'), 'utf8'));
    res.json(airports);
  } catch (error) {
    console.error('Error reading airports:', error);
    res.status(500).json({ error: 'Failed to read airports' });
  }
});

// User Management endpoints
app.get('/api/users', authenticateToken, authorizeRole(['superadmin', 'admin']), async (req, res) => {
  try {
    const users = await readUsers();
    // Remove password from response for security
    const safeUsers = users.map(user => {
      const { password, ...safeUser } = user;
      return safeUser;
    });
    res.json(safeUsers);
  } catch (error) {
    console.error('Error reading users:', error);
    res.status(500).json({ error: 'Failed to read users' });
  }
});

app.post('/api/register', authenticateToken, authorizeRole(['superadmin', 'admin']), async (req, res) => {
  try {
    const { username, name, email, password, role, allowedAirports, telegramChatId } = req.body;

    if (!username || !name || !password) {
      return res.status(400).json({ error: 'Username, name, and password are required' });
    }

    const users = await readUsers();
    
    // Check if username already exists
    if (users.some(u => u.username === username)) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = {
      id: uuidv4(),
      username: username.trim(),
      name: name.trim(),
      email: email ? email.trim() : null,
      password: hashedPassword,
      role: role || 'user',
      allowedAirports: allowedAirports || [],
      telegramChatId: telegramChatId || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    users.push(newUser);
    await writeUsers(users);

    // Log audit event
    await logAuditEvent('CREATE', 'USER', newUser.id, req.user.id, req.user.username, null, null, { username, name, role });

    // Return user without password
    const { password: _, ...safeUser } = newUser;
    res.status(201).json({ user: safeUser, message: 'User created successfully' });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.put('/api/users/:id', authenticateToken, authorizeRole(['superadmin', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { username, name, email, password, role, allowedAirports, telegramChatId } = req.body;

    if (!username || !name) {
      return res.status(400).json({ error: 'Username and name are required' });
    }

    const users = await readUsers();
    const userIndex = users.findIndex(u => u.id === id);
    
    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found' });
    }

    const oldUser = { ...users[userIndex] };
    
    // Check if username is taken by another user
    if (users.some(u => u.username === username && u.id !== id)) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Update user data
    users[userIndex] = {
      ...users[userIndex],
      username: username.trim(),
      name: name.trim(),
      email: email ? email.trim() : users[userIndex].email,
      role: role || users[userIndex].role,
      allowedAirports: allowedAirports || [],
      telegramChatId: telegramChatId !== undefined ? telegramChatId : users[userIndex].telegramChatId,
      updatedAt: new Date().toISOString()
    };

    // Hash new password if provided
    if (password && password.trim()) {
      users[userIndex].password = await bcrypt.hash(password.trim(), 10);
    }

    await writeUsers(users);

    // Log audit event
    const changes = getChanges(oldUser, users[userIndex]);
    await logAuditEvent('UPDATE', 'USER', id, req.user.id, req.user.username, changes, oldUser, users[userIndex]);

    // Return user without password
    const { password: _, ...safeUser } = users[userIndex];
    res.json({ user: safeUser, message: 'User updated successfully' });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

app.delete('/api/users/:id', authenticateToken, authorizeRole(['superadmin']), async (req, res) => {
  try {
    const { id } = req.params;

    if (id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const users = await readUsers();
    const userIndex = users.findIndex(u => u.id === id);
    
    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found' });
    }

    const deletedUser = users[userIndex];
    users.splice(userIndex, 1);
    await writeUsers(users);

    // Log audit event
    await logAuditEvent('DELETE', 'USER', id, req.user.id, req.user.username, null, deletedUser, null);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Data Management endpoints
app.get('/api/passengers', authenticateToken, authorizeRole(['superadmin', 'admin']), async (req, res) => {
  try {
    const passengers = await readPassengers();
    res.json(passengers);
  } catch (error) {
    console.error('Error reading passengers:', error);
    res.status(500).json({ error: 'Failed to read passengers' });
  }
});

app.get('/api/volunteers', authenticateToken, authorizeRole(['superadmin', 'admin']), async (req, res) => {
  try {
    const volunteers = await readVolunteers();
    res.json(volunteers);
  } catch (error) {
    console.error('Error reading volunteers:', error);
    res.status(500).json({ error: 'Failed to read volunteers' });
  }
});

// Data Management CRUD endpoints (for DataManagement.jsx)
app.get('/api/data-management/passengers', authenticateToken, authorizeRole(['superadmin']), async (req, res) => {
  try {
    const passengers = await readPassengers();
    res.json(passengers);
  } catch (error) {
    console.error('Error reading passengers:', error);
    res.status(500).json({ error: 'Failed to read passengers' });
  }
});

app.post('/api/data-management/passengers', authenticateToken, authorizeRole(['superadmin']), async (req, res) => {
  try {
    const passengers = await readPassengers();
    const newPassenger = {
      ...req.body,
      id: req.body.id || uuidv4(),
      createdAt: req.body.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    passengers.push(newPassenger);
    await writePassengers(passengers);
    
    res.json(newPassenger);
  } catch (error) {
    console.error('Error creating passenger:', error);
    res.status(500).json({ error: 'Failed to create passenger' });
  }
});

app.put('/api/data-management/passengers/:id', authenticateToken, authorizeRole(['superadmin']), async (req, res) => {
  try {
    const passengers = await readPassengers();
    const passengerIndex = passengers.findIndex(p => p.id === req.params.id);
    
    if (passengerIndex === -1) {
      return res.status(404).json({ error: 'Passenger not found' });
    }
    
    const updatedPassenger = {
      ...passengers[passengerIndex],
      ...req.body,
      updatedAt: new Date().toISOString()
    };
    
    passengers[passengerIndex] = updatedPassenger;
    await writePassengers(passengers);
    
    res.json(updatedPassenger);
  } catch (error) {
    console.error('Error updating passenger:', error);
    res.status(500).json({ error: 'Failed to update passenger' });
  }
});

app.delete('/api/data-management/passengers/:id', authenticateToken, authorizeRole(['superadmin']), async (req, res) => {
  try {
    const passengers = await readPassengers();
    const passengerIndex = passengers.findIndex(p => p.id === req.params.id);
    
    if (passengerIndex === -1) {
      return res.status(404).json({ error: 'Passenger not found' });
    }
    
    passengers.splice(passengerIndex, 1);
    await writePassengers(passengers);
    
    res.json({ message: 'Passenger deleted successfully' });
  } catch (error) {
    console.error('Error deleting passenger:', error);
    res.status(500).json({ error: 'Failed to delete passenger' });
  }
});

app.get('/api/data-management/users', authenticateToken, authorizeRole(['superadmin']), async (req, res) => {
  try {
    const users = await readUsers();
    // Remove password from response for security
    const safeUsers = users.map(user => {
      const { password, ...safeUser } = user;
      return safeUser;
    });
    res.json(safeUsers);
  } catch (error) {
    console.error('Error reading users:', error);
    res.status(500).json({ error: 'Failed to read users' });
  }
});

app.get('/api/data-management/volunteers', authenticateToken, authorizeRole(['superadmin']), async (req, res) => {
  try {
    const volunteers = await readVolunteers();
    res.json(volunteers);
  } catch (error) {
    console.error('Error reading volunteers:', error);
    res.status(500).json({ error: 'Failed to read volunteers' });
  }
});

app.post('/api/data-management/volunteers', authenticateToken, authorizeRole(['superadmin']), async (req, res) => {
  try {
    const volunteers = await readVolunteers();
    const newVolunteer = {
      ...req.body,
      id: req.body.id || uuidv4(),
      createdAt: req.body.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    volunteers.push(newVolunteer);
    await writeVolunteers(volunteers);
    
    res.json(newVolunteer);
  } catch (error) {
    console.error('Error creating volunteer:', error);
    res.status(500).json({ error: 'Failed to create volunteer' });
  }
});

app.put('/api/data-management/volunteers/:id', authenticateToken, authorizeRole(['superadmin']), async (req, res) => {
  try {
    const volunteers = await readVolunteers();
    const volunteerIndex = volunteers.findIndex(v => v.id === req.params.id);
    
    if (volunteerIndex === -1) {
      return res.status(404).json({ error: 'Volunteer not found' });
    }
    
    const updatedVolunteer = {
      ...volunteers[volunteerIndex],
      ...req.body,
      updatedAt: new Date().toISOString()
    };
    
    volunteers[volunteerIndex] = updatedVolunteer;
    await writeVolunteers(volunteers);
    
    res.json(updatedVolunteer);
  } catch (error) {
    console.error('Error updating volunteer:', error);
    res.status(500).json({ error: 'Failed to update volunteer' });
  }
});

app.delete('/api/data-management/volunteers/:id', authenticateToken, authorizeRole(['superadmin']), async (req, res) => {
  try {
    const volunteers = await readVolunteers();
    const volunteerIndex = volunteers.findIndex(v => v.id === req.params.id);
    
    if (volunteerIndex === -1) {
      return res.status(404).json({ error: 'Volunteer not found' });
    }
    
    volunteers.splice(volunteerIndex, 1);
    await writeVolunteers(volunteers);
    
    res.json({ message: 'Volunteer deleted successfully' });
  } catch (error) {
    console.error('Error deleting volunteer:', error);
    res.status(500).json({ error: 'Failed to delete volunteer' });
  }
});

// Flights endpoint
app.get('/api/flights', authenticateToken, async (req, res) => {
  try {
    const flights = await getFlightsWithResolvedNames();
    let filteredFlights = flights;

    // Filter flights based on user's allowed airports
    if (req.user.role === 'user' && req.user.allowedAirports.length > 0) {
      filteredFlights = flights.filter(flight => 
        req.user.allowedAirports.includes(flight.from) || 
        req.user.allowedAirports.includes(flight.to)
      );
    }

    // Convert flight times to airport timezones and filter user info
    filteredFlights = filteredFlights.map(flight => {
      // Convert flight times to airport timezones
      const convertedFlight = timezoneService.convertFlightTimes(flight);
      
      if (req.user.role === 'superadmin') {
        // Super admins see all user info including usernames and IDs
        return convertedFlight;
      } else {
        // Other users see only names, not usernames/IDs
        const { createdBy, createdByUserId, updatedBy, updatedByUserId, ...flightWithoutSensitiveInfo } = convertedFlight;
        return flightWithoutSensitiveInfo;
      }
    });

    res.json(filteredFlights);
  } catch (error) {
    console.error('Error reading flights:', error);
    res.status(500).json({ error: 'Failed to read flights' });
  }
});

// Catchall route for SPA - serve index.html for non-API routes
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  await initializeDefaultUsers();
  await migrateFlightUserNames();

  // Start automated flight delay monitoring
  console.log('🚨 Starting automated flight delay monitoring...');
  flightMonitor.startMonitoring();
});