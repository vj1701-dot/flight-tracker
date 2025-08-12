const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const TelegramNotificationService = require('./telegram-bot');
const BackupService = require('./backup-service');
const TimezoneService = require('./timezone-service');
const FlightMonitorService = require('./flight-monitor-service');

const app = express();
const PORT = process.env.PORT || 8080;
const FLIGHTS_FILE = path.join(__dirname, 'flights.json');
const USERS_FILE = path.join(__dirname, 'users.json');
const PASSENGERS_FILE = path.join(__dirname, 'passengers.json');
const VOLUNTEERS_FILE = path.join(__dirname, 'volunteers.json');
const AUDIT_LOG_FILE = path.join(__dirname, 'audit_log.json');
const JWT_SECRET = process.env.JWT_SECRET || 'flight-tracker-secret-key';

// Security validation for production
if (process.env.NODE_ENV === 'production' && JWT_SECRET === 'flight-tracker-secret-key') {
  console.error('⚠️  WARNING: Using default JWT secret in production! Set JWT_SECRET environment variable.');
}

// Initialize services
const telegramBot = new TelegramNotificationService();
const backupService = new BackupService();
const timezoneService = new TimezoneService();
const flightMonitor = new FlightMonitorService();

// Trust proxy for Cloud Run (required for rate limiting)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', true);
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

const limiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 2000,
  message: 'Too many requests from this IP',
  trustProxy: true, // Trust Cloud Run proxy headers
  keyGenerator: (req) => {
    // Use X-Forwarded-For header or fallback to connection IP
    return req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip;
  }
});
app.use('/api', limiter);

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
}

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
    
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      changes[key] = {
        from: oldValue,
        to: newValue
      };
    }
  }
  
  return Object.keys(changes).length > 0 ? changes : null;
}

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    console.log('Authentication failed: No token provided');
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.log('JWT verification failed:', err.message);
      console.log('Token (first 20 chars):', token.substring(0, 20) + '...');
      console.log('JWT_SECRET (first 10 chars):', JWT_SECRET.substring(0, 10) + '...');
      return res.status(403).json({ error: 'Invalid token' });
    }
    console.log('Authentication successful for user:', user.username, 'role:', user.role);
    req.user = user;
    next();
  });
};

const authorizeRole = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

const initializeDefaultUsers = async () => {
  const users = await readUsers();
  if (users.length === 0) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const superAdmin = {
      id: uuidv4(),
      username: 'superadmin',
      name: 'Super Admin',
      email: 'superadmin@flighttracker.com',
      password: hashedPassword,
      role: 'superadmin',
      allowedAirports: [], // Empty means all airports
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await writeUsers([superAdmin]);
    console.log('Default super admin created: username=superadmin, password=admin123');
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
      // Flight user names migration completed
    }
  } catch (error) {
    console.error('Error during flight user names migration:', error);
  }
};

