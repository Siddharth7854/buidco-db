// Robust module loading with Express router fix
let express, cors, Pool, multer, path, fs;

try {
  // Clear module cache to prevent conflicts
  delete require.cache[require.resolve('express')];
  
  express = require('express');
  cors = require('cors');
  Pool = require('pg').Pool;
  multer = require('multer');
  path = require('path');
  fs = require('fs');

  // Validate Express and its router
  if (!express || typeof express !== 'function') {
    throw new Error('Express module not properly loaded');
  }
  
  // Test Express app creation to validate router
  const testApp = express();
  if (!testApp || !testApp.use) {
    throw new Error('Express router validation failed');
  }

  console.log('✅ All modules validated successfully');
  console.log('Express version:', require('express/package.json').version);
  console.log('Node version:', process.version);
  
} catch (error) {
  console.error('❌ Critical module error:', error.message);
  console.error('Stack:', error.stack);
  
  // Force reinstall guidance
  console.error('\n🔧 SOLUTION: Run these commands:');
  console.error('1. rm -rf node_modules package-lock.json');
  console.error('2. npm cache clean --force');
  console.error('3. npm install --force');
  
  process.exit(1);
}

// Load environment variables
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware - Enhanced CORS for frontend connectivity
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:8080',
      'http://localhost:3000', 
      'http://localhost:5173',
      'http://127.0.0.1:8080',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173'
    ];
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // For production, also allow requests without specific origin
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-source', 'Accept', 'Origin', 'X-Requested-With'],
  optionsSuccessStatus: 200
}));

// Add comprehensive CORS handling
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }
  
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-source, Accept, Origin, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

app.use(express.json());

// Root route - API Status
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'BUIDCO Employee Management System API',
    status: 'Server is running successfully! 🚀',
    version: '1.0.0',
    endpoints: {
      login: '/api/login',
      employees: '/api/employees',
      leaves: '/api/leaves',
      notifications: '/api/notifications'
    },
    database: process.env.DATABASE_URL ? 'Connected' : 'Not configured',
    timestamp: new Date().toISOString()
  });
});

// PostgreSQL Connection with improved error handling for Render
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}?sslmode=require`,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : {
    rejectUnauthorized: false
  },
  // Connection timeout and pool options optimized for Render
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 30000,
  max: 5,
  min: 1,
  acquireTimeoutMillis: 20000,
  // Removed all problematic options that cause parameter errors on Render
});

// Test database connection with retry logic
async function testDatabaseConnection() {
  let retries = 3;
  while (retries > 0) {
    try {
      const result = await pool.query('SELECT NOW()');
      console.log('✅ Connected to PostgreSQL database successfully');
      console.log('Database time:', result.rows[0].now);
      return true;
    } catch (err) {
      console.error(`❌ Database connection attempt failed (${4-retries}/3):`, err.message);
      console.log('Environment check:');
      console.log('- DATABASE_URL:', process.env.DATABASE_URL ? '✅ Set' : '❌ Not set');
      console.log('- NODE_ENV:', process.env.NODE_ENV || 'development');
      console.log('- Port:', process.env.PORT || 5000);
      
      retries--;
      if (retries > 0) {
        console.log(`Retrying in 5 seconds... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }
  console.error('🚨 Failed to connect to database after 3 attempts');
  console.log('💡 Please check your Railway PostgreSQL service and DATABASE_URL environment variable');
  return false;
}

// Test connection on startup
testDatabaseConnection();

// Handle pool errors
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
});

// Multer config for leave documents
const leaveDocsStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, 'uploads', 'leave_docs');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const uploadLeaveDoc = multer({ storage: leaveDocsStorage });

// Multer config for profile photos
const profilePhotoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, 'uploads', 'profile_photos');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const uploadProfilePhoto = multer({ storage: profilePhotoStorage });

// Serve uploaded profile photos statically

// Serve uploaded profile photos statically
app.use('/uploads/profile_photos', express.static(path.join(__dirname, 'uploads/profile_photos')));
// Serve uploaded leave documents statically
app.use('/uploads/leave_docs', express.static(path.join(__dirname, 'uploads/leave_docs')));
// --- Global error handler to ensure all errors return JSON ---
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (res.headersSent) {
    return next(err);
  }
  // If body-parser JSON parse error
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: 'Invalid JSON in request body',
      details: err.message
    });
  }
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});

// Create tables if they don't exist
async function createTables() {
  // Skip table creation if DATABASE_URL is not set
  if (!process.env.DATABASE_URL) {
    console.log('⚠️ DATABASE_URL not set, skipping table creation');
    console.log('📋 Please set DATABASE_URL in Railway environment variables');
    return false;
  }

  let client;
  try {
    console.log('🔧 Attempting to create/check database tables...');
    client = await pool.connect();
    await client.query('BEGIN');

    // Create employees table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS employees (
        employee_id VARCHAR(50) PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        mobile_number VARCHAR(20),
        designation VARCHAR(255),
        role VARCHAR(50) DEFAULT 'employee',
        joining_date DATE,
        current_posting VARCHAR(255),
        password VARCHAR(255) NOT NULL,
        status VARCHAR(20) DEFAULT 'Active',
        profile_photo TEXT,
        cl_balance INTEGER DEFAULT 16,
        rh_balance INTEGER DEFAULT 3,
        el_balance INTEGER DEFAULT 18,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Update existing employees CL balance from 10 to 16
    await client.query(`
      UPDATE employees SET cl_balance = 16 WHERE cl_balance = 10
    `);

    console.log('✅ Updated existing employees CL balance from 10 to 16');

    // Create leaves table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS leaves (
        id SERIAL PRIMARY KEY,
        employee_id VARCHAR(50) NOT NULL,
        employee_name VARCHAR(255) NOT NULL,
        type VARCHAR(10) NOT NULL CHECK (type IN ('CL', 'EL', 'RH', 'SL')),
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        days INTEGER NOT NULL,
        reason TEXT,
        status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Cancelled')),
        applied_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        approved_date TIMESTAMP,
        rejected_date TIMESTAMP,
        cancelled_date TIMESTAMP,
        location VARCHAR(255),
        remarks TEXT,
        designation VARCHAR(255),
        document_path TEXT,
        cancel_request_status VARCHAR(20),
        cancel_reason TEXT,
        FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE
      )
    `);

    // Create notifications table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        type VARCHAR(50),
        message TEXT,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        user_id VARCHAR(50),
        sender_id VARCHAR(50),
        sender_name VARCHAR(255),
        sender_photo TEXT
      )
    `);

    // Create leave_documents table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS leave_documents (
        id SERIAL PRIMARY KEY,
        leave_id INTEGER NOT NULL,
        file_name TEXT,
        file_url TEXT,
        file_size INTEGER,
        upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (leave_id) REFERENCES leaves(id) ON DELETE CASCADE
      )
    `);

    await client.query('COMMIT');
    console.log('✅ All tables created/verified successfully');
    return true;
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    
    if (err.code === 'ENETUNREACH' || err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
      console.log('🌐 Database connection issue - this is normal during Railway deployment startup');
      console.log('💡 Railway PostgreSQL service may still be initializing, retrying later...');
    } else if (err.code === '42501') {
      console.log('🔒 Permission denied - tables may already exist');
    } else {
      console.error('❌ Error creating tables:', err.message);
    }
    return false;
  } finally {
    if (client) client.release();
  }
}

// Call the function to create tables with retry logic
async function initializeDatabase() {
  let retries = 3;
  let success = false;
  
  while (retries > 0 && !success) {
    console.log(`🔄 Database initialization attempt ${4-retries}/3...`);
    success = await createTables();
    
    if (success) {
      // Create a default admin user if no users exist
      try {
        const userCount = await pool.query('SELECT COUNT(*) FROM employees');
        if (parseInt(userCount.rows[0].count) === 0) {
          await pool.query(`
            INSERT INTO employees (
              employee_id, full_name, email, mobile_number, 
              designation, role, password, status
            ) VALUES (
              'ADMIN001', 'System Administrator', 'admin@buidco.com', '8002659674',
              'Administrator', 'admin', 'admin123', 'Active'
            )
          `);
          console.log('👤 Default admin user created: admin@buidco.com / admin123');
        }
      } catch (err) {
        console.log('ℹ️ Note: Could not create default admin user:', err.message);
      }
    } else {
      retries--;
      if (retries > 0) {
        console.log(`⏳ Waiting 10 seconds before retry... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }
  }
  
  if (!success) {
    console.log('⚠️ Could not initialize database after 3 attempts');
    console.log('🚀 Server will continue running - database may become available later');
  }
}