function validateFlight(flight) {
  const required = ['airline', 'flightNumber', 'from', 'to', 'departureDateTime', 'arrivalDateTime'];
  for (const field of required) {
    if (!flight[field]) {
      return `Missing required field: ${field}`;
    }
  }
  
  if (new Date(flight.departureDateTime) >= new Date(flight.arrivalDateTime)) {
    return 'Departure time must be before arrival time';
  }
  
  if (flight.passengers && Array.isArray(flight.passengers)) {
    if (flight.passengers.length === 0) {
      return 'At least one passenger is required';
    }
    
    for (const passenger of flight.passengers) {
      if (!passenger.name || typeof passenger.name !== 'string' || !passenger.name.trim()) {
        return 'All passengers must have a valid name';
      }
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
  const webhookUrl = `${process.env.WEBHOOK_URL || 'https://flight-tracker-352144879829.us-central1.run.app'}/telegram/webhook`;
  telegramBot.setupWebhook(webhookUrl).then(success => {
    if (success) {
      console.log('✅ Telegram webhook configured successfully');
    } else {
      console.error('❌ Failed to configure Telegram webhook');
    }
  });
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

app.post('/api/register', authenticateToken, authorizeRole(['superadmin', 'admin']), async (req, res) => {
  try {
    const { username, name, email, password, role, allowedAirports } = req.body;
    
    if (!username || !name || !password || !role) {
      return res.status(400).json({ error: 'All fields required' });
    }

    if (!['superadmin', 'admin', 'user'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    if (req.user.role === 'admin' && role === 'superadmin') {
      return res.status(403).json({ error: 'Admins cannot create super admins' });
    }

    const users = await readUsers();
    const existingUser = users.find(u => u.username === username);
    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      id: uuidv4(),
      username,
      name,
      email,
      password: hashedPassword,
      role,
      allowedAirports: allowedAirports || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    users.push(newUser);
    await writeUsers(users);

    // Log audit event for user creation
    await logAuditEvent(
      'CREATE',
      'USER',
      newUser.id,
      req.user.id,
      req.user.username,
      null,
      null,
      {
        id: newUser.id,
        username: newUser.username,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        allowedAirports: newUser.allowedAirports
      }
    );

    res.status(201).json({
      user: {
        id: newUser.id,
        username: newUser.username,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        allowedAirports: newUser.allowedAirports
      }
    });
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.get('/api/users', authenticateToken, authorizeRole(['superadmin', 'admin']), async (req, res) => {
  try {
    const users = await readUsers();
    const userList = users.map(user => ({
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      allowedAirports: user.allowedAirports,
      createdAt: user.createdAt
    }));
    res.json(userList);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.put('/api/users/:id', authenticateToken, authorizeRole(['superadmin', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { username, name, email, role, allowedAirports } = req.body;
    
    if (!username || !name || !role) {
      return res.status(400).json({ error: 'Username, name, and role are required' });
    }

    if (!['superadmin', 'admin', 'user'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    if (req.user.role === 'admin' && role === 'superadmin') {
      return res.status(403).json({ error: 'Admins cannot promote users to super admin' });
    }

    const users = await readUsers();
    const userIndex = users.findIndex(u => u.id === id);
    
    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found' });
    }

    const oldUser = { ...users[userIndex] };
    
    // Prevent admins from updating super admins
    if (req.user.role === 'admin' && oldUser.role === 'superadmin') {
      return res.status(403).json({ error: 'Admins cannot modify super admin accounts' });
    }
    
    // Check if username already exists for other users
    const existingUser = users.find(u => u.id !== id && u.username === username);
    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const updatedUser = {
      ...users[userIndex],
      username,
      name,
      email,
      role,
      allowedAirports: allowedAirports || [],
      updatedAt: new Date().toISOString()
    };

    users[userIndex] = updatedUser;
    await writeUsers(users);

    // Log audit event with changes
    const changes = getChanges(
      { username: oldUser.username, name: oldUser.name, email: oldUser.email, role: oldUser.role, allowedAirports: oldUser.allowedAirports },
      { username, name, email, role, allowedAirports: allowedAirports || [] }
    );
    
    await logAuditEvent(
      'UPDATE',
      'USER',
      id,
      req.user.id,
      req.user.username,
      changes,
      {
        id: oldUser.id,
        username: oldUser.username,
        name: oldUser.name,
        email: oldUser.email,
        role: oldUser.role,
        allowedAirports: oldUser.allowedAirports
      },
      {
        id: updatedUser.id,
        username: updatedUser.username,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        allowedAirports: updatedUser.allowedAirports
      }
    );

    res.json({
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        allowedAirports: updatedUser.allowedAirports
      }
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

app.delete('/api/users/:id', authenticateToken, authorizeRole(['superadmin', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Prevent deletion of own account
    if (req.user.id === id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const users = await readUsers();
    const userIndex = users.findIndex(u => u.id === id);
    
    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found' });
    }

    const deletedUser = users[userIndex];
    
    // Prevent admins from deleting super admins
    if (req.user.role === 'admin' && deletedUser.role === 'superadmin') {
      return res.status(403).json({ error: 'Admins cannot delete super admins' });
    }

    users.splice(userIndex, 1);
    await writeUsers(users);

    // Log audit event
    await logAuditEvent(
      'DELETE',
      'USER',
      id,
      req.user.id,
      req.user.username,
      null,
      {
        id: deletedUser.id,
        username: deletedUser.username,
        name: deletedUser.name,
        email: deletedUser.email,
        role: deletedUser.role,
        allowedAirports: deletedUser.allowedAirports
      },
      null
    );

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Passengers endpoints
app.get('/api/passengers', authenticateToken, async (req, res) => {
  try {
    const passengers = await readPassengers();
    // Sort by flight count and name for better suggestions
    const sortedPassengers = passengers.sort((a, b) => {
      if (b.flightCount !== a.flightCount) {
        return b.flightCount - a.flightCount;
      }
      return a.name.localeCompare(b.name);
    });
    res.json(sortedPassengers);
  } catch (error) {
    console.error('Error reading passengers:', error);
    res.status(500).json({ error: 'Failed to read passengers' });
  }
});

app.get('/api/passengers/search', authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.json([]);
    }

    const passengers = await readPassengers();
    const filtered = passengers
      .filter(p => p.name.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => {
        // Prioritize exact matches and higher flight counts
        const aStartsWith = a.name.toLowerCase().startsWith(q.toLowerCase());
        const bStartsWith = b.name.toLowerCase().startsWith(q.toLowerCase());
        
        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;
        
        return b.flightCount - a.flightCount;
      })
      .slice(0, 10); // Limit to 10 suggestions

    res.json(filtered);
  } catch (error) {
    console.error('Error searching passengers:', error);
    res.status(500).json({ error: 'Failed to search passengers' });
  }
});

app.get('/api/volunteers/search', authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.json([]);
    }

    const volunteers = await readVolunteers();
    const filtered = volunteers
      .filter(v => v.name.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => {
        // Prioritize exact matches and higher flight counts
        const aStartsWith = a.name.toLowerCase().startsWith(q.toLowerCase());
        const bStartsWith = b.name.toLowerCase().startsWith(q.toLowerCase());
        
        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;
        
        return b.flightCount - a.flightCount;
      })
      .slice(0, 10); // Limit to 10 suggestions

    res.json(filtered);
  } catch (error) {
    console.error('Error searching volunteers:', error);
    res.status(500).json({ error: 'Failed to search volunteers' });
  }
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

// Data Management Endpoints (Superadmin only)

// Passengers endpoints
app.get('/api/data-management/passengers', authenticateToken, authorizeRole(['superadmin']), async (req, res) => {
  try {
    const passengers = JSON.parse(await fs.readFile(PASSENGERS_FILE, 'utf8'));
    res.json(passengers);
  } catch (error) {
    console.error('Error reading passengers:', error);
    res.status(500).json({ error: 'Failed to read passengers' });
  }
});

app.post('/api/data-management/passengers', authenticateToken, authorizeRole(['superadmin']), async (req, res) => {
  try {
    const passengers = JSON.parse(await fs.readFile(PASSENGERS_FILE, 'utf8'));
    const newPassenger = {
      id: uuidv4(),
      ...req.body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      flightCount: 0
    };
    
    passengers.push(newPassenger);
    await fs.writeFile(PASSENGERS_FILE, JSON.stringify(passengers, null, 2));
    
    // Log the action
    await logAuditEvent('CREATE', 'PASSENGER', newPassenger.id, req.user.id, req.user.username, null, null, { passengerId: newPassenger.id, name: newPassenger.name });
    
    res.status(201).json(newPassenger);
  } catch (error) {
    console.error('Error creating passenger:', error);
    res.status(500).json({ error: 'Failed to create passenger' });
  }
});

app.put('/api/data-management/passengers/:id', authenticateToken, authorizeRole(['superadmin']), async (req, res) => {
  try {
    const passengers = JSON.parse(await fs.readFile(PASSENGERS_FILE, 'utf8'));
    const passengerIndex = passengers.findIndex(p => p.id === req.params.id);
    
    if (passengerIndex === -1) {
      return res.status(404).json({ error: 'Passenger not found' });
    }
    
    passengers[passengerIndex] = {
      ...passengers[passengerIndex],
      ...req.body,
      updatedAt: new Date().toISOString()
    };
    
    await fs.writeFile(PASSENGERS_FILE, JSON.stringify(passengers, null, 2));
    
    // Log the action
    await logAuditEvent('UPDATE', 'PASSENGER', req.params.id, req.user.id, req.user.username, null, null, { passengerId: req.params.id, name: passengers[passengerIndex].name });
    
    res.json(passengers[passengerIndex]);
  } catch (error) {
    console.error('Error updating passenger:', error);
    res.status(500).json({ error: 'Failed to update passenger' });
  }
});

app.delete('/api/data-management/passengers/:id', authenticateToken, authorizeRole(['superadmin']), async (req, res) => {
  try {
    const passengers = JSON.parse(await fs.readFile(PASSENGERS_FILE, 'utf8'));
    const passengerIndex = passengers.findIndex(p => p.id === req.params.id);
    
    if (passengerIndex === -1) {
      return res.status(404).json({ error: 'Passenger not found' });
    }
    
    const deletedPassenger = passengers[passengerIndex];
    passengers.splice(passengerIndex, 1);
    
    await fs.writeFile(PASSENGERS_FILE, JSON.stringify(passengers, null, 2));
    
    // Log the action
    await logAuditEvent('DELETE', 'PASSENGER', req.params.id, req.user.id, req.user.username, null, null, { passengerId: req.params.id, name: deletedPassenger.name });
    
    res.json({ message: 'Passenger deleted successfully' });
  } catch (error) {
    console.error('Error deleting passenger:', error);
    res.status(500).json({ error: 'Failed to delete passenger' });
  }
});

// Users endpoints
app.get('/api/data-management/users', authenticateToken, authorizeRole(['superadmin']), async (req, res) => {
  try {
    const users = JSON.parse(await fs.readFile(USERS_FILE, 'utf8'));
    // Remove password hashes from response
    const safeUsers = users.map(({ password, ...user }) => user);
    res.json(safeUsers);
  } catch (error) {
    console.error('Error reading users:', error);
    res.status(500).json({ error: 'Failed to read users' });
  }
});

app.post('/api/data-management/users', authenticateToken, authorizeRole(['superadmin']), async (req, res) => {
  try {
    const users = JSON.parse(await fs.readFile(USERS_FILE, 'utf8'));
    
    // Check if username already exists
    if (users.some(u => u.username === req.body.username)) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    const newUser = {
      id: uuidv4(),
      ...req.body,
      password: await bcrypt.hash('password123', 10), // Default password
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      allowedAirports: req.body.allowedAirports || []
    };
    
    users.push(newUser);
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
    
    // Log the action
    await logAuditEvent('CREATE', 'USER', newUser.id, req.user.id, req.user.username, null, null, { userId: newUser.id, username: newUser.username });
    
    // Remove password hash from response
    const { password, ...safeUser } = newUser;
    res.status(201).json(safeUser);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.put('/api/data-management/users/:id', authenticateToken, authorizeRole(['superadmin']), async (req, res) => {
  try {
    const users = JSON.parse(await fs.readFile(USERS_FILE, 'utf8'));
    const userIndex = users.findIndex(u => u.id === req.params.id);
    
    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if username is being changed and if it conflicts
    if (req.body.username && req.body.username !== users[userIndex].username) {
      if (users.some(u => u.username === req.body.username && u.id !== req.params.id)) {
        return res.status(400).json({ error: 'Username already exists' });
      }
    }
    
    users[userIndex] = {
      ...users[userIndex],
      ...req.body,
      updatedAt: new Date().toISOString()
    };
    
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
    
    // Log the action
    await logAuditEvent('UPDATE', 'USER', req.params.id, req.user.id, req.user.username, null, null, { userId: req.params.id, username: users[userIndex].username });
    
    // Remove password hash from response
    const { password, ...safeUser } = users[userIndex];
    res.json(safeUser);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

app.delete('/api/data-management/users/:id', authenticateToken, authorizeRole(['superadmin']), async (req, res) => {
  try {
    const users = JSON.parse(await fs.readFile(USERS_FILE, 'utf8'));
    const userIndex = users.findIndex(u => u.id === req.params.id);
    
    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Prevent deletion of the last superadmin
    if (users[userIndex].role === 'superadmin') {
      const superadminCount = users.filter(u => u.role === 'superadmin').length;
      if (superadminCount <= 1) {
        return res.status(400).json({ error: 'Cannot delete the last superadmin user' });
      }
    }
    
    const deletedUser = users[userIndex];
    users.splice(userIndex, 1);
    
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
    
    // Log the action
    await logAuditEvent('DELETE', 'USER', req.params.id, req.user.id, req.user.username, null, null, { userId: req.params.id, username: deletedUser.username });
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Volunteers endpoints
app.get('/api/data-management/volunteers', authenticateToken, authorizeRole(['superadmin']), async (req, res) => {
  try {
    const volunteers = JSON.parse(await fs.readFile(VOLUNTEERS_FILE, 'utf8'));
    res.json(volunteers);
  } catch (error) {
    console.error('Error reading volunteers:', error);
    res.status(500).json({ error: 'Failed to read volunteers' });
  }
});

app.post('/api/data-management/volunteers', authenticateToken, authorizeRole(['superadmin']), async (req, res) => {
  try {
    const volunteers = JSON.parse(await fs.readFile(VOLUNTEERS_FILE, 'utf8'));
    
    // Check if username already exists
    if (volunteers.some(v => v.username === req.body.username)) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    const newVolunteer = {
      id: uuidv4(),
      ...req.body,
      role: 'volunteer',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      allowedAirports: req.body.allowedAirports || []
    };
    
    volunteers.push(newVolunteer);
    await fs.writeFile(VOLUNTEERS_FILE, JSON.stringify(volunteers, null, 2));
    
    // Log the action
    await logAuditEvent('CREATE', 'VOLUNTEER', newVolunteer.id, req.user.id, req.user.username, null, null, { volunteerId: newVolunteer.id, username: newVolunteer.username });
    
    res.status(201).json(newVolunteer);
  } catch (error) {
    console.error('Error creating volunteer:', error);
    res.status(500).json({ error: 'Failed to create volunteer' });
  }
});

app.put('/api/data-management/volunteers/:id', authenticateToken, authorizeRole(['superadmin']), async (req, res) => {
  try {
    const volunteers = JSON.parse(await fs.readFile(VOLUNTEERS_FILE, 'utf8'));
    const volunteerIndex = volunteers.findIndex(v => v.id === req.params.id);
    
    if (volunteerIndex === -1) {
      return res.status(404).json({ error: 'Volunteer not found' });
    }
    
    // Check if username is being changed and if it conflicts
    if (req.body.username && req.body.username !== volunteers[volunteerIndex].username) {
      if (volunteers.some(v => v.username === req.body.username && v.id !== req.params.id)) {
        return res.status(400).json({ error: 'Username already exists' });
      }
    }
    
    volunteers[volunteerIndex] = {
      ...volunteers[volunteerIndex],
      ...req.body,
      updatedAt: new Date().toISOString()
    };
    
    await fs.writeFile(VOLUNTEERS_FILE, JSON.stringify(volunteers, null, 2));
    
    // Log the action
    await logAuditEvent('UPDATE', 'VOLUNTEER', req.params.id, req.user.id, req.user.username, null, null, { volunteerId: req.params.id, username: volunteers[volunteerIndex].username });
    
    res.json(volunteers[volunteerIndex]);
  } catch (error) {
    console.error('Error updating volunteer:', error);
    res.status(500).json({ error: 'Failed to update volunteer' });
  }
});

app.delete('/api/data-management/volunteers/:id', authenticateToken, authorizeRole(['superadmin']), async (req, res) => {
  try {
    const volunteers = JSON.parse(await fs.readFile(VOLUNTEERS_FILE, 'utf8'));
    const volunteerIndex = volunteers.findIndex(v => v.id === req.params.id);
    
    if (volunteerIndex === -1) {
      return res.status(404).json({ error: 'Volunteer not found' });
    }
    
    const deletedVolunteer = volunteers[volunteerIndex];
    volunteers.splice(volunteerIndex, 1);
    
    await fs.writeFile(VOLUNTEERS_FILE, JSON.stringify(volunteers, null, 2));
    
    // Log the action
    await logAuditEvent('DELETE', 'VOLUNTEER', req.params.id, req.user.id, req.user.username, null, null, { volunteerId: req.params.id, username: deletedVolunteer.username });
    
    res.json({ message: 'Volunteer deleted successfully' });
  } catch (error) {
    console.error('Error deleting volunteer:', error);
    res.status(500).json({ error: 'Failed to delete volunteer' });
  }
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/api/flights', authenticateToken, async (req, res) => {
  try {
    const flights = await readFlights();
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

app.post('/api/flights', authenticateToken, async (req, res) => {
  try {
    // Map new volunteer field names to legacy sevak field names for backward compatibility
    const flightData = { ...req.body };
    if (flightData.dropoffVolunteerName) {
      flightData.dropoffSevakName = flightData.dropoffVolunteerName;
      delete flightData.dropoffVolunteerName;
    }
    if (flightData.dropoffVolunteerPhone) {
      flightData.dropoffSevakPhone = flightData.dropoffVolunteerPhone;
      delete flightData.dropoffVolunteerPhone;
    }
    if (flightData.pickupVolunteerName) {
      flightData.pickupSevakName = flightData.pickupVolunteerName;
      delete flightData.pickupVolunteerName;
    }
    if (flightData.pickupVolunteerPhone) {
      flightData.pickupSevakPhone = flightData.pickupVolunteerPhone;
      delete flightData.pickupVolunteerPhone;
    }

    const validationError = validateFlight(flightData);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const flights = await readFlights();
    
    // Check for duplicate flights (same flight number, from, to, and departure date)
    const existingFlight = flights.find(f => 
      f.flightNumber === flightData.flightNumber &&
      f.from === flightData.from &&
      f.to === flightData.to &&
      new Date(f.departureDateTime).toDateString() === new Date(flightData.departureDateTime).toDateString()
    );
    
    if (existingFlight) {
      return res.status(409).json({ 
        error: 'A flight with the same flight number, route, and departure date already exists',
        existingFlight: existingFlight
      });
    }

    const flight = {
      id: uuidv4(),
      ...flightData,
      createdBy: req.user.username,
      createdByName: req.user.name,
      createdByUserId: req.user.id,
      updatedBy: req.user.username,
      updatedByName: req.user.name,
      updatedByUserId: req.user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    flights.push(flight);
    await writeFlights(flights);

    // Add passengers to passenger database
    if (flight.passengers && Array.isArray(flight.passengers)) {
      for (const passenger of flight.passengers) {
        if (passenger.name && passenger.name.trim()) {
          await addOrUpdatePassenger(passenger.name.trim());
        }
      }
    }

    // Add volunteers to volunteer database
    if (flight.dropoffSevakName && flight.dropoffSevakName.trim()) {
      await addOrUpdateVolunteer(
        flight.dropoffSevakName.trim(), 
        flight.dropoffSevakPhone ? flight.dropoffSevakPhone.trim() : null
      );
    }
    if (flight.pickupSevakName && flight.pickupSevakName.trim()) {
      await addOrUpdateVolunteer(
        flight.pickupSevakName.trim(), 
        flight.pickupSevakPhone ? flight.pickupSevakPhone.trim() : null
      );
    }

    // Send Telegram notifications to passengers
    if (telegramBot && flight.passengers) {
      for (const passenger of flight.passengers) {
        if (passenger.name) {
          const passengerInfo = await addOrUpdatePassenger(passenger.name.trim());
          if (passengerInfo && passengerInfo.telegramChatId) {
            await telegramBot.sendFlightConfirmation(flight, passenger.name);
          }
        }
      }
    }

    // Send flight addition notification
    try {
      await telegramBot.sendFlightAddedNotification(flight);
    } catch (error) {
      console.error('Error sending flight addition notification:', error);
    }

    // Log audit event
    await logAuditEvent(
      'CREATE',
      'FLIGHT',
      flight.id,
      req.user.id,
      req.user.username,
      null,
      null,
      flight
    );

    // Return appropriate user tracking information based on role
    let responseData = flight;
    if (req.user.role !== 'superadmin') {
      const { createdBy, createdByUserId, updatedBy, updatedByUserId, ...flightWithoutSensitiveInfo } = flight;
      responseData = flightWithoutSensitiveInfo;
    }

    res.status(201).json(responseData);
  } catch (error) {
    console.error('Error creating flight:', error);
    res.status(500).json({ error: 'Failed to create flight' });
  }
});

// Public flight creation endpoint for standalone form
app.post('/api/flights/public', async (req, res) => {
  try {
    // Map new volunteer field names to legacy sevak field names for backward compatibility
    const flightData = { ...req.body };
    if (flightData.dropoffVolunteerName) {
      flightData.dropoffSevakName = flightData.dropoffVolunteerName;
      delete flightData.dropoffVolunteerName;
    }
    if (flightData.dropoffVolunteerPhone) {
      flightData.dropoffSevakPhone = flightData.dropoffVolunteerPhone;
      delete flightData.dropoffVolunteerPhone;
    }
    if (flightData.pickupVolunteerName) {
      flightData.pickupSevakName = flightData.pickupVolunteerName;
      delete flightData.pickupVolunteerName;
    }
    if (flightData.pickupVolunteerPhone) {
      flightData.pickupSevakPhone = flightData.pickupVolunteerPhone;
      delete flightData.pickupVolunteerPhone;
    }

    const validationError = validateFlight(flightData);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const flights = await readFlights();
    
    // Check for duplicate flights (same flight number, from, to, and departure date)
    const existingFlight = flights.find(f => 
      f.flightNumber === flightData.flightNumber &&
      f.from === flightData.from &&
      f.to === flightData.to &&
      new Date(f.departureDateTime).toDateString() === new Date(flightData.departureDateTime).toDateString()
    );
    
    if (existingFlight) {
      return res.status(409).json({ 
        error: 'A flight with the same flight number, route, and departure date already exists',
        existingFlight: existingFlight
      });
    }

    const flight = {
      id: uuidv4(),
      ...flightData,
      createdBy: 'public-form',
      createdByName: 'Public Form',
      createdByUserId: null,
      updatedBy: 'public-form', 
      updatedByName: 'Public Form',
      updatedByUserId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    flights.push(flight);
    await writeFlights(flights);

    // Add passengers to passenger database
    if (flight.passengers && Array.isArray(flight.passengers)) {
      for (const passenger of flight.passengers) {
        if (passenger.name && passenger.name.trim()) {
          await addOrUpdatePassenger(passenger.name.trim());
        }
      }
    }

    // Add volunteers to volunteer database
    if (flight.dropoffSevakName && flight.dropoffSevakName.trim()) {
      await addOrUpdateVolunteer(
        flight.dropoffSevakName.trim(), 
        flight.dropoffSevakPhone ? flight.dropoffSevakPhone.trim() : null
      );
    }
    if (flight.pickupSevakName && flight.pickupSevakName.trim()) {
      await addOrUpdateVolunteer(
        flight.pickupSevakName.trim(), 
        flight.pickupSevakPhone ? flight.pickupSevakPhone.trim() : null
      );
    }

    // Send Telegram notifications to passengers
    if (telegramBot && flight.passengers) {
      for (const passenger of flight.passengers) {
        if (passenger.name) {
          const passengerInfo = await addOrUpdatePassenger(passenger.name.trim());
          if (passengerInfo && passengerInfo.telegramChatId) {
            await telegramBot.sendFlightConfirmation(flight, passenger.name);
          }
        }
      }
    }

    // Log audit event (without user info since it's public)
    await logAuditEvent(
      'CREATE',
      'FLIGHT',
      flight.id,
      null, // No user ID for public submissions
      'public-form', // Username for public form
      null,
      null,
      flight
    );

    // Return flight with user names but without sensitive user info for public form
    const { createdBy, createdByUserId, updatedBy, updatedByUserId, ...responseData } = flight;
    res.status(201).json(responseData);
  } catch (error) {
    console.error('Error creating flight via public form:', error);
    res.status(500).json({ error: 'Failed to create flight' });
  }
});

app.put('/api/flights/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Map new volunteer field names to legacy sevak field names for backward compatibility
    const flightData = { ...req.body };
    if (flightData.dropoffVolunteerName) {
      flightData.dropoffSevakName = flightData.dropoffVolunteerName;
      delete flightData.dropoffVolunteerName;
    }
    if (flightData.dropoffVolunteerPhone) {
      flightData.dropoffSevakPhone = flightData.dropoffVolunteerPhone;
      delete flightData.dropoffVolunteerPhone;
    }
    if (flightData.pickupVolunteerName) {
      flightData.pickupSevakName = flightData.pickupVolunteerName;
      delete flightData.pickupVolunteerName;
    }
    if (flightData.pickupVolunteerPhone) {
      flightData.pickupSevakPhone = flightData.pickupVolunteerPhone;
      delete flightData.pickupVolunteerPhone;
    }

    const validationError = validateFlight(flightData);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const flights = await readFlights();
    const flightIndex = flights.findIndex(f => f.id === id);
    
    if (flightIndex === -1) {
      return res.status(404).json({ error: 'Flight not found' });
    }

    const oldFlight = { ...flights[flightIndex] };
    const updatedFlight = {
      ...flights[flightIndex],
      ...flightData,
      id,
      updatedBy: req.user.username,
      updatedByName: req.user.name,
      updatedByUserId: req.user.id,
      updatedAt: new Date().toISOString()
    };

    flights[flightIndex] = updatedFlight;
    await writeFlights(flights);

    // Send flight update notification
    try {
      await telegramBot.sendFlightUpdateNotification(updatedFlight, 'updated');
    } catch (error) {
      console.error('Error sending flight update notification:', error);
    }

    // Log audit event with changes
    const changes = getChanges(oldFlight, updatedFlight);
    await logAuditEvent(
      'UPDATE',
      'FLIGHT',
      id,
      req.user.id,
      req.user.username,
      changes,
      oldFlight,
      updatedFlight
    );

    // Return appropriate user tracking information based on role
    let responseData = updatedFlight;
    if (req.user.role !== 'superadmin') {
      const { createdBy, createdByUserId, updatedBy, updatedByUserId, ...flightWithoutSensitiveInfo } = updatedFlight;
      responseData = flightWithoutSensitiveInfo;
    }

    res.json(responseData);
  } catch (error) {
    console.error('Error updating flight:', error);
    res.status(500).json({ error: 'Failed to update flight' });
  }
});

app.delete('/api/flights/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const flights = await readFlights();
    const flightIndex = flights.findIndex(f => f.id === id);
    
    if (flightIndex === -1) {
      return res.status(404).json({ error: 'Flight not found' });
    }

    const deletedFlight = flights[flightIndex];
    flights.splice(flightIndex, 1);
    await writeFlights(flights);

    // Log audit event
    await logAuditEvent(
      'DELETE',
      'FLIGHT',
      id,
      req.user.id,
      req.user.username,
      null,
      deletedFlight,
      null
    );

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting flight:', error);
    res.status(500).json({ error: 'Failed to delete flight' });
  }
});

// Audit log endpoint for super admins only
app.get('/api/audit-logs', authenticateToken, authorizeRole(['superadmin']), async (req, res) => {
  try {
    const { limit = 100, offset = 0, entityType, action, userId } = req.query;
    let logs = await readAuditLog();
    
    // Filter logs based on query parameters
    if (entityType) {
      logs = logs.filter(log => log.entityType === entityType);
    }
    if (action) {
      logs = logs.filter(log => log.action === action);
    }
    if (userId) {
      logs = logs.filter(log => log.userId === userId);
    }
    
    // Sort by timestamp (newest first)
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Apply pagination
    const paginatedLogs = logs.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    
    res.json({
      logs: paginatedLogs,
      total: logs.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// Flight-specific audit log endpoint for super admins only
app.get('/api/audit-logs/flight/:flightId', authenticateToken, authorizeRole(['superadmin']), async (req, res) => {
  try {
    const { flightId } = req.params;
    let logs = await readAuditLog();
    
    // Filter logs for the specific flight
    logs = logs.filter(log => log.entityType === 'FLIGHT' && log.entityId === flightId);
    
    // Sort by timestamp ascending (chronological order for flight history)
    logs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    res.json({
      logs: logs,
      total: logs.length,
      flightId: flightId
    });
  } catch (error) {
    console.error('Error fetching flight audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch flight audit logs' });
  }
});

// Backup endpoints (superadmin only)
app.post('/api/backup/create', authenticateToken, authorizeRole(['superadmin']), async (req, res) => {
  try {
    const result = await backupService.createBackup(true); // Manual backup
    
    if (result.success) {
      await logAuditEvent('create', 'backup', result.backupFolder, req.user.id, req.user.username, null, null, { backupFolder: result.backupFolder });
      res.json({ message: 'Backup created successfully', backupFolder: result.backupFolder });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error('Error creating backup:', error);
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

app.get('/api/backup/list', authenticateToken, authorizeRole(['superadmin']), async (req, res) => {
  try {
    const result = await backupService.listBackups();
    
    if (result.success) {
      res.json({ backups: result.backups });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error('Error listing backups:', error);
    res.status(500).json({ error: 'Failed to list backups' });
  }
});

app.post('/api/backup/restore', authenticateToken, authorizeRole(['superadmin']), async (req, res) => {
  try {
    const { backupFolder } = req.body;
    
    if (!backupFolder) {
      return res.status(400).json({ error: 'Backup folder is required' });
    }
    
    const result = await backupService.restoreBackup(backupFolder);
    
    if (result.success) {
      await logAuditEvent('restore', 'backup', backupFolder, req.user.id, req.user.username, null, null, { backupFolder });
      res.json({ message: 'Backup restored successfully' });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error('Error restoring backup:', error);
    res.status(500).json({ error: 'Failed to restore backup' });
  }
});

app.get('/api/backup/stats', authenticateToken, authorizeRole(['superadmin']), async (req, res) => {
  try {
    const stats = await backupService.getBackupStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting backup stats:', error);
    res.status(500).json({ error: 'Failed to get backup statistics' });
  }
});

// Airport timezone information endpoint
app.get('/api/airports/timezone/:airportCode', (req, res) => {
  try {
    const { airportCode } = req.params;
    const airportInfo = timezoneService.getAirportInfo(airportCode);
    
    if (!airportInfo) {
      return res.status(404).json({ error: 'Airport not found' });
    }

    const currentTime = timezoneService.getCurrentAirportTime(airportCode);
    
    res.json({
      airport: airportInfo,
      currentTime: currentTime,
      hasTimezoneData: timezoneService.hasTimezoneData(airportCode)
    });
  } catch (error) {
    console.error('Error getting airport timezone:', error);
    res.status(500).json({ error: 'Failed to get airport timezone' });
  }
});

// Auto-populate flight data endpoint
app.get('/api/flights/auto-populate/:from/:to', (req, res) => {
  try {
    const { from, to } = req.params;
    const flightData = timezoneService.autoPopulateFlightData(from, to);
    
    if (!flightData.departure || !flightData.arrival) {
      return res.status(404).json({ 
        error: 'One or both airports not found',
        found: {
          departure: !!flightData.departure,
          arrival: !!flightData.arrival
        }
      });
    }

    res.json(flightData);
  } catch (error) {
    console.error('Error auto-populating flight data:', error);
    res.status(500).json({ error: 'Failed to auto-populate flight data' });
  }
});

// Convert flight times to timezone-aware format
app.post('/api/flights/convert-times', (req, res) => {
  try {
    const flight = req.body;
    const convertedFlight = timezoneService.convertFlightTimes(flight);
    
    res.json(convertedFlight);
  } catch (error) {
    console.error('Error converting flight times:', error);
    res.status(500).json({ error: 'Failed to convert flight times' });
  }
});

// Get real-time flight information from FlightAware AeroAPI
// Public flight info endpoint for standalone form
app.get('/api/flights/info/:flightNumber/:date', async (req, res) => {
  try {
    const { flightNumber, date } = req.params;
    
    console.log(`🔍 Fetching flight info for ${flightNumber} on ${date}`);
    
    // Use the FlightInfoService to get real-time data
    const FlightInfoService = require('./flight-info-service');
    const flightInfoService = new FlightInfoService();
    
    const result = await flightInfoService.getFlightInfo(flightNumber, date);
    
    if (result.multipleFlights) {
      // Handle multiple flights case - transform each flight
      console.log(`🔄 Transforming ${result.flights.length} flights for multiple flights response`);
      
      const transformedFlights = result.flights.map((flight, index) => {
        console.log(`🔄 Transforming flight ${index + 1}:`, {
          airline: flight.airlineName,
          departure: flight.departureAirport,
          arrival: flight.arrivalAirport,
          scheduledDepartureRaw: flight.scheduledDepartureRaw,
          scheduledArrivalRaw: flight.scheduledArrivalRaw
        });
        
        const transformed = {
          airline: flight.airlineName || flightNumber.substring(0, 2).toUpperCase(),
          departure: {
            airport: flight.departureAirport,
            scheduled: flight.scheduledDeparture,
            scheduledTime: flight.scheduledDeparture,
            scheduledForInput: flight.scheduledDepartureRaw,
            timezone: flight.departureTimezone
          },
          arrival: {
            airport: flight.arrivalAirport,
            scheduled: flight.scheduledArrival,
            scheduledTime: flight.scheduledArrival,
            scheduledForInput: flight.scheduledArrivalRaw,
            timezone: flight.arrivalTimezone
          },
          status: flight.flightStatus,
          duration: flight.duration
        };
        
        console.log(`✅ Transformed flight ${index + 1} scheduledForInput values:`, {
          departure: transformed.departure.scheduledForInput,
          arrival: transformed.arrival.scheduledForInput
        });
        
        return transformed;
      });
      
      console.log(`✅ Successfully transformed multiple flights, sending response`);
      res.json({
        multipleFlights: true,
        flights: transformedFlights,
        source: 'FlightAware AeroAPI'
      });
    } else if (!result.error) {
      // Transform the FlightAware data to match our expected format
      console.log(`🔄 Transforming single flight raw data:`, {
        scheduledDepartureRaw: result.scheduledDepartureRaw,
        scheduledArrivalRaw: result.scheduledArrivalRaw
      });
      
      const transformedData = {
        airline: result.airlineName || flightNumber.substring(0, 2).toUpperCase(),
        departure: {
          airport: result.departureAirport,
          scheduled: result.scheduledDeparture,
          scheduledForInput: result.scheduledDepartureRaw, // Already converted to airport timezone
          timezone: result.departureTimezone
        },
        arrival: {
          airport: result.arrivalAirport,
          scheduled: result.scheduledArrival,
          scheduledForInput: result.scheduledArrivalRaw, // Already converted to airport timezone
          timezone: result.arrivalTimezone
        },
        status: result.flightStatus,
        duration: result.duration
      };
      
      console.log(`✅ Single flight scheduledForInput values:`, {
        departure: transformedData.departure.scheduledForInput,
        arrival: transformedData.arrival.scheduledForInput
      });
      
      res.json({
        success: true,
        data: transformedData,
        source: 'FlightAware AeroAPI'
      });
    } else {
      // Handle error case with fallback data
      const response = {
        success: false,
        error: result.message || 'Flight information not available'
      };
      
      // Include fallback suggestions if available
      if (result.fallback) {
        response.fallback = result.fallback;
      }
      
      res.json(response);
    }
  } catch (error) {
    console.error('Error fetching flight information:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch flight information',
      details: error.message
    });
  }
});

// Get upcoming flights (48-72 hours) for a flight number
app.get('/api/flights/upcoming/:flightNumber', async (req, res) => {
  try {
    const { flightNumber } = req.params;
    
    console.log(`🔍 Fetching upcoming flights for ${flightNumber} in next 48-72 hours`);
    
    // Calculate date range (today to +1 day max due to API limitations)  
    const today = new Date();
    const maxDate = new Date(today);
    maxDate.setDate(today.getDate() + 1); // FlightAware allows max 2 days total (today + 1)
    
    const startDate = today.toISOString().split('T')[0];
    const endDate = maxDate.toISOString().split('T')[0];
    
    console.log(`📅 Searching for flights from ${startDate} to ${endDate}`);
    
    // Use the FlightInfoService to get real-time data
    const FlightInfoService = require('./flight-info-service');
    const flightInfoService = new FlightInfoService();
    
    // Try each date in the range to find flights
    const allFlights = [];
    const currentDate = new Date(today);
    
    while (currentDate <= maxDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      console.log(`🔍 Checking ${flightNumber} on ${dateStr}`);
      
      try {
        const dayResult = await flightInfoService.getFlightInfo(flightNumber, dateStr);
        
        if (dayResult.multipleFlights) {
          // Add all flights from this day
          allFlights.push(...dayResult.flights);
          console.log(`✅ Found ${dayResult.flights.length} flights on ${dateStr}`);
        } else if (!dayResult.error) {
          // Add single flight from this day
          allFlights.push(dayResult);
          console.log(`✅ Found 1 flight on ${dateStr}`);
        } else {
          console.log(`ℹ️ No flights found on ${dateStr}: ${dayResult.message}`);
        }
      } catch (error) {
        console.log(`⚠️ Error checking ${dateStr}: ${error.message}`);
      }
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    if (allFlights.length > 0) {
      console.log(`🔄 Transforming ${allFlights.length} upcoming flights for response`);
      
      const transformedFlights = allFlights.map((flight, index) => {
        console.log(`🔄 Transforming upcoming flight ${index + 1}:`, {
          airline: flight.airlineName,
          departure: flight.departureAirport,
          arrival: flight.arrivalAirport,
          scheduledDepartureRaw: flight.scheduledDepartureRaw,
          scheduledArrivalRaw: flight.scheduledArrivalRaw,
          flightDate: flight.flightDate
        });
        
        const transformed = {
          airline: flight.airlineName || flightNumber.substring(0, 2).toUpperCase(),
          departure: {
            airport: flight.departureAirport,
            scheduled: flight.scheduledDeparture,
            scheduledTime: flight.scheduledDeparture,
            scheduledForInput: flight.scheduledDepartureRaw,
            timezone: flight.departureTimezone
          },
          arrival: {
            airport: flight.arrivalAirport,
            scheduled: flight.scheduledArrival,
            scheduledTime: flight.scheduledArrival,
            scheduledForInput: flight.scheduledArrivalRaw,
            timezone: flight.arrivalTimezone
          },
          status: flight.flightStatus,
          duration: flight.duration,
          flightDate: flight.flightDate
        };
        
        console.log(`✅ Transformed upcoming flight ${index + 1} scheduledForInput values:`, {
          departure: transformed.departure.scheduledForInput,
          arrival: transformed.arrival.scheduledForInput,
          flightDate: transformed.flightDate
        });
        
        return transformed;
      });
      
      console.log(`✅ Successfully found and transformed ${transformedFlights.length} upcoming flights`);
      res.json({
        flights: transformedFlights,
        dateRange: { start: startDate, end: endDate },
        source: 'FlightAware AeroAPI'
      });
    } else {
      // No flights found in the date range
      console.log(`ℹ️ No upcoming flights found for ${flightNumber} in date range ${startDate} to ${endDate}`);
      
      // Generate fallback suggestion
      const fallbackSuggestion = flightInfoService.generateFlightSuggestion(flightNumber, startDate);
      
      res.json({
        flights: [],
        fallback: {
          airline: fallbackSuggestion.airline,
          message: `No upcoming flights found for ${flightNumber} in the next 48-72 hours. The FlightAware API may have limited data for this flight. Please manually enter flight details and verify with your booking confirmation.`,
          tips: fallbackSuggestion.tips,
          searchedDates: `${startDate} to ${endDate}`
        },
        dateRange: { start: startDate, end: endDate },
        source: 'FlightAware AeroAPI'
      });
    }
  } catch (error) {
    console.error('Error fetching upcoming flights:', error);
    res.status(500).json({ 
      flights: [],
      error: 'Failed to fetch upcoming flight information',
      details: error.message,
      fallback: {
        message: 'Unable to search for upcoming flights due to a technical error. Please manually enter flight details.',
        tips: [
          'Check the airline\'s website for accurate flight times',
          'Verify departure and arrival airports',
          'Consider time zone differences for scheduling'
        ]
      }
    });
  }
});

// Get available timezones
app.get('/api/timezones', (req, res) => {
  try {
    const timezones = timezoneService.getTimezoneOptions();
    res.json(timezones);
  } catch (error) {
    console.error('Error getting timezones:', error);
    res.status(500).json({ error: 'Failed to get timezones' });
  }
});

// Debug endpoint to view server files (only in development or with special header)
app.get('/api/debug/files', (req, res) => {
  // Security check
  if (process.env.NODE_ENV === 'production' && req.headers['x-debug-key'] !== 'west-sant-debug-2024') {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  const allowedFiles = [
    'flights.json',
    'users.json',
    'passengers.json',
    'volunteers.json',
    'audit_log.json'
  ];
  
  const requestedFile = req.query.file;
  if (!requestedFile || !allowedFiles.includes(requestedFile)) {
    return res.json({ 
      availableFiles: allowedFiles,
      usage: '/api/debug/files?file=flights.json',
      note: 'In production, add header: x-debug-key: west-sant-debug-2024'
    });
  }
  
  const filePath = path.join(__dirname, requestedFile);
  fs.readFile(filePath, 'utf8')
    .then(data => {
      try {
        const jsonData = JSON.parse(data);
        res.json({ file: requestedFile, data: jsonData });
      } catch (e) {
        res.json({ file: requestedFile, data: data });
      }
    })
    .catch(err => {
      res.status(404).json({ error: `File not found: ${requestedFile}`, details: err.message });
    });
});

if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

// Flight monitoring endpoints
app.get('/api/monitoring/status', authenticateToken, authorizeRole(['superadmin']), (req, res) => {
  try {
    const status = flightMonitor.getMonitoringStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error getting monitoring status:', error);
    res.status(500).json({ error: 'Failed to get monitoring status' });
  }
});

app.post('/api/monitoring/start', authenticateToken, authorizeRole(['superadmin']), (req, res) => {
  try {
    flightMonitor.startMonitoring();
    res.json({
      success: true,
      message: 'Flight monitoring started'
    });
  } catch (error) {
    console.error('Error starting monitoring:', error);
    res.status(500).json({ error: 'Failed to start monitoring' });
  }
});

app.post('/api/monitoring/stop', authenticateToken, authorizeRole(['superadmin']), (req, res) => {
  try {
    flightMonitor.stopMonitoring();
    res.json({
      success: true,
      message: 'Flight monitoring stopped'
    });
  } catch (error) {
    console.error('Error stopping monitoring:', error);
    res.status(500).json({ error: 'Failed to stop monitoring' });
  }
});

app.post('/api/monitoring/interval', authenticateToken, authorizeRole(['superadmin']), (req, res) => {
  try {
    const { minutes } = req.body;
    
    if (!minutes || minutes < 15 || minutes > 120) {
      return res.status(400).json({ error: 'Interval must be between 15 and 120 minutes' });
    }
    
    flightMonitor.setCheckInterval(minutes);
    res.json({
      success: true,
      message: `Monitoring interval updated to ${minutes} minutes`
    });
  } catch (error) {
    console.error('Error updating monitoring interval:', error);
    res.status(500).json({ error: 'Failed to update monitoring interval' });
  }
});

app.post('/api/monitoring/check-now', authenticateToken, authorizeRole(['superadmin']), async (req, res) => {
  try {
    // Run immediate check without waiting
    flightMonitor.checkAllFlights().catch(err => {
      console.error('Error in manual flight check:', err);
    });
    
    res.json({
      success: true,
      message: 'Manual flight check initiated'
    });
  } catch (error) {
    console.error('Error initiating manual check:', error);
    res.status(500).json({ error: 'Failed to initiate manual check' });
  }
});

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  await initializeDefaultUsers();
  await migrateFlightUserNames();
  
  // Start automatic backups in production
  if (process.env.NODE_ENV === 'production' && process.env.BACKUP_BUCKET_NAME) {
    console.log('🔄 Starting automatic backup service...');
    backupService.startAutomaticBackups(24); // Every 24 hours
  }

  // Start automated flight delay monitoring
  console.log('🚨 Starting automated flight delay monitoring...');
  flightMonitor.startMonitoring();
});