// Initialize database with delay for Railway
setTimeout(initializeDatabase, 8000);

// Add balance columns if they don't exist
const addBalanceColumns = async () => {
  // Skip if DATABASE_URL is not set
  if (!process.env.DATABASE_URL) {
    console.log('⚠️ DATABASE_URL not set, skipping balance column check');
    return;
  }

  try {
    // Check if leaves table exists first
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'leaves'
      );
    `);

    if (!tableExists.rows[0].exists) {
      console.log('ℹ️ Leaves table does not exist yet, skipping column additions');
      return;
    }

    await pool.query(`
      DO $$ 
      BEGIN 
        -- Add designation column to leaves table if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leaves' AND column_name='designation') THEN
          ALTER TABLE leaves ADD COLUMN designation VARCHAR(255);
        END IF;

        -- Update existing leaves with designation from employees
        UPDATE leaves l 
        SET designation = e.designation 
        FROM employees e 
        WHERE l.employee_id = e.employee_id 
        AND l.designation IS NULL;
      END $$;
    `);
    console.log('✅ Balance columns verified/added successfully');
  } catch (err) {
    if (err.code === 'ENETUNREACH' || err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
      console.log('🌐 Could not check balance columns - database connection issue');
    } else {
      console.error('❌ Error adding balance columns:', err.message);
    }
  }
};

// Call with delay to ensure database is ready
setTimeout(addBalanceColumns, 12000);

// Ensure additional tables exist (with error handling)
const ensureAdditionalTables = async () => {
  // Skip if DATABASE_URL is not set
  if (!process.env.DATABASE_URL) {
    console.log('⚠️ DATABASE_URL not set, skipping additional table creation');
    return;
  }

  try {
    // This is redundant since notifications table is created in createTables(),
    // but keeping for safety
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        type VARCHAR(50),
        message TEXT,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        user_id INTEGER,
        sender_id VARCHAR(50),
        sender_name VARCHAR(255),
        sender_photo TEXT
      );
    `);
    console.log('✅ Additional tables verified/created successfully');
  } catch (err) {
    if (err.code === 'ENETUNREACH' || err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
      console.log('🌐 Could not verify additional tables - database connection issue');
    } else {
      console.error('❌ Error ensuring additional tables:', err.message);
    }
  }
};

// Call with delay to ensure database is ready
setTimeout(ensureAdditionalTables, 15000);

// Bulk update all employees' earned leave balance to 18 (GET version, unique path)
app.get('/api/employees/bulk-update-el-balance-all', async (req, res) => {
  console.log('Bulk update endpoint hit');
  try {
    const result = await pool.query(
      'UPDATE employees SET el_balance = 18 WHERE el_balance != 18 OR el_balance IS NULL RETURNING employee_id, el_balance'
    );
    res.json({ 
      success: true, 
      message: `Updated ${result.rows.length} employees' earned leave balance to 18`,
      updatedEmployees: result.rows
    });
  } catch (err) {
    console.error('Error bulk updating earned leave balance:', err);
    res.status(500).json({ error: err.message });
  }
});

// Bulk update all employees' casual leave balance to 16 (GET version, unique path)
app.get('/api/employees/bulk-update-cl-balance-all', async (req, res) => {
  console.log('Bulk update CL balance endpoint hit');
  try {
    const result = await pool.query(
      'UPDATE employees SET cl_balance = 16 WHERE cl_balance != 16 OR cl_balance IS NULL RETURNING employee_id, cl_balance'
    );
    res.json({ 
      success: true, 
      message: `Updated ${result.rows.length} employees' casual leave balance to 16`,
      updatedEmployees: result.rows
    });
  } catch (err) {
    console.error('Error bulk updating casual leave balance:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete employee by employee_id
app.delete('/api/employees/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const result = await pool.query(
      'DELETE FROM employees WHERE employee_id = $1 RETURNING *',
      [employeeId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    res.json({ success: true, employee: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update employee by employee_id
app.patch('/api/employees/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const {
      full_name, email, mobile_number, designation, role, 
      joining_date, current_posting, password, status
    } = req.body;

    // Build dynamic update query
    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;

    if (full_name !== undefined) {
      updateFields.push(`full_name = $${paramCount++}`);
      updateValues.push(full_name);
    }
    if (email !== undefined) {
      updateFields.push(`email = $${paramCount++}`);
      updateValues.push(email);
    }
    if (mobile_number !== undefined) {
      updateFields.push(`mobile_number = $${paramCount++}`);
      updateValues.push(mobile_number);
    }
    if (designation !== undefined) {
      updateFields.push(`designation = $${paramCount++}`);
      updateValues.push(designation);
    }
    if (role !== undefined) {
      updateFields.push(`role = $${paramCount++}`);
      updateValues.push(role);
    }
    if (joining_date !== undefined) {
      updateFields.push(`joining_date = $${paramCount++}`);
      updateValues.push(joining_date);
    }
    if (current_posting !== undefined) {
      updateFields.push(`current_posting = $${paramCount++}`);
      updateValues.push(current_posting);
    }
    if (password !== undefined && password.trim() !== '') {
      updateFields.push(`password = $${paramCount++}`);
      updateValues.push(password);
    }
    if (status !== undefined) {
      updateFields.push(`status = $${paramCount++}`);
      updateValues.push(status);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateValues.push(employeeId);
    const query = `
      UPDATE employees 
      SET ${updateFields.join(', ')} 
      WHERE employee_id = $${paramCount} 
      RETURNING *
    `;

    const result = await pool.query(query, updateValues);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      employee: result.rows[0]
    });
  } catch (err) {
    console.error('Error updating employee:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update employee leave balances
app.patch('/api/employees/:employeeId/leave-balances', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { cl_balance, rh_balance, el_balance } = req.body;

    // Build dynamic update query for leave balances
    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;

    if (cl_balance !== undefined) {
      updateFields.push(`cl_balance = $${paramCount++}`);
      updateValues.push(cl_balance);
    }
    if (rh_balance !== undefined) {
      updateFields.push(`rh_balance = $${paramCount++}`);
      updateValues.push(rh_balance);
    }
    if (el_balance !== undefined) {
      updateFields.push(`el_balance = $${paramCount++}`);
      updateValues.push(el_balance);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No leave balance fields to update' });
    }

    updateValues.push(employeeId);
    const query = `
      UPDATE employees 
      SET ${updateFields.join(', ')} 
      WHERE employee_id = $${paramCount} 
      RETURNING *
    `;

    const result = await pool.query(query, updateValues);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating employee leave balances:', err);
    res.status(500).json({ error: err.message });
  }
});

// Routes
app.post('/api/login', async (req, res) => {
  const { email, employeeId, password } = req.body;
  const loginId = email || employeeId;
  try {
    const result = await pool.query(
      `SELECT * FROM employees WHERE (email = $1 OR employee_id = $1) AND password = $2 AND status = 'Active'`,
      [loginId, password]
    );
    if (result.rows.length > 0) {
      const user = result.rows[0];
      res.json({
        success: true,
        user: {
          email: user.email,
          fullName: user.full_name,
          employeeId: user.employee_id,
          role: user.role,
          designation: user.designation
        }
      });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Add new employee
app.post('/api/employees', async (req, res) => {
  const {
    employee_id, full_name, email, mobile_number,
    designation, role, joining_date, current_posting,
    password, status
  } = req.body;
  try {
    // First ensure the designation is not empty
    if (!designation) {
      return res.status(400).json({ error: 'Designation is required' });
    }

    // Set default balances: CL=16, RH=3, EL=18 for every new user
    const result = await pool.query(
      `INSERT INTO employees
      (employee_id, full_name, email, mobile_number, designation, role, joining_date, current_posting, password, status, cl_balance, rh_balance, el_balance)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, 16, 3, 18) RETURNING *`,
      [employee_id, full_name, email, mobile_number, designation, role, joining_date, current_posting, password, status]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all employees
app.get('/api/employees', async (req, res) => {
  try {
    console.log('📋 GET /api/employees called from origin:', req.headers.origin || 'no-origin');
    
    const { employee_id } = req.query;
    if (employee_id) {
      console.log('🔍 Fetching specific employee:', employee_id);
      const result = await pool.query('SELECT * FROM employees WHERE employee_id = $1', [employee_id]);
      console.log('✅ Found employee:', result.rows.length > 0 ? 'Yes' : 'No');
      return res.json(result.rows);
    }
    
    console.log('📋 Fetching all employees...');
    const result = await pool.query(`
      SELECT 
        ROW_NUMBER() OVER (ORDER BY employee_id) as id,
        employee_id, 
        full_name, 
        email, 
        mobile_number, 
        designation, 
        role, 
        joining_date, 
        current_posting, 
        status, 
        profile_photo,
        cl_balance, 
        rh_balance, 
        el_balance,
        created_at,
        updated_at
      FROM employees 
      ORDER BY employee_id
    `);
    
    console.log(`✅ Found ${result.rows.length} employees`);
    console.log('📊 Employee data sample:', result.rows.length > 0 ? {
      id: result.rows[0].id,
      employee_id: result.rows[0].employee_id,
      full_name: result.rows[0].full_name,
      role: result.rows[0].role
    } : 'No employees found');
    
    // Set proper headers for JSON response
    res.setHeader('Content-Type', 'application/json');
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Error in GET /api/employees:', err);
    res.status(500).json({ 
      error: err.message,
      endpoint: '/api/employees',
      timestamp: new Date().toISOString()
    });
  }
});

// Leave Routes
// Submit leave request
app.post('/api/leaves', async (req, res) => {
  try {
    const { employeeId, type, startDate, endDate, reason, location } = req.body;
    // Calculate days (duration) on backend for data integrity
    let days = 0;
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      days = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
    }
    // Get employee details including designation
    const empResult = await pool.query(
      'SELECT full_name, designation FROM employees WHERE employee_id = $1',
      [employeeId]
    );
    if (empResult.rows.length === 0) {
      console.error('Employee not found for employeeId:', employeeId);
      return res.status(404).json({ error: 'Employee not found' });
    }
    const { full_name: employeeName, designation } = empResult.rows[0];
    if (!designation) {
      console.error('Employee designation not found for employeeId:', employeeId);
      return res.status(400).json({ error: 'Employee designation not found' });
    }
    const result = await pool.query(
      'INSERT INTO leaves (employee_id, employee_name, type, start_date, end_date, days, reason, status, applied_on, location, designation) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *',
      [employeeId, employeeName, type, startDate, endDate, days, reason, 'Pending', new Date(), location, designation]
    );
    // Add notification for admin with sender information
    await pool.query(
      `INSERT INTO notifications (type, message, user_id, sender_id, sender_name, created_at, sender_photo) 
       VALUES ($1, $2, NULL, $3, $4, CURRENT_TIMESTAMP, $5)`,
      [
        'New Leave Request', 
        `New leave request from ${employeeName} (${employeeId}) for ${type} from ${startDate} to ${endDate}.`,
        employeeId,
        employeeName + ' [' + (req.headers['x-source'] === 'app' ? 'App' : 'Web') + ']',
        (await pool.query('SELECT profile_photo FROM employees WHERE employee_id = $1', [employeeId])).rows[0]?.profile_photo || null
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error in POST /api/leaves:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get all leave requests
app.get('/api/leaves', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        l.*, 
        COALESCE(l.designation, e.designation) as designation,
        e.designation as employee_designation
      FROM leaves l 
      LEFT JOIN employees e ON l.employee_id = e.employee_id 
      ORDER BY l.applied_on DESC
    `);

    // Map all possible cancellation fields for admin panel visibility
    const transformedData = result.rows.map(row => {
      return {
        id: row.id,
        employeeId: row.employee_id,
        employeeName: row.employee_name,
        type: row.type,
        startDate: row.start_date,
        endDate: row.end_date,
        days: row.days,
        reason: row.reason,
        status: row.status,
        appliedOn: row.applied_on,
        location: row.location,
        remarks: row.remarks,
        designation: row.designation || row.employee_designation || 'Not Specified',
        cancelRequestStatus: row.cancel_request_status,
        cancelReason: row.cancel_reason,
        documentPath: row.document_path
      };
    });

    res.json(transformedData);
  } catch (err) {
    console.error('Error in /api/leaves:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get leave requests for specific employee (improved mapping, deduplication, filtering)
app.get('/api/leaves/:employeeId', async (req, res) => {
  try {
    const { status } = req.query;
    const result = await pool.query(
      `SELECT 
        l.*,
        COALESCE(l.designation, e.designation) as designation
      FROM leaves l 
      LEFT JOIN employees e ON l.employee_id = e.employee_id 
      WHERE l.employee_id = $1 
      ORDER BY l.applied_on DESC`,
      [req.params.employeeId]
    );
    let leaves = result.rows;
    // Optional status filter
    if (status) {
      leaves = leaves.filter(l => (l.status || '').toLowerCase() === status.toLowerCase());
    }
    // Deduplicate by id, keep latest
    const uniqueLeaves = {};
    for (const leave of leaves) {
      if (!uniqueLeaves[leave.id] || new Date(leave.applied_on) > new Date(uniqueLeaves[leave.id].applied_on)) {
        uniqueLeaves[leave.id] = leave;
      }
    }
    // Map to consistent frontend format and include can_request_cancellation
    const mapped = Object.values(uniqueLeaves).map(leave => {
      return {
        id: leave.id,
        leaveType: leave.type || leave.leave_type || leave.leave_type_id || '',
        startDate: leave.start_date || leave.startDate || '',
        endDate: leave.end_date || leave.endDate || '',
        days: leave.days || leave.no_of_days || '',
        status: leave.status || '',
        reason: leave.reason || '',
        appliedDate: leave.applied_on || leave.appliedDate || leave.created_at || '',
        approvedBy: leave.approved_by || leave.approvedBy || '',
        icon: '', // let frontend guess icon
        designation: leave.designation || '',
        remarks: leave.remarks || '',
        approvedDate: leave.approved_date || '',
        rejectedDate: leave.rejected_date || '',
        cancelledDate: leave.cancelled_date || '',
        location: leave.location || '',
      };
    });
    // Sort by appliedDate DESC
    mapped.sort((a, b) => new Date(b.appliedDate) - new Date(a.appliedDate));
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Approve leave request
// Approve leave request (robust, single implementation)
app.patch('/api/leaves/:id/approve', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Get leave details
    const leaveResult = await client.query(
      `SELECT l.*, e.designation 
       FROM leaves l
       JOIN employees e ON l.employee_id = e.employee_id
       WHERE l.id = $1 FOR UPDATE`,
      [req.params.id]
    );
    if (leaveResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Leave not found' });
    }
    const leave = leaveResult.rows[0];
    // Robust status check (case-insensitive)
    if (typeof leave.status === 'string' && leave.status.trim().toLowerCase() === 'approved') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Leave already approved' });
    }
    // Check leave balance
    const balanceColumn = {
      'CL': 'cl_balance',
      'EL': 'el_balance',
      'RH': 'rh_balance'
    }[leave.type];
    if (!balanceColumn) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid leave type' });
    }
    const employeeResult = await client.query(
      `SELECT ${balanceColumn} FROM employees 
       WHERE employee_id = $1 FOR UPDATE`,
      [leave.employee_id]
    );
    if (employeeResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Employee not found' });
    }
    const currentBalance = employeeResult.rows[0][balanceColumn];
    if (currentBalance < leave.days) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: `Insufficient ${leave.type} balance` 
      });
    }
    // Update leave status
    const updateResult = await client.query(
      `UPDATE leaves 
       SET status = 'Approved', approved_date = NOW() 
       WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    // Deduct leave balance
    await client.query(
      `UPDATE employees 
       SET ${balanceColumn} = ${balanceColumn} - $1 
       WHERE employee_id = $2`,
      [leave.days, leave.employee_id]
    );
    
    // Notify employee about approval (set sender_name and sender_photo to employee info, append [App]/[Web] based on x-source)
    const empInfo = await client.query('SELECT full_name, profile_photo FROM employees WHERE employee_id = $1', [leave.employee_id]);
    let empName = empInfo.rows[0]?.full_name || 'Employee';
    const empPhoto = empInfo.rows[0]?.profile_photo || null;
    const source = req.headers['x-source'] === 'app' ? 'App' : 'Web';
    if (!/\[(App|Web)\]$/.test(empName)) {
      empName = empName + ` [${source}]`;
    }
    await client.query(
      `INSERT INTO notifications (type, message, user_id, sender_id, sender_name, sender_photo, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
      [
        'leave_approved',
        `Your ${leave.type} leave request from ${leave.start_date} to ${leave.end_date} has been approved.`,
        leave.employee_id,
        leave.employee_id,
        empName,
        empPhoto
      ]
    );
    
    await client.query('COMMIT');
    res.json({ success: true, leave: updateResult.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ 
      error: err.message || 'Failed to approve leave',
      details: err.detail || null,
      stack: err.stack || null
    });
  } finally {
    client.release();
  }
});

// Reject leave request
app.patch('/api/leaves/:id/reject', async (req, res) => {
  try {
    const { remarks } = req.body;
    const result = await pool.query(
      'UPDATE leaves SET status = $1, remarks = $2, rejected_date = NOW() WHERE id::text = $3 RETURNING *',
      ['Rejected', remarks, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }

    const leave = result.rows[0];
    
    // Notify employee about rejection (set sender_name and sender_photo to employee info, append [App]/[Web] based on x-source)
    const empInfo = await pool.query('SELECT full_name, profile_photo FROM employees WHERE employee_id = $1', [leave.employee_id]);
    let empName = empInfo.rows[0]?.full_name || 'Employee';
    const empPhoto = empInfo.rows[0]?.profile_photo || null;
    const source = req.headers['x-source'] === 'app' ? 'App' : 'Web';
    if (!/\[(App|Web)\]$/.test(empName)) {
      empName = empName + ` [${source}]`;
    }
    await pool.query(
      `INSERT INTO notifications (type, message, user_id, sender_id, sender_name, sender_photo, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
      [
        'leave_rejected',
        `Your ${leave.type} leave request from ${leave.start_date} to ${leave.end_date} has been rejected. ${remarks ? `Reason: ${remarks}` : ''}`,
        leave.employee_id,
        leave.employee_id,
        empName,
        empPhoto
      ]
    );

    res.json({ success: true, leave: result.rows[0] });
  } catch (err) {
    console.error('Error in reject leave:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Cancel leave request
app.patch('/api/leaves/:id/cancel', async (req, res) => {
  const client = await pool.connect();
  try {
    console.log('Starting leave cancellation process for ID:', req.params.id);
    await client.query('BEGIN');

    // Get the leave request details
    console.log('Fetching leave request details...');
    const leaveResult = await client.query(
      'SELECT * FROM leaves WHERE id::text = $1',
      [req.params.id]
    );
    console.log('Leave request found:', leaveResult.rows[0]);

    if (leaveResult.rows.length === 0) {
      console.log('Leave request not found');
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }

    const leave = leaveResult.rows[0];
    console.log('Current leave status:', leave.status);

    // Check if leave is already cancelled
    if (leave.status === 'Cancelled') {
      console.log('Leave already cancelled');
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Leave request is already cancelled' });
    }

    // Check if leave is already approved
    if (leave.status === 'Approved') {
      console.log('Leave is approved, restoring balance...');
      // If approved, restore the leave balance
      let balanceColumn;
      switch (leave.type) {
        case 'CL':
          balanceColumn = 'cl_balance';
          break;
        case 'RH':
          balanceColumn = 'rh_balance';
          break;
        case 'EL':
          balanceColumn = 'el_balance';
          break;
        default:
          console.log('Invalid leave type:', leave.type);
          await client.query('ROLLBACK');
          return res.status(400).json({ success: false, message: 'Invalid leave type' });
      }

      // Restore leave balance
      console.log('Restoring balance for column:', balanceColumn);
      await client.query(
        `UPDATE employees 
         SET ${balanceColumn} = ${balanceColumn} + $1 
         WHERE employee_id = $2`,
        [leave.days, leave.employee_id]
      );
    }

    // Update leave status to cancelled
    console.log('Updating leave status to Cancelled...');
    const updateResult = await client.query(
      'UPDATE leaves SET status = $1, remarks = $2, cancelled_date = $3 WHERE id::text = $4 RETURNING *',
      ['Cancelled', 'Cancelled by employee', new Date(), req.params.id]
    );
    console.log('Leave updated:', updateResult.rows[0]);

    await client.query('COMMIT');
    console.log('Transaction committed successfully');
    res.json({ success: true, leave: updateResult.rows[0] });
  } catch (err) {
    console.error('Error in cancel leave:', err);
    console.error('Error details:', {
      message: err.message,
      stack: err.stack,
      code: err.code,
      detail: err.detail
    });
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
});

// Request leave cancellation (user side)
// Employee requests cancellation of an approved leave
app.post('/api/leaves/:id/request-cancellation', async (req, res) => {
  try {
    const leaveId = req.params.id;
    const { employee_id, cancel_reason } = req.body;
    // Check leave exists and is approved
    const leaveResult = await pool.query(
      'SELECT * FROM leaves WHERE id::text = $1 AND employee_id = $2',
      [leaveId, employee_id]
    );
    if (leaveResult.rows.length === 0) {
      return res.status(404).json({ error: 'Leave not found' });
    }
    const leave = leaveResult.rows[0];
    if ((leave.status || '').toLowerCase() !== 'approved') {
      return res.status(400).json({ error: 'Only approved leaves can be cancelled' });
    }
    if ((leave.cancel_request_status || '').toLowerCase() === 'pending') {
      return res.status(400).json({ error: 'Cancellation already requested' });
    }
    // Mark leave as cancellation requested
    await pool.query(
      `UPDATE leaves SET cancel_request_status = $1, cancel_reason = $2 WHERE id::text = $3`,
      ['Pending', cancel_reason || '', leaveId]
    );
    // Notify admin/manager with sender information (set sender_name and sender_photo to employee info, append [App]/[Web] based on x-source)
    const empInfo = await pool.query('SELECT full_name, profile_photo FROM employees WHERE employee_id = $1', [employee_id]);
    let empName = empInfo.rows[0]?.full_name || 'Employee';
    const empPhoto = empInfo.rows[0]?.profile_photo || null;
    const source = req.headers['x-source'] === 'app' ? 'App' : 'Web';
    if (!/\[(App|Web)\]$/.test(empName)) {
      empName = empName + ` [${source}]`;
    }
    await pool.query(
      `INSERT INTO notifications (type, message, user_id, sender_id, sender_name, sender_photo, created_at) 
       VALUES ($1, $2, NULL, $3, $4, $5, CURRENT_TIMESTAMP)`,
      [
        'leave_cancellation_requested',
        `Employee ${employee_id} requested cancellation for leave ${leaveId}`,
        employee_id,
        empName,
        empPhoto
      ]
    );
    res.json({ success: true, message: 'Cancellation request submitted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin approves cancellation request
app.post('/api/leaves/:id/approve-cancellation', async (req, res) => {
  try {
    const leaveId = req.params.id;
    // Find leave
    const leaveResult = await pool.query('SELECT * FROM leaves WHERE id::text = $1', [leaveId]);
    if (leaveResult.rows.length === 0) {
      return res.status(404).json({ error: 'Leave not found' });
    }
    const leave = leaveResult.rows[0];
    if ((leave.cancel_request_status || '').toLowerCase() !== 'pending') {
      return res.status(400).json({ error: 'No pending cancellation request' });
    }
    // Set leave as cancelled
    await pool.query(
      `UPDATE leaves SET status = $1, cancel_request_status = $2, cancelled_date = CURRENT_TIMESTAMP WHERE id::text = $3`,
      ['Cancelled', 'Approved', leaveId]
    );
    // Restore leave balance
    let balanceColumn = '';
    switch ((leave.type || '').toUpperCase()) {
      case 'CL': balanceColumn = 'cl_balance'; break;
      case 'EL': balanceColumn = 'el_balance'; break;
      case 'RH': balanceColumn = 'rh_balance'; break;
    }
    if (balanceColumn) {
      await pool.query(
        `UPDATE employees SET ${balanceColumn} = ${balanceColumn} + $1 WHERE employee_id = $2`,
        [leave.days, leave.employee_id]
      );
    }
    // Notify employee with sender information (set sender_name and sender_photo to employee info, append [App]/[Web] based on x-source)
    const empInfo = await pool.query('SELECT full_name, profile_photo FROM employees WHERE employee_id = $1', [leave.employee_id]);
    let empName = empInfo.rows[0]?.full_name || 'Employee';
    const empPhoto = empInfo.rows[0]?.profile_photo || null;
    const source = req.headers['x-source'] === 'app' ? 'App' : 'Web';
    if (!/\[(App|Web)\]$/.test(empName)) {
      empName = empName + ` [${source}]`;
    }
    await pool.query(
      `INSERT INTO notifications (type, message, user_id, sender_id, sender_name, sender_photo, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
      [
        'leave_cancellation_approved',
        `Your leave cancellation for leave ${leaveId} was approved`,
        leave.employee_id,
        leave.employee_id,
        empName,
        empPhoto
      ]
    );
    res.json({ success: true, message: 'Leave cancellation approved and leave cancelled' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin rejects cancellation request
app.post('/api/leaves/:id/reject-cancellation', async (req, res) => {
  try {
    const leaveId = req.params.id;
    const { remarks } = req.body;
    // Find leave
    const leaveResult = await pool.query('SELECT * FROM leaves WHERE id::text = $1', [leaveId]);
    if (leaveResult.rows.length === 0) {
      return res.status(404).json({ error: 'Leave not found' });
    }
    const leave = leaveResult.rows[0];
    if ((leave.cancel_request_status || '').toLowerCase() !== 'pending') {
      return res.status(400).json({ error: 'No pending cancellation request' });
    }
    // Revert cancellation request
    await pool.query(
      `UPDATE leaves SET cancel_request_status = $1, cancel_reason = $2 WHERE id::text = $3`,
      ['Rejected', remarks || '', leaveId]
    );
    // Notify employee with sender information (set sender_name and sender_photo to employee info, append [App]/[Web] based on x-source)
    const empInfo = await pool.query('SELECT full_name, profile_photo FROM employees WHERE employee_id = $1', [leave.employee_id]);
    let empName = empInfo.rows[0]?.full_name || 'Employee';
    const empPhoto = empInfo.rows[0]?.profile_photo || null;
    const source = req.headers['x-source'] === 'app' ? 'App' : 'Web';
    if (!/\[(App|Web)\]$/.test(empName)) {
      empName = empName + ` [${source}]`;
    }
    await pool.query(
      `INSERT INTO notifications (type, message, user_id, sender_id, sender_name, sender_photo, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
      [
        'leave_cancellation_rejected',
        `Your leave cancellation for leave ${leaveId} was rejected. ${remarks || ''}`,
        leave.employee_id,
        leave.employee_id,
        empName,
        empPhoto
      ]
    );
    res.json({ success: true, message: 'Leave cancellation rejected' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});




// Get notifications for a specific user
app.get('/api/notifications/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(`
      SELECT n.*, 
             n.sender_name as sender_full_name,
             n.sender_photo as sender_profile_photo
      FROM notifications n
      WHERE n.user_id = $1 
      ORDER BY n.created_at DESC 
      LIMIT 50
    `, [userId]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching user notifications:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get notifications for admin/global
app.get('/api/notifications', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT n.*, 
             n.sender_name as sender_full_name,
             n.sender_photo as sender_profile_photo
      FROM notifications n
      WHERE n.user_id IS NULL 
      ORDER BY n.created_at DESC 
      LIMIT 50
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: err.message });
  }
});

// Mark notification as read
app.patch('/api/notifications/:id/read', async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET is_read = TRUE WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error marking notification as read:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get employee by employee_id (for Flutter)
app.get('/api/employees/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    console.log('Fetching employee profile for ID:', employeeId);
    
    const result = await pool.query(
      'SELECT * FROM employees WHERE LOWER(employee_id) = LOWER($1)',
      [employeeId]
    );
    
    if (result.rows.length === 0) {
      console.log('Employee not found for ID:', employeeId);
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    const employee = result.rows[0];
    console.log('Employee data found:', {
      employee_id: employee.employee_id,
      full_name: employee.full_name,
      current_posting: employee.current_posting,
      designation: employee.designation,
      email: employee.email
    });
    
    res.json(employee);
  } catch (err) {
    console.error('Error fetching employee:', err);
    res.status(500).json({ error: err.message });
  }
});

// Upload profile photo
app.post('/api/employees/upload_profile_photo', uploadProfilePhoto.single('photo'), async (req, res) => {
  try {
    const { employee_id } = req.body;
    if (!employee_id) {
      return res.status(400).json({ error: 'Employee ID is required' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const profilePhotoUrl = `/uploads/profile_photos/${req.file.filename}`;

    // Get the old photo filename (if any)
    const oldPhotoResult = await pool.query(
      'SELECT profile_photo FROM employees WHERE employee_id = $1',
      [employee_id]
    );
    if (oldPhotoResult.rows.length > 0 && oldPhotoResult.rows[0].profile_photo) {
      const oldPhotoPath = oldPhotoResult.rows[0].profile_photo;
      // Only delete if the old photo is not the same as the new one and is not null/empty
      if (oldPhotoPath && oldPhotoPath !== profilePhotoUrl) {
        const fullOldPath = path.join(__dirname, oldPhotoPath.replace(/^\//, ''));
        // Only delete if file exists and is not used by any other user
        try {
          // Check if any other user is using this photo
          const otherUserResult = await pool.query(
            'SELECT COUNT(*) FROM employees WHERE profile_photo = $1 AND employee_id != $2',
            [oldPhotoPath, employee_id]
          );
          if (parseInt(otherUserResult.rows[0].count) === 0 && fs.existsSync(fullOldPath)) {
            fs.unlinkSync(fullOldPath);
          }
        } catch (e) {
          console.error('Error deleting old profile photo:', e);
        }
      }
    }

    // Save the new photo URL to the database
    await pool.query(
      'UPDATE employees SET profile_photo = $1 WHERE employee_id = $2',
      [profilePhotoUrl, employee_id]
    );

    res.json({
      success: true,
      message: 'Profile photo uploaded and saved successfully',
      url: profilePhotoUrl
    });
  } catch (err) {
    console.error('Error uploading profile photo:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete profile photo
app.delete('/api/employees/:employeeId/profile-photo', async (req, res) => {
  try {
    const { employeeId } = req.params;

    // Get the current photo path
    const photoResult = await pool.query(
      'SELECT profile_photo FROM employees WHERE employee_id = $1',
      [employeeId]
    );

    if (photoResult.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const currentPhotoPath = photoResult.rows[0].profile_photo;

    // Remove photo from database
    await pool.query(
      'UPDATE employees SET profile_photo = NULL WHERE employee_id = $1',
      [employeeId]
    );

    // Delete physical file if it exists and no other user is using it
    if (currentPhotoPath) {
      try {
        // Check if any other user is using this photo
        const otherUserResult = await pool.query(
          'SELECT COUNT(*) FROM employees WHERE profile_photo = $1',
          [currentPhotoPath]
        );
        
        if (parseInt(otherUserResult.rows[0].count) === 0) {
          const fullPhotoPath = path.join(__dirname, currentPhotoPath.replace(/^\//, ''));
          if (fs.existsSync(fullPhotoPath)) {
            fs.unlinkSync(fullPhotoPath);
          }
        }
      } catch (e) {
        console.error('Error deleting profile photo file:', e);
      }
    }

    res.json({
      success: true,
      message: 'Profile photo removed successfully'
    });
  } catch (err) {
    console.error('Error removing profile photo:', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH profile photo for employee (for React admin panel)
app.patch('/api/employees/:employeeId/profile-photo', uploadProfilePhoto.single('profile_photo'), async (req, res) => {
  try {
    const { employeeId } = req.params;
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const profilePhotoUrl = `/uploads/profile_photos/${req.file.filename}`;

    // Get the old photo filename (if any)
    const oldPhotoResult = await pool.query(
      'SELECT profile_photo FROM employees WHERE employee_id = $1',
      [employeeId]
    );
    if (oldPhotoResult.rows.length > 0 && oldPhotoResult.rows[0].profile_photo) {
      const oldPhotoPath = oldPhotoResult.rows[0].profile_photo;
      if (oldPhotoPath && oldPhotoPath !== profilePhotoUrl) {
        const fullOldPath = path.join(__dirname, oldPhotoPath.replace(/^\//, ''));
        try {
          const otherUserResult = await pool.query(
            'SELECT COUNT(*) FROM employees WHERE profile_photo = $1 AND employee_id != $2',
            [oldPhotoPath, employeeId]
          );
          if (parseInt(otherUserResult.rows[0].count) === 0 && fs.existsSync(fullOldPath)) {
            fs.unlinkSync(fullOldPath);
          }
        } catch (e) {
          console.error('Error deleting old profile photo:', e);
        }
      }
    }

    // Save the new photo URL to the database
    await pool.query(
      'UPDATE employees SET profile_photo = $1 WHERE employee_id = $2',
      [profilePhotoUrl, employeeId]
    );

    // Build absolute URL for frontend
    const fullUrl = `${req.protocol}://${req.get('host')}${profilePhotoUrl}`;

    res.json({
      profile_photo: fullUrl
    });
  } catch (err) {
    console.error('Error uploading profile photo (PATCH):', err);
    res.status(500).json({ error: err.message });
  }
});

// Get leave suggestions for the apply leave form
app.get('/api/leave-suggestions', async (req, res) => {
  try {
    // Return a list of common leave reasons
    const suggestions = [
      'Personal work',
      'Medical appointment',
      'Family function',
      'Emergency',
      'Wedding',
      'Travel',
      'Mental health day',
      'Religious observance',
      'Child care',
      'Home maintenance',
      'Legal matters',
      'Educational purpose',
      'Sports event',
      'Cultural event',
      'Volunteer work'
    ];
    res.json(suggestions);
  } catch (err) {
    console.error('Error fetching leave suggestions:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get user leave stats
app.get('/api/user/leave-stats', async (req, res) => {
  try {
    const { employee_id } = req.query;
    if (!employee_id) {
      return res.status(400).json({ error: 'Employee ID is required' });
    }

    // Get total leaves
    const totalResult = await pool.query(
      'SELECT COUNT(*) as total FROM leaves WHERE employee_id = $1',
      [employee_id]
    );

    // Get approved leaves
    const approvedResult = await pool.query(
      'SELECT COUNT(*) as approved FROM leaves WHERE employee_id = $1 AND status = $2',
      [employee_id, 'Approved']
    );

    // Get pending leaves
    const pendingResult = await pool.query(
      'SELECT COUNT(*) as pending FROM leaves WHERE employee_id = $1 AND status = $2',
      [employee_id, 'Pending']
    );

    // Get rejected leaves
    const rejectedResult = await pool.query(
      'SELECT COUNT(*) as rejected FROM leaves WHERE employee_id = $1 AND status = $2',
      [employee_id, 'Rejected']
    );

    res.json({
      total: parseInt(totalResult.rows[0].total),
      approved: parseInt(approvedResult.rows[0].approved),
      pending: parseInt(pendingResult.rows[0].pending),
      rejected: parseInt(rejectedResult.rows[0].rejected),
    });
  } catch (err) {
    console.error('Error fetching leave stats:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get user settings
app.get('/api/user/settings', async (req, res) => {
  try {
    const { employee_id } = req.query;
    if (!employee_id) {
      return res.status(400).json({ error: 'Employee ID is required' });
    }

    // For now, return default settings since we don't have a settings table
    res.json({
      pushNotifications: true,
      emailAlerts: true,
      leaveReminders: true,
      biometricAuth: false,
      theme: 'System',
      dateFormat: 'DD/MM/YYYY',
      language: 'English',
      sessionTimeout: 30,
    });
  } catch (err) {
    console.error('Error fetching user settings:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update user settings
app.put('/api/user/settings', async (req, res) => {
  try {
    const { employee_id, ...settings } = req.body;
    if (!employee_id) {
      return res.status(400).json({ error: 'Employee ID is required' });
    }

    // For now, just return success since we don't have a settings table
    res.json({
      success: true,
      message: 'Settings updated successfully',
      settings: settings,
    });
  } catch (err) {
    console.error('Error updating user settings:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get HR contact information
app.get('/api/hr/contact', async (req, res) => {
  try {
    res.json({
      department: 'Human Resources',
      email: 'hr@buidco.com',
      phone: '+91 8002659674',
      officeHours: '9:00 AM - 6:00 PM (IST)',
      address: 'BUIDCO Office, Patna, Bihar',
      emergencyContact: '+91 8002659674',
    });
  } catch (err) {
    console.error('Error fetching HR contact:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get company policies
app.get('/api/company/policies', async (req, res) => {
  try {
    res.json({
      casualLeave: {
        name: 'Casual Leave (CL)',
        daysPerYear: 16,
        description: 'For personal and family matters',
        approvalRequired: true,
        advanceNotice: '3 days'
      },
      earnedLeave: {
        name: 'Earned Leave (EL)',
        daysPerYear: 18,
        description: 'Accumulated leave based on service',
        approvalRequired: true,
        advanceNotice: '7 days'
      },
      restrictedHoliday: {
        name: 'Restricted Holiday (RH)',
        daysPerYear: 3,
        description: 'For religious and cultural observances',
        approvalRequired: true,
        advanceNotice: '1 day'
      },
      sickLeave: {
        name: 'Sick Leave',
        daysPerYear: 15,
        description: 'For medical emergencies',
        approvalRequired: false,
        advanceNotice: 'Same day'
      }
    });
  } catch (err) {
    console.error('Error fetching company policies:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update user password
app.put('/api/user/password', async (req, res) => {
  try {
    const { employee_id, currentPassword, newPassword } = req.body;
    if (!employee_id || !currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Employee ID, current password, and new password are required' });
    }

    // First verify current password
    const userResult = await pool.query(
      'SELECT password FROM employees WHERE employee_id = $1',
      [employee_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const currentStoredPassword = userResult.rows[0].password;
    if (currentStoredPassword !== currentPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Update password
    await pool.query(
      'UPDATE employees SET password = $1 WHERE employee_id = $2',
      [newPassword, employee_id]
    );

    res.json({ 
      success: true, 
      message: 'Password updated successfully' 
    });
  } catch (err) {
    console.error('Error updating password:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update employee profile
app.put('/api/employees/profile', async (req, res) => {
  try {
    const { employee_id, full_name, email, phone, department, designation } = req.body;
    if (!employee_id) {
      return res.status(400).json({ error: 'Employee ID is required' });
    }

    // Build dynamic update query
    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;

    if (full_name !== undefined) {
      updateFields.push(`full_name = $${paramCount++}`);
      updateValues.push(full_name);
    }
    if (email !== undefined) {
      updateFields.push(`email = $${paramCount++}`);
      updateValues.push(email);
    }
    if (phone !== undefined) {
      updateFields.push(`mobile_number = $${paramCount++}`);
      updateValues.push(phone);
    }
    if (department !== undefined) {
      updateFields.push(`current_posting = $${paramCount++}`);
      updateValues.push(department);
    }
    if (designation !== undefined) {
      updateFields.push(`designation = $${paramCount++}`);
      updateValues.push(designation);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateValues.push(employee_id);
    const query = `
      UPDATE employees 
      SET ${updateFields.join(', ')} 
      WHERE employee_id = $${paramCount} 
      RETURNING *
    `;

    const result = await pool.query(query, updateValues);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      employee: result.rows[0]
    });
  } catch (err) {
    console.error('Error updating employee profile:', err);
    res.status(500).json({ error: err.message });
  }
});

// Cancel approved leave request
// Cancel approved leave request (clean, no duplicate status/cancellation fields)
app.post('/api/leaves/cancel-approved', async (req, res) => {
  try {
    const { leave_id, employee_id, cancel_reason } = req.body;
    if (!leave_id || !employee_id) {
      return res.status(400).json({ error: 'Leave ID and Employee ID are required' });
    }

    // Check if the leave exists and is approved
    const leaveCheck = await pool.query(
      'SELECT * FROM leaves WHERE id::text = $1 AND employee_id = $2 AND status = $3',
      [leave_id, employee_id, 'Approved']
    );
    if (leaveCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Leave not found or not approved. Only approved leaves can be cancelled.' });
    }
    const leave = leaveCheck.rows[0];
    const leaveStartDate = new Date(leave.start_date);
    const today = new Date();

    // 12 hour expiry logic
    const approvedDate = leave.approved_date ? new Date(leave.approved_date) : null;
    if (!approvedDate) {
      return res.status(400).json({ error: 'Leave does not have an approved date.' });
    }
    const diffHours = (today - approvedDate) / (1000 * 60 * 60);
    if (diffHours > 12) {
      return res.status(400).json({ error: 'Cancellation window expired (12 hours passed).' });
    }

    // Check if leave has already started
    if (leaveStartDate <= today) {
      return res.status(400).json({ error: 'Cannot cancel leave that has already started or passed' });
    }

    // Update leave status to cancelled (no extra status fields)
    const result = await pool.query(
      `UPDATE leaves 
       SET status = 'Cancelled', 
           remarks = $1,
           cancelled_date = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id::text = $2 AND employee_id = $3 
       RETURNING *`,
      [cancel_reason || 'Cancelled by employee', leave_id, employee_id]
    );
    if (result.rows.length === 0) {
      return res.status(500).json({ error: 'Failed to cancel leave' });
    }

    // Restore leave balance
    let balanceColumn = '';
    switch ((leave.type || '').toUpperCase()) {
      case 'CL': balanceColumn = 'cl_balance'; break;
      case 'EL': balanceColumn = 'el_balance'; break;
      case 'RH': balanceColumn = 'rh_balance'; break;
    }
    if (balanceColumn) {
      await pool.query(
        `UPDATE employees SET ${balanceColumn} = ${balanceColumn} + $1 WHERE employee_id = $2`,
        [leave.days, employee_id]
      );
    }

    // Create notification for manager
    await pool.query(
      `INSERT INTO notifications (type, message, user_id, sender_id, created_at) 
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [
        'leave_cancelled',
        `Leave request ${leave_id} has been cancelled by employee ${employee_id}`,
        leave.manager_id || 1,
        employee_id
      ]
    );

    res.json({
      success: true,
      message: 'Leave cancelled successfully',
      leave: result.rows[0],
      balanceRestored: !!balanceColumn
    });
  } catch (err) {
    console.error('Error cancelling approved leave:', err);
    res.status(500).json({ error: err.message });
  }
});

// Upload document for a leave
app.post('/api/leaves/:id/upload-document', uploadLeaveDoc.single('document'), async (req, res) => {
  try {
    const leaveId = req.params.id;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const fileUrl = `/uploads/leave_docs/${req.file.filename}`;
    const { originalname, size } = req.file;
    const result = await pool.query(
      'INSERT INTO leave_documents (leave_id, file_name, file_url, file_size) VALUES ($1, $2, $3, $4) RETURNING *',
      [leaveId, originalname, fileUrl, size]
    );
    res.json({ success: true, document: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update leave details API to include documents
app.get('/api/leaves/:id/details', async (req, res) => {
  try {
    const leaveResult = await pool.query('SELECT * FROM leaves WHERE id::text = $1', [req.params.id]);
    if (leaveResult.rows.length === 0) return res.status(404).json({ error: 'Leave not found' });
    const leave = leaveResult.rows[0];
    const docsResult = await pool.query('SELECT file_name, file_url, file_size, upload_date FROM leave_documents WHERE leave_id = $1', [req.params.id]);
    leave.documents = docsResult.rows;
    res.json(leave);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all employees with debugging info
app.get('/api/employees/debug', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        employee_id, 
        full_name, 
        current_posting, 
        designation, 
        email,
        status
      FROM employees 
      ORDER BY employee_id
    `);
    
    console.log('All employees data:', result.rows);
    res.json({
      count: result.rows.length,
      employees: result.rows
    });
  } catch (err) {
    console.error('Error fetching all employees:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update employee name and posting (for fixing data)
app.patch('/api/employees/:employeeId/fix-data', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { full_name, current_posting } = req.body;
    
    if (!full_name || !current_posting) {
      return res.status(400).json({ 
        error: 'Both full_name and current_posting are required' 
      });
    }
    
    const result = await pool.query(
      `UPDATE employees 
       SET full_name = $1, current_posting = $2 
       WHERE LOWER(employee_id) = LOWER($3) 
       RETURNING employee_id, full_name, current_posting`,
      [full_name, current_posting, employeeId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    console.log('Updated employee data:', result.rows[0]);
    res.json({
      success: true,
      message: 'Employee data updated successfully',
      employee: result.rows[0]
    });
  } catch (err) {
    console.error('Error updating employee data:', err);
    res.status(500).json({ error: err.message });
  }
});

// Clear all notifications for a user
app.delete('/api/notifications/:userId/clear', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log('Clear notifications for userId:', userId);
    const result = await pool.query('DELETE FROM notifications WHERE user_id = $1', [userId]);
    console.log('Rows deleted:', result.rowCount);
    res.json({ success: true, message: 'All notifications cleared' });
  } catch (err) {
    console.error('Error clearing notifications:', err);
    res.status(500).json({ error: err.message });
  }
});

// Test endpoint to create notification with sender information
app.post('/api/notifications/test', async (req, res) => {
  try {
    const { message, user_id, sender_id } = req.body;
    
    // Get sender information
    let senderInfo = { full_name: 'System', profile_photo: null };
    if (sender_id) {
      const senderResult = await pool.query(
        'SELECT full_name, profile_photo FROM employees WHERE employee_id = $1',
        [sender_id]
      );
      if (senderResult.rows.length > 0) {
        senderInfo = senderResult.rows[0];
      }
    }
    
    const result = await pool.query(
      `INSERT INTO notifications (type, message, user_id, sender_id, created_at) 
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) 
       RETURNING *`,
      ['test', message, user_id, sender_id]
    );
    
    res.json({
      success: true,
      notification: result.rows[0]
    });
  } catch (err) {
    console.error('Error creating test notification:', err);
    res.status(500).json({ error: err.message });
  }
});

// Health check endpoint for Render
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'BLMS Backend'
  });
});

// Start server
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on port ${port}`);
  console.log('Database:', pool ? 'Connected' : 'Not connected');
  console.log('Environment:', process.env.NODE_ENV || 'development');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    if (pool) {
      pool.end();
    }
  });
});