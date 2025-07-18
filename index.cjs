// Robust module loading with Express router fix
let express, cors, multer, path, fs;

try {
  // Clear module cache to prevent conflicts
  delete require.cache[require.resolve('express')];
  
  express = require('express');
  cors = require('cors');
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
    database: process.env.DB_SERVER ? 'SQL Server Configured' : 'Not configured',
    timestamp: new Date().toISOString()
  });
});

const { pool, connect } = require('./db');
const sql = require('mssql');

// On server start, call connect with retry
connect().catch(err => {
  console.error('❌ Failed to connect to database after retries:', err.message);
});

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
  // Skip table creation if SQL Server config is not set
  if (!process.env.DB_SERVER && !process.env.DB_NAME) {
    console.log('⚠️ SQL Server configuration not set, skipping table creation');
    console.log('📋 Please set DB_SERVER, DB_NAME, DB_USER, DB_PASSWORD in environment variables');
    return false;
  }

  try {
    console.log('🔧 Attempting to create/check database tables...');
    
    // Create employees table if it doesn't exist
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='employees' AND xtype='U')
      CREATE TABLE employees (
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
        cl_balance INT DEFAULT 16,
        rh_balance INT DEFAULT 3,
        el_balance INT DEFAULT 18,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
      )
    `);

    // Update existing employees CL balance from 10 to 16
    await pool.request().query(`
      UPDATE employees SET cl_balance = 16 WHERE cl_balance = 10
    `);

    console.log('✅ Updated existing employees CL balance from 10 to 16');

    // Create leaves table if it doesn't exist
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='leaves' AND xtype='U')
      CREATE TABLE leaves (
        id INT IDENTITY(1,1) PRIMARY KEY,
        employee_id VARCHAR(50) NOT NULL,
        employee_name VARCHAR(255) NOT NULL,
        type VARCHAR(10) NOT NULL CHECK (type IN ('CL', 'EL', 'RH', 'SL')),
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        days INT NOT NULL,
        reason TEXT,
        status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Cancelled')),
        applied_on DATETIME DEFAULT GETDATE(),
        approved_date DATETIME,
        rejected_date DATETIME,
        cancelled_date DATETIME,
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
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='notifications' AND xtype='U')
      CREATE TABLE notifications (
        id INT IDENTITY(1,1) PRIMARY KEY,
        type VARCHAR(50),
        message TEXT,
        is_read BIT DEFAULT 0,
        created_at DATETIME DEFAULT GETDATE(),
        user_id VARCHAR(50),
        sender_id VARCHAR(50),
        sender_name VARCHAR(255),
        sender_photo TEXT
      )
    `);

    // Create leave_documents table if it doesn't exist
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='leave_documents' AND xtype='U')
      CREATE TABLE leave_documents (
        id INT IDENTITY(1,1) PRIMARY KEY,
        leave_id INT NOT NULL,
        file_name TEXT,
        file_url TEXT,
        file_size INT,
        upload_date DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (leave_id) REFERENCES leaves(id) ON DELETE CASCADE
      )
    `);

    console.log('✅ All tables created/verified successfully');
    return true;
  } catch (err) {
    if (err.code === 'ENETUNREACH' || err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
      console.log('🌐 Database connection issue - this is normal during deployment startup');
      console.log('💡 SQL Server service may still be initializing, retrying later...');
    } else if (err.code === '42501') {
      console.log('🔒 Permission denied - tables may already exist');
    } else {
      console.error('❌ Error creating tables:', err.message);
    }
    return false;
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
        const userCount = await pool.request().query('SELECT COUNT(*) as count FROM employees');
        if (parseInt(userCount.recordset[0].count) === 0) {
          await pool.request().query(`
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
  // Skip if SQL Server config is not set
  if (!process.env.DB_SERVER && !process.env.DB_NAME) {
    console.log('⚠️ SQL Server configuration not set, skipping balance column check');
    return;
  }

  try {
    // Check if leaves table exists first
    const tableExists = await pool.request().query(`
      SELECT CASE WHEN EXISTS (SELECT * FROM sysobjects WHERE name='leaves' AND xtype='U') THEN 1 ELSE 0 END as table_exists
    `);

    if (!tableExists.recordset[0].table_exists) {
      console.log('ℹ️ Leaves table does not exist yet, skipping column additions');
      return;
    }

    await pool.request().query(`
      -- Add designation column to leaves table if it doesn't exist
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('leaves') AND name = 'designation')
        ALTER TABLE leaves ADD designation VARCHAR(255);

      -- Update existing leaves with designation from employees
      UPDATE leaves 
      SET designation = e.designation 
      FROM employees e 
      WHERE leaves.employee_id = e.employee_id 
      AND leaves.designation IS NULL;
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
  // Skip if SQL Server config is not set
  if (!process.env.DB_SERVER && !process.env.DB_NAME) {
    console.log('⚠️ SQL Server configuration not set, skipping additional table creation');
    return;
  }

  try {
    // This is redundant since notifications table is created in createTables(),
    // but keeping for safety
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='notifications' AND xtype='U')
      CREATE TABLE notifications (
        id INT IDENTITY(1,1) PRIMARY KEY,
        type VARCHAR(50),
        message TEXT,
        is_read BIT DEFAULT 0,
        created_at DATETIME DEFAULT GETDATE(),
        user_id VARCHAR(50),
        sender_id VARCHAR(50),
        sender_name VARCHAR(255),
        sender_photo TEXT
      )
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
    await pool.request().query(
      'UPDATE employees SET el_balance = 18 WHERE el_balance != 18 OR el_balance IS NULL'
    );
    const result = await pool.request().query(
      'SELECT employee_id, el_balance FROM employees WHERE el_balance = 18'
    );
    res.json({ 
      success: true, 
      message: `Updated ${result.recordset.length} employees' earned leave balance to 18`,
      updatedEmployees: result.recordset
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
    await pool.request().query(
      'UPDATE employees SET cl_balance = 16 WHERE cl_balance != 16 OR cl_balance IS NULL'
    );
    const result = await pool.request().query(
      'SELECT employee_id, cl_balance FROM employees WHERE cl_balance = 16'
    );
    res.json({ 
      success: true, 
      message: `Updated ${result.recordset.length} employees' casual leave balance to 16`,
      updatedEmployees: result.recordset
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
    const result = await pool.request()
      .input('employeeId', sql.VarChar, employeeId)
      .query('DELETE FROM employees OUTPUT DELETED.* WHERE employee_id = @employeeId');
    if (!result.recordset.length) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    res.json({ success: true, employee: result.recordset[0] });
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
    const inputs = [];
    let paramCount = 1;

    if (full_name !== undefined) {
      updateFields.push(`full_name = @param${paramCount}`);
      inputs.push({ name: `param${paramCount++}`, type: sql.VarChar, value: full_name });
    }
    if (email !== undefined) {
      updateFields.push(`email = @param${paramCount}`);
      inputs.push({ name: `param${paramCount++}`, type: sql.VarChar, value: email });
    }
    if (mobile_number !== undefined) {
      updateFields.push(`mobile_number = @param${paramCount}`);
      inputs.push({ name: `param${paramCount++}`, type: sql.VarChar, value: mobile_number });
    }
    if (designation !== undefined) {
      updateFields.push(`designation = @param${paramCount}`);
      inputs.push({ name: `param${paramCount++}`, type: sql.VarChar, value: designation });
    }
    if (role !== undefined) {
      updateFields.push(`role = @param${paramCount}`);
      inputs.push({ name: `param${paramCount++}`, type: sql.VarChar, value: role });
    }
    if (joining_date !== undefined) {
      updateFields.push(`joining_date = @param${paramCount}`);
      inputs.push({ name: `param${paramCount++}`, type: sql.Date, value: joining_date });
    }
    if (current_posting !== undefined) {
      updateFields.push(`current_posting = @param${paramCount}`);
      inputs.push({ name: `param${paramCount++}`, type: sql.VarChar, value: current_posting });
    }
    if (password !== undefined && password.trim() !== '') {
      updateFields.push(`password = @param${paramCount}`);
      inputs.push({ name: `param${paramCount++}`, type: sql.VarChar, value: password });
    }
    if (status !== undefined) {
      updateFields.push(`status = @param${paramCount}`);
      inputs.push({ name: `param${paramCount++}`, type: sql.VarChar, value: status });
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Add employeeId as last param
    inputs.push({ name: `param${paramCount}`, type: sql.VarChar, value: employeeId });
    const setClause = updateFields.join(', ');
    const query = `
      UPDATE employees 
      SET ${setClause} 
      OUTPUT INSERTED.*
      WHERE employee_id = @param${paramCount}
    `;
    let request = pool.request();
    for (const inp of inputs) {
      request = request.input(inp.name, inp.type, inp.value);
    }
    const result = await request.query(query);
    if (!result.recordset.length) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json({
      success: true,
      message: 'Profile updated successfully',
      employee: result.recordset[0]
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
    const inputs = [];
    let paramCount = 1;

    if (cl_balance !== undefined) {
      updateFields.push(`cl_balance = @param${paramCount}`);
      inputs.push({ name: `param${paramCount++}`, type: sql.Int, value: cl_balance });
    }
    if (rh_balance !== undefined) {
      updateFields.push(`rh_balance = @param${paramCount}`);
      inputs.push({ name: `param${paramCount++}`, type: sql.Int, value: rh_balance });
    }
    if (el_balance !== undefined) {
      updateFields.push(`el_balance = @param${paramCount}`);
      inputs.push({ name: `param${paramCount++}`, type: sql.Int, value: el_balance });
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No leave balance fields to update' });
    }

    // Add employeeId as last param
    inputs.push({ name: `param${paramCount}`, type: sql.VarChar, value: employeeId });
    const setClause = updateFields.join(', ');
    const query = `
      UPDATE employees 
      SET ${setClause} 
      OUTPUT INSERTED.*
      WHERE employee_id = @param${paramCount}
    `;
    let request = pool.request();
    for (const inp of inputs) {
      request = request.input(inp.name, inp.type, inp.value);
    }
    const result = await request.query(query);
    if (!result.recordset.length) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json(result.recordset[0]);
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
    const result = await pool.request()
      .input('loginId', sql.VarChar, loginId)
      .input('password', sql.VarChar, password)
      .query(`SELECT * FROM employees WHERE (email = @loginId OR employee_id = @loginId) AND password = @password AND status = 'Active'`);
    if (result.recordset.length > 0) {
      const user = result.recordset[0];
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
    if (!designation) {
      return res.status(400).json({ error: 'Designation is required' });
    }
    const result = await pool.request()
      .input('employee_id', sql.VarChar, employee_id)
      .input('full_name', sql.VarChar, full_name)
      .input('email', sql.VarChar, email)
      .input('mobile_number', sql.VarChar, mobile_number)
      .input('designation', sql.VarChar, designation)
      .input('role', sql.VarChar, role)
      .input('joining_date', sql.Date, joining_date)
      .input('current_posting', sql.VarChar, current_posting)
      .input('password', sql.VarChar, password)
      .input('status', sql.VarChar, status)
      .query(`INSERT INTO employees
        (employee_id, full_name, email, mobile_number, designation, role, joining_date, current_posting, password, status, cl_balance, rh_balance, el_balance)
        OUTPUT INSERTED.*
        VALUES (@employee_id, @full_name, @email, @mobile_number, @designation, @role, @joining_date, @current_posting, @password, @status, 16, 3, 18)`);
    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all employees
app.get('/api/employees', async (req, res) => {
  try {
    const { employee_id } = req.query;
    if (employee_id) {
      const result = await pool.request()
        .input('employee_id', sql.VarChar, employee_id)
        .query('SELECT * FROM employees WHERE employee_id = @employee_id');
      return res.json(result.recordset);
    }
    const result = await pool.request().query(`
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
    res.setHeader('Content-Type', 'application/json');
    res.json(result.recordset);
  } catch (err) {
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
    let days = 0;
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      days = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
    }
    // Get employee details including designation
    const empResult = await pool.request()
      .input('employeeId', sql.VarChar, employeeId)
      .query('SELECT full_name, designation, profile_photo FROM employees WHERE employee_id = @employeeId');
    if (!empResult.recordset.length) {
      console.error('Employee not found for employeeId:', employeeId);
      return res.status(404).json({ error: 'Employee not found' });
    }
    const { full_name: employeeName, designation, profile_photo } = empResult.recordset[0];
    if (!designation) {
      console.error('Employee designation not found for employeeId:', employeeId);
      return res.status(400).json({ error: 'Employee designation not found' });
    }
    const result = await pool.request()
      .input('employee_id', sql.VarChar, employeeId)
      .input('employee_name', sql.VarChar, employeeName)
      .input('type', sql.VarChar, type)
      .input('start_date', sql.Date, startDate)
      .input('end_date', sql.Date, endDate)
      .input('days', sql.Int, days)
      .input('reason', sql.VarChar, reason)
      .input('status', sql.VarChar, 'Pending')
      .input('applied_on', sql.DateTime, new Date())
      .input('location', sql.VarChar, location)
      .input('designation', sql.VarChar, designation)
      .query(`INSERT INTO leaves (employee_id, employee_name, type, start_date, end_date, days, reason, status, applied_on, location, designation)
        OUTPUT INSERTED.*
        VALUES (@employee_id, @employee_name, @type, @start_date, @end_date, @days, @reason, @status, @applied_on, @location, @designation)`);
    // Add notification for admin with sender information
    await pool.request()
      .input('type', sql.VarChar, 'New Leave Request')
      .input('message', sql.VarChar, `New leave request from ${employeeName} (${employeeId}) for ${type} from ${startDate} to ${endDate}.`)
      .input('sender_id', sql.VarChar, employeeId)
      .input('sender_name', sql.VarChar, employeeName + ' [' + (req.headers['x-source'] === 'app' ? 'App' : 'Web') + ']')
      .input('sender_photo', sql.VarChar, profile_photo || null)
      .query(`INSERT INTO notifications (type, message, user_id, sender_id, sender_name, created_at, sender_photo)
        VALUES (@type, @message, NULL, @sender_id, @sender_name, GETDATE(), @sender_photo)`);
    res.json(result.recordset[0]);
  } catch (err) {
    console.error('Error in POST /api/leaves:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get all leave requests
app.get('/api/leaves', async (req, res) => {
  try {
    const result = await pool.request().query(`
      SELECT 
        l.*, 
        ISNULL(l.designation, e.designation) as designation,
        e.designation as employee_designation
      FROM leaves l 
      LEFT JOIN employees e ON l.employee_id = e.employee_id 
      ORDER BY l.applied_on DESC
    `);
    const transformedData = result.recordset.map(row => {
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
    res.status(500).json({ error: err.message });
  }
});

// Get leave requests for specific employee
app.get('/api/leaves/:employeeId', async (req, res) => {
  try {
    const { status } = req.query;
    const result = await pool.request()
      .input('employeeId', sql.VarChar, req.params.employeeId)
      .query(`SELECT l.*, COALESCE(l.designation, e.designation) as designation FROM leaves l LEFT JOIN employees e ON l.employee_id = e.employee_id WHERE l.employee_id = @employeeId ORDER BY l.applied_on DESC`);
    let leaves = result.recordset;
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
        icon: '',
        designation: leave.designation || '',
        remarks: leave.remarks || '',
        approvedDate: leave.approved_date || '',
        rejectedDate: leave.rejected_date || '',
        cancelledDate: leave.cancelled_date || '',
        location: leave.location || '',
      };
    });
    mapped.sort((a, b) => new Date(b.appliedDate) - new Date(a.appliedDate));
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Approve leave request
// Approve leave request (robust, single implementation)
app.patch('/api/leaves/:id/approve', async (req, res) => {
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();
    
    // Get leave details
    const leaveResult = await transaction.request()
      .input('id', sql.Int, req.params.id)
      .query(`
        SELECT l.*, e.designation 
        FROM leaves l
        JOIN employees e ON l.employee_id = e.employee_id
        WHERE l.id = @id
      `);
    
    if (leaveResult.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Leave not found' });
    }
    
    const leave = leaveResult.recordset[0];
    
    // Robust status check (case-insensitive)
    if (typeof leave.status === 'string' && leave.status.trim().toLowerCase() === 'approved') {
      await transaction.rollback();
      return res.status(400).json({ error: 'Leave already approved' });
    }
    
    // Check leave balance
    const balanceColumn = {
      'CL': 'cl_balance',
      'EL': 'el_balance',
      'RH': 'rh_balance'
    }[leave.type];
    
    if (!balanceColumn) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Invalid leave type' });
    }
    
    const employeeResult = await transaction.request()
      .input('employee_id', sql.VarChar, leave.employee_id)
      .query(`SELECT ${balanceColumn} FROM employees WHERE employee_id = @employee_id`);
    
    if (employeeResult.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    const currentBalance = employeeResult.recordset[0][balanceColumn];
    if (currentBalance < leave.days) {
      await transaction.rollback();
      return res.status(400).json({ 
        error: `Insufficient ${leave.type} balance` 
      });
    }
    
    // Update leave status
    const updateResult = await transaction.request()
      .input('id', sql.Int, req.params.id)
      .query(`
        UPDATE leaves 
        SET status = 'Approved', approved_date = GETDATE() 
        OUTPUT INSERTED.*
        WHERE id = @id
      `);
    
    // Deduct leave balance
    await transaction.request()
      .input('days', sql.Int, leave.days)
      .input('employee_id', sql.VarChar, leave.employee_id)
      .query(`
        UPDATE employees 
        SET ${balanceColumn} = ${balanceColumn} - @days 
        WHERE employee_id = @employee_id
      `);
    
    // Notify employee about approval
    const empInfo = await transaction.request()
      .input('employee_id', sql.VarChar, leave.employee_id)
      .query('SELECT full_name, profile_photo FROM employees WHERE employee_id = @employee_id');
    
    let empName = empInfo.recordset[0]?.full_name || 'Employee';
    const empPhoto = empInfo.recordset[0]?.profile_photo || null;
    const source = req.headers['x-source'] === 'app' ? 'App' : 'Web';
    
    if (!/\[(App|Web)\]$/.test(empName)) {
      empName = empName + ` [${source}]`;
    }
    
    await transaction.request()
      .input('type', sql.VarChar, 'leave_approved')
      .input('message', sql.VarChar, `Your ${leave.type} leave request from ${leave.start_date} to ${leave.end_date} has been approved.`)
      .input('user_id', sql.VarChar, leave.employee_id)
      .input('sender_id', sql.VarChar, leave.employee_id)
      .input('sender_name', sql.VarChar, empName)
      .input('sender_photo', sql.VarChar, empPhoto)
      .query(`
        INSERT INTO notifications (type, message, user_id, sender_id, sender_name, sender_photo, created_at) 
        VALUES (@type, @message, @user_id, @sender_id, @sender_name, @sender_photo, GETDATE())
      `);
    
    await transaction.commit();
    res.json({ success: true, leave: updateResult.recordset[0] });
  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ 
      error: err.message || 'Failed to approve leave',
      details: err.detail || null,
      stack: err.stack || null
    });
  }
});

// Reject leave request
app.patch('/api/leaves/:id/reject', async (req, res) => {
  try {
    const { remarks } = req.body;
    const result = await pool.request()
      .input('status', sql.VarChar, 'Rejected')
      .input('remarks', sql.VarChar, remarks)
      .input('id', sql.Int, req.params.id)
      .query(`
        UPDATE leaves 
        SET status = @status, remarks = @remarks, rejected_date = GETDATE() 
        OUTPUT INSERTED.*
        WHERE id = @id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }

    const leave = result.recordset[0];
    
    // Notify employee about rejection
    const empInfo = await pool.request()
      .input('employee_id', sql.VarChar, leave.employee_id)
      .query('SELECT full_name, profile_photo FROM employees WHERE employee_id = @employee_id');
    
    let empName = empInfo.recordset[0]?.full_name || 'Employee';
    const empPhoto = empInfo.recordset[0]?.profile_photo || null;
    const source = req.headers['x-source'] === 'app' ? 'App' : 'Web';
    
    if (!/\[(App|Web)\]$/.test(empName)) {
      empName = empName + ` [${source}]`;
    }
    
    await pool.request()
      .input('type', sql.VarChar, 'leave_rejected')
      .input('message', sql.VarChar, `Your ${leave.type} leave request from ${leave.start_date} to ${leave.end_date} has been rejected. ${remarks ? `Reason: ${remarks}` : ''}`)
      .input('user_id', sql.VarChar, leave.employee_id)
      .input('sender_id', sql.VarChar, leave.employee_id)
      .input('sender_name', sql.VarChar, empName)
      .input('sender_photo', sql.VarChar, empPhoto)
      .query(`
        INSERT INTO notifications (type, message, user_id, sender_id, sender_name, sender_photo, created_at) 
        VALUES (@type, @message, @user_id, @sender_id, @sender_name, @sender_photo, GETDATE())
      `);

    res.json({ success: true, leave: result.recordset[0] });
  } catch (err) {
    console.error('Error in reject leave:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Cancel leave request
app.patch('/api/leaves/:id/cancel', async (req, res) => {
  const transaction = new sql.Transaction(pool); 
  try {
    console.log('Starting leave cancellation process for ID:', req.params.id);
    await transaction.begin();

    // Get the leave request details
    console.log('Fetching leave request details...');
    const leaveResult = await transaction.request()
      .input('id', sql.Int, req.params.id)
      .query('SELECT * FROM leaves WHERE id = @id');
    
    console.log('Leave request found:', leaveResult.recordset[0]);

    if (leaveResult.recordset.length === 0) {
      console.log('Leave request not found');
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }

    const leave = leaveResult.recordset[0];
    console.log('Current leave status:', leave.status);

    // Check if leave is already cancelled
    if (leave.status === 'Cancelled') {
      console.log('Leave already cancelled');
      await transaction.rollback();
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
          await transaction.rollback();
          return res.status(400).json({ success: false, message: 'Invalid leave type' });
      }

      // Restore leave balance
      console.log('Restoring balance for column:', balanceColumn);
      await transaction.request()
        .input('days', sql.Int, leave.days)
        .input('employee_id', sql.VarChar, leave.employee_id)
        .query(`
          UPDATE employees 
          SET ${balanceColumn} = ${balanceColumn} + @days 
          WHERE employee_id = @employee_id
        `);
    }

    // Update leave status to cancelled
    console.log('Updating leave status to Cancelled...');
    const updateResult = await transaction.request()
      .input('status', sql.VarChar, 'Cancelled')
      .input('remarks', sql.VarChar, 'Cancelled by employee')
      .input('cancelled_date', sql.DateTime, new Date())
      .input('id', sql.Int, req.params.id)
      .query(`
        UPDATE leaves 
        SET status = @status, remarks = @remarks, cancelled_date = @cancelled_date 
        OUTPUT INSERTED.*
        WHERE id = @id
      `);
    
    console.log('Leave updated:', updateResult.recordset[0]);

    await transaction.commit();
    console.log('Transaction committed successfully');
    res.json({ success: true, leave: updateResult.recordset[0] });
  } catch (err) {
    console.error('Error in cancel leave:', err);
    console.error('Error details:', {
      message: err.message,
      stack: err.stack,
      code: err.code,
      detail: err.detail
    });
    await transaction.rollback();
    res.status(500).json({ success: false, message: err.message });
  }
});

// Request leave cancellation (user side)
// Employee requests cancellation of an approved leave
app.post('/api/leaves/:id/request-cancellation', async (req, res) => {
  try {
    const leaveId = req.params.id;
    const { employee_id, cancel_reason } = req.body;
    
    // Check leave exists and is approved
    const leaveResult = await pool.request()
      .input('leaveId', sql.Int, leaveId)
      .input('employee_id', sql.VarChar, employee_id)
      .query('SELECT * FROM leaves WHERE id = @leaveId AND employee_id = @employee_id');
    
    if (leaveResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Leave not found' });
    }
    
    const leave = leaveResult.recordset[0];
    if ((leave.status || '').toLowerCase() !== 'approved') {
      return res.status(400).json({ error: 'Only approved leaves can be cancelled' });
    }
    
    if ((leave.cancel_request_status || '').toLowerCase() === 'pending') {
      return res.status(400).json({ error: 'Cancellation already requested' });
    }
    
    // Mark leave as cancellation requested
    await pool.request()
      .input('cancel_request_status', sql.VarChar, 'Pending')
      .input('cancel_reason', sql.VarChar, cancel_reason || '')
      .input('leaveId', sql.Int, leaveId)
      .query(`
        UPDATE leaves 
        SET cancel_request_status = @cancel_request_status, cancel_reason = @cancel_reason 
        WHERE id = @leaveId
      `);
    
    // Notify admin/manager with sender information
    const empInfo = await pool.request()
      .input('employee_id', sql.VarChar, employee_id)
      .query('SELECT full_name, profile_photo FROM employees WHERE employee_id = @employee_id');
    
    let empName = empInfo.recordset[0]?.full_name || 'Employee';
    const empPhoto = empInfo.recordset[0]?.profile_photo || null;
    const source = req.headers['x-source'] === 'app' ? 'App' : 'Web';
    
    if (!/\[(App|Web)\]$/.test(empName)) {
      empName = empName + ` [${source}]`;
    }
    
    await pool.request()
      .input('type', sql.VarChar, 'leave_cancellation_requested')
      .input('message', sql.VarChar, `Employee ${employee_id} requested cancellation for leave ${leaveId}`)
      .input('sender_id', sql.VarChar, employee_id)
      .input('sender_name', sql.VarChar, empName)
      .input('sender_photo', sql.VarChar, empPhoto)
      .query(`
        INSERT INTO notifications (type, message, user_id, sender_id, sender_name, sender_photo, created_at) 
        VALUES (@type, @message, NULL, @sender_id, @sender_name, @sender_photo, GETDATE())
      `);
    
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
    const leaveResult = await pool.request()
      .input('leaveId', sql.Int, leaveId)
      .query('SELECT * FROM leaves WHERE id = @leaveId');
    
    if (leaveResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Leave not found' });
    }
    
    const leave = leaveResult.recordset[0];
    if ((leave.cancel_request_status || '').toLowerCase() !== 'pending') {
      return res.status(400).json({ error: 'No pending cancellation request' });
    }
    
    // Set leave as cancelled
    await pool.request()
      .input('status', sql.VarChar, 'Cancelled')
      .input('cancel_request_status', sql.VarChar, 'Approved')
      .input('leaveId', sql.Int, leaveId)
      .query(`
        UPDATE leaves 
        SET status = @status, cancel_request_status = @cancel_request_status, cancelled_date = GETDATE() 
        WHERE id = @leaveId
      `);
    
    // Restore leave balance
    let balanceColumn = '';
    switch ((leave.type || '').toUpperCase()) {
      case 'CL': balanceColumn = 'cl_balance'; break;
      case 'EL': balanceColumn = 'el_balance'; break;
      case 'RH': balanceColumn = 'rh_balance'; break;
    }
    
    if (balanceColumn) {
      await pool.request()
        .input('days', sql.Int, leave.days)
        .input('employee_id', sql.VarChar, leave.employee_id)
        .query(`
          UPDATE employees 
          SET ${balanceColumn} = ${balanceColumn} + @days 
          WHERE employee_id = @employee_id
        `);
    }
    
    // Notify employee with sender information
    const empInfo = await pool.request()
      .input('employee_id', sql.VarChar, leave.employee_id)
      .query('SELECT full_name, profile_photo FROM employees WHERE employee_id = @employee_id');
    
    let empName = empInfo.recordset[0]?.full_name || 'Employee';
    const empPhoto = empInfo.recordset[0]?.profile_photo || null;
    const source = req.headers['x-source'] === 'app' ? 'App' : 'Web';
    
    if (!/\[(App|Web)\]$/.test(empName)) {
      empName = empName + ` [${source}]`;
    }
    
    await pool.request()
      .input('type', sql.VarChar, 'leave_cancellation_approved')
      .input('message', sql.VarChar, `Your leave cancellation for leave ${leaveId} was approved`)
      .input('user_id', sql.VarChar, leave.employee_id)
      .input('sender_id', sql.VarChar, leave.employee_id)
      .input('sender_name', sql.VarChar, empName)
      .input('sender_photo', sql.VarChar, empPhoto)
      .query(`
        INSERT INTO notifications (type, message, user_id, sender_id, sender_name, sender_photo, created_at) 
        VALUES (@type, @message, @user_id, @sender_id, @sender_name, @sender_photo, GETDATE())
      `);
    
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
    const leaveResult = await pool.request()
      .input('leaveId', sql.Int, leaveId)
      .query('SELECT * FROM leaves WHERE id = @leaveId');
    
    if (leaveResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Leave not found' });
    }
    
    const leave = leaveResult.recordset[0];
    if ((leave.cancel_request_status || '').toLowerCase() !== 'pending') {
      return res.status(400).json({ error: 'No pending cancellation request' });
    }
    
    // Revert cancellation request
    await pool.request()
      .input('cancel_request_status', sql.VarChar, 'Rejected')
      .input('cancel_reason', sql.VarChar, remarks || '')
      .input('leaveId', sql.Int, leaveId)
      .query(`
        UPDATE leaves 
        SET cancel_request_status = @cancel_request_status, cancel_reason = @cancel_reason 
        WHERE id = @leaveId
      `);
    
    // Notify employee with sender information
    const empInfo = await pool.request()
      .input('employee_id', sql.VarChar, leave.employee_id)
      .query('SELECT full_name, profile_photo FROM employees WHERE employee_id = @employee_id');
    
    let empName = empInfo.recordset[0]?.full_name || 'Employee';
    const empPhoto = empInfo.recordset[0]?.profile_photo || null;
    const source = req.headers['x-source'] === 'app' ? 'App' : 'Web';
    
    if (!/\[(App|Web)\]$/.test(empName)) {
      empName = empName + ` [${source}]`;
    }
    
    await pool.request()
      .input('type', sql.VarChar, 'leave_cancellation_rejected')
      .input('message', sql.VarChar, `Your leave cancellation for leave ${leaveId} was rejected. ${remarks || ''}`)
      .input('user_id', sql.VarChar, leave.employee_id)
      .input('sender_id', sql.VarChar, leave.employee_id)
      .input('sender_name', sql.VarChar, empName)
      .input('sender_photo', sql.VarChar, empPhoto)
      .query(`
        INSERT INTO notifications (type, message, user_id, sender_id, sender_name, sender_photo, created_at) 
        VALUES (@type, @message, @user_id, @sender_id, @sender_name, @sender_photo, GETDATE())
      `);
    
    res.json({ success: true, message: 'Leave cancellation rejected' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});




// Get notifications for a specific user
app.get('/api/notifications/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.request()
      .input('userId', sql.VarChar, userId)
      .query(`
        SELECT n.*, 
               n.sender_name as sender_full_name,
               n.sender_photo as sender_profile_photo
        FROM notifications n
        WHERE n.user_id = @userId 
        ORDER BY n.created_at DESC 
        OFFSET 0 ROWS FETCH NEXT 50 ROWS ONLY
      `);
    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching user notifications:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get notifications for admin/global
app.get('/api/notifications', async (req, res) => {
  try {
    const result = await pool.request().query(`
      SELECT n.*, 
             n.sender_name as sender_full_name,
             n.sender_photo as sender_profile_photo
      FROM notifications n
      WHERE n.user_id IS NULL 
      ORDER BY n.created_at DESC 
      OFFSET 0 ROWS FETCH NEXT 50 ROWS ONLY
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: err.message });
  }
});

// Mark notification as read
app.patch('/api/notifications/:id/read', async (req, res) => {
  try {
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('UPDATE notifications SET is_read = 1 WHERE id = @id');
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
    const result = await pool.request()
      .input('employeeId', sql.VarChar, employeeId)
      .query('SELECT * FROM employees WHERE LOWER(employee_id) = LOWER(@employeeId)');
    if (!result.recordset.length) {
      console.log('Employee not found for ID:', employeeId);
      return res.status(404).json({ error: 'Employee not found' });
    }
    const employee = result.recordset[0];
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
    const oldPhotoResult = await pool.request()
      .input('employee_id', sql.VarChar, employee_id)
      .query('SELECT profile_photo FROM employees WHERE employee_id = @employee_id');
    
    if (oldPhotoResult.recordset.length > 0 && oldPhotoResult.recordset[0].profile_photo) {
      const oldPhotoPath = oldPhotoResult.recordset[0].profile_photo;
      // Only delete if the old photo is not the same as the new one and is not null/empty
      if (oldPhotoPath && oldPhotoPath !== profilePhotoUrl) {
        const fullOldPath = path.join(__dirname, oldPhotoPath.replace(/^\//, ''));
        // Only delete if file exists and is not used by any other user
        try {
          // Check if any other user is using this photo
          const otherUserResult = await pool.request()
            .input('oldPhotoPath', sql.VarChar, oldPhotoPath)
            .input('employee_id', sql.VarChar, employee_id)
            .query('SELECT COUNT(*) as count FROM employees WHERE profile_photo = @oldPhotoPath AND employee_id != @employee_id');
          
          if (parseInt(otherUserResult.recordset[0].count) === 0 && fs.existsSync(fullOldPath)) {
            fs.unlinkSync(fullOldPath);
          }
        } catch (e) {
          console.error('Error deleting old profile photo:', e);
        }
      }
    }

    // Save the new photo URL to the database
    await pool.request()
      .input('profile_photo', sql.VarChar, profilePhotoUrl)
      .input('employee_id', sql.VarChar, employee_id)
      .query('UPDATE employees SET profile_photo = @profile_photo WHERE employee_id = @employee_id');

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
    const photoResult = await pool.request()
      .input('employeeId', sql.VarChar, employeeId)
      .query('SELECT profile_photo FROM employees WHERE employee_id = @employeeId');

    if (photoResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const currentPhotoPath = photoResult.recordset[0].profile_photo;

    // Remove photo from database
    await pool.request()
      .input('employeeId', sql.VarChar, employeeId)
      .query('UPDATE employees SET profile_photo = NULL WHERE employee_id = @employeeId');

    // Delete physical file if it exists and no other user is using it
    if (currentPhotoPath) {
      try {
        // Check if any other user is using this photo
        const otherUserResult = await pool.request()
          .input('currentPhotoPath', sql.VarChar, currentPhotoPath)
          .query('SELECT COUNT(*) as count FROM employees WHERE profile_photo = @currentPhotoPath');
        
        if (parseInt(otherUserResult.recordset[0].count) === 0) {
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
    const oldPhotoResult = await pool.request()
      .input('employeeId', sql.VarChar, employeeId)
      .query('SELECT profile_photo FROM employees WHERE employee_id = @employeeId');
    
    if (oldPhotoResult.recordset.length > 0 && oldPhotoResult.recordset[0].profile_photo) {
      const oldPhotoPath = oldPhotoResult.recordset[0].profile_photo;
      if (oldPhotoPath && oldPhotoPath !== profilePhotoUrl) {
        const fullOldPath = path.join(__dirname, oldPhotoPath.replace(/^\//, ''));
        try {
          const otherUserResult = await pool.request()
            .input('oldPhotoPath', sql.VarChar, oldPhotoPath)
            .input('employeeId', sql.VarChar, employeeId)
            .query('SELECT COUNT(*) as count FROM employees WHERE profile_photo = @oldPhotoPath AND employee_id != @employeeId');
          
          if (parseInt(otherUserResult.recordset[0].count) === 0 && fs.existsSync(fullOldPath)) {
            fs.unlinkSync(fullOldPath);
          }
        } catch (e) {
          console.error('Error deleting old profile photo:', e);
        }
      }
    }

    // Save the new photo URL to the database
    await pool.request()
      .input('profile_photo', sql.VarChar, profilePhotoUrl)
      .input('employeeId', sql.VarChar, employeeId)
      .query('UPDATE employees SET profile_photo = @profile_photo WHERE employee_id = @employeeId');

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
    const totalResult = await pool.request()
      .input('employee_id', sql.VarChar, employee_id)
      .query('SELECT COUNT(*) as total FROM leaves WHERE employee_id = @employee_id');

    // Get approved leaves
    const approvedResult = await pool.request()
      .input('employee_id', sql.VarChar, employee_id)
      .input('status', sql.VarChar, 'Approved')
      .query('SELECT COUNT(*) as approved FROM leaves WHERE employee_id = @employee_id AND status = @status');

    // Get pending leaves
    const pendingResult = await pool.request()
      .input('employee_id', sql.VarChar, employee_id)
      .input('status', sql.VarChar, 'Pending')
      .query('SELECT COUNT(*) as pending FROM leaves WHERE employee_id = @employee_id AND status = @status');

    // Get rejected leaves
    const rejectedResult = await pool.request()
      .input('employee_id', sql.VarChar, employee_id)
      .input('status', sql.VarChar, 'Rejected')
      .query('SELECT COUNT(*) as rejected FROM leaves WHERE employee_id = @employee_id AND status = @status');

    res.json({
      total: parseInt(totalResult.recordset[0].total),
      approved: parseInt(approvedResult.recordset[0].approved),
      pending: parseInt(pendingResult.recordset[0].pending),
      rejected: parseInt(rejectedResult.recordset[0].rejected),
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
    const userResult = await pool.request()
      .input('employee_id', sql.VarChar, employee_id)
      .query('SELECT password FROM employees WHERE employee_id = @employee_id');

    if (userResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const currentStoredPassword = userResult.recordset[0].password;
    if (currentStoredPassword !== currentPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Update password
    await pool.request()
      .input('newPassword', sql.VarChar, newPassword)
      .input('employee_id', sql.VarChar, employee_id)
      .query('UPDATE employees SET password = @newPassword WHERE employee_id = @employee_id');

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
    const inputs = [];
    let paramCount = 1;

    if (full_name !== undefined) {
      updateFields.push(`full_name = @param${paramCount++}`);
      inputs.push({ name: `param${paramCount-1}`, type: sql.VarChar, value: full_name });
    }
    if (email !== undefined) {
      updateFields.push(`email = @param${paramCount++}`);
      inputs.push({ name: `param${paramCount-1}`, type: sql.VarChar, value: email });
    }
    if (phone !== undefined) {
      updateFields.push(`mobile_number = @param${paramCount++}`);
      inputs.push({ name: `param${paramCount-1}`, type: sql.VarChar, value: phone });
    }
    if (department !== undefined) {
      updateFields.push(`current_posting = @param${paramCount++}`);
      inputs.push({ name: `param${paramCount-1}`, type: sql.VarChar, value: department });
    }
    if (designation !== undefined) {
      updateFields.push(`designation = @param${paramCount++}`);
      inputs.push({ name: `param${paramCount-1}`, type: sql.VarChar, value: designation });
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    inputs.push({ name: `param${paramCount}`, type: sql.VarChar, value: employee_id });
    const query = `
      UPDATE employees 
      SET ${updateFields.join(', ')} 
      OUTPUT INSERTED.*
      WHERE employee_id = @param${paramCount}
    `;

    let request = pool.request();
    for (const inp of inputs) {
      request = request.input(inp.name, inp.type, inp.value);
    }
    const result = await request.query(query);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      employee: result.recordset[0]
    });
  } catch (err) {
    console.error('Error updating employee profile:', err);
    res.status(500).json({ error: err.message });
  }
});

// Cancel approved leave request
app.post('/api/leaves/cancel-approved', async (req, res) => {
  try {
    const { leave_id, employee_id, cancel_reason } = req.body;
    if (!leave_id || !employee_id) {
      return res.status(400).json({ error: 'Leave ID and Employee ID are required' });
    }

    // Check if the leave exists and is approved
    const leaveCheck = await pool.request()
      .input('leave_id', sql.Int, leave_id)
      .input('employee_id', sql.VarChar, employee_id)
      .input('status', sql.VarChar, 'Approved')
      .query('SELECT * FROM leaves WHERE id = @leave_id AND employee_id = @employee_id AND status = @status');
    
    if (leaveCheck.recordset.length === 0) {
      return res.status(404).json({ error: 'Leave not found or not approved. Only approved leaves can be cancelled.' });
    }
    
    const leave = leaveCheck.recordset[0];
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

    // Update leave status to cancelled
    const result = await pool.request()
      .input('cancel_reason', sql.VarChar, cancel_reason || 'Cancelled by employee')
      .input('leave_id', sql.Int, leave_id)
      .input('employee_id', sql.VarChar, employee_id)
      .query(`
        UPDATE leaves 
        SET status = 'Cancelled', 
            remarks = @cancel_reason,
            cancelled_date = GETDATE(),
            updated_at = GETDATE()
        OUTPUT INSERTED.*
        WHERE id = @leave_id AND employee_id = @employee_id 
      `);
    
    if (result.recordset.length === 0) {
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
      await pool.request()
        .input('days', sql.Int, leave.days)
        .input('employee_id', sql.VarChar, employee_id)
        .query(`
          UPDATE employees 
          SET ${balanceColumn} = ${balanceColumn} + @days 
          WHERE employee_id = @employee_id
        `);
    }

    // Create notification for manager
    await pool.request()
      .input('type', sql.VarChar, 'leave_cancelled')
      .input('message', sql.VarChar, `Leave request ${leave_id} has been cancelled by employee ${employee_id}`)
      .input('user_id', sql.VarChar, leave.manager_id || '1')
      .input('sender_id', sql.VarChar, employee_id)
      .query(`
        INSERT INTO notifications (type, message, user_id, sender_id, created_at) 
        VALUES (@type, @message, @user_id, @sender_id, GETDATE())
      `);

    res.json({
      success: true,
      message: 'Leave cancelled successfully',
      leave: result.recordset[0],
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
    
    // Check if leave exists
    const leaveCheck = await pool.request()
      .input('leaveId', sql.Int, leaveId)
      .query('SELECT id FROM leaves WHERE id = @leaveId');
    
    if (leaveCheck.recordset.length === 0) {
      return res.status(404).json({ error: 'Leave not found' });
    }
    
    const result = await pool.request()
      .input('leave_id', sql.Int, leaveId)
      .input('file_name', sql.VarChar, originalname)
      .input('file_url', sql.VarChar, fileUrl)
      .input('file_size', sql.Int, size)
      .query(`
        INSERT INTO leave_documents (leave_id, file_name, file_url, file_size) 
        OUTPUT INSERTED.*
        VALUES (@leave_id, @file_name, @file_url, @file_size)
      `);
    
    res.json({ 
      success: true, 
      document: result.recordset[0],
      message: 'Document uploaded successfully'
    });
  } catch (err) {
    console.error('Error uploading document:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get documents for a leave
app.get('/api/leaves/:id/documents', async (req, res) => {
  try {
    const leaveId = req.params.id;
    
    // Check if leave exists
    const leaveCheck = await pool.request()
      .input('leaveId', sql.Int, leaveId)
      .query('SELECT id FROM leaves WHERE id = @leaveId');
    
    if (leaveCheck.recordset.length === 0) {
      return res.status(404).json({ error: 'Leave not found' });
    }
    
    const docsResult = await pool.request()
      .input('leave_id', sql.Int, leaveId)
      .query(`
        SELECT id, file_name, file_url, file_size, upload_date 
        FROM leave_documents 
        WHERE leave_id = @leave_id 
        ORDER BY upload_date DESC
      `);
    
    res.json({
      success: true,
      documents: docsResult.recordset,
      count: docsResult.recordset.length
    });
  } catch (err) {
    console.error('Error fetching documents:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete a document
app.delete('/api/documents/:documentId', async (req, res) => {
  try {
    const documentId = req.params.documentId;
    
    // Get document info before deleting
    const docResult = await pool.request()
      .input('documentId', sql.Int, documentId)
      .query('SELECT file_url FROM leave_documents WHERE id = @documentId');
    
    if (docResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    const fileUrl = docResult.recordset[0].file_url;
    
    // Delete from database
    await pool.request()
      .input('documentId', sql.Int, documentId)
      .query('DELETE FROM leave_documents WHERE id = @documentId');
    
    // Delete physical file
    if (fileUrl) {
      try {
        const fullPath = path.join(__dirname, fileUrl.replace(/^\//, ''));
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      } catch (e) {
        console.error('Error deleting physical file:', e);
      }
    }
    
    res.json({ 
      success: true, 
      message: 'Document deleted successfully' 
    });
  } catch (err) {
    console.error('Error deleting document:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update leave details API to include documents
app.get('/api/leaves/:id/details', async (req, res) => {
  try {
    const leaveResult = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('SELECT * FROM leaves WHERE id = @id');
    
    if (leaveResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Leave not found' });
    }
    
    const leave = leaveResult.recordset[0];
    
    // Get documents for this leave
    const docsResult = await pool.request()
      .input('leave_id', sql.Int, req.params.id)
      .query(`
        SELECT id, file_name, file_url, file_size, upload_date 
        FROM leave_documents 
        WHERE leave_id = @leave_id 
        ORDER BY upload_date DESC
      `);
    
    leave.documents = docsResult.recordset;
    
    res.json({
      success: true,
      leave: leave
    });
  } catch (err) {
    console.error('Error fetching leave details:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get all employees with debugging info
app.get('/api/employees/debug', async (req, res) => {
  try {
    const result = await pool.request().query(`
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
    console.log('All employees data:', result.recordset);
    res.json({
      count: result.recordset.length,
      employees: result.recordset
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
    const result = await pool.request()
      .input('full_name', sql.VarChar, full_name)
      .input('current_posting', sql.VarChar, current_posting)
      .input('employeeId', sql.VarChar, employeeId)
      .query(`UPDATE employees SET full_name = @full_name, current_posting = @current_posting OUTPUT INSERTED.employee_id, INSERTED.full_name, INSERTED.current_posting WHERE LOWER(employee_id) = LOWER(@employeeId)`);
    if (!result.recordset.length) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    console.log('Updated employee data:', result.recordset[0]);
    res.json({
      success: true,
      message: 'Employee data updated successfully',
      employee: result.recordset[0]
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
    const result = await pool.request()
      .input('userId', sql.VarChar, userId)
      .query('DELETE FROM notifications WHERE user_id = @userId');
    
    console.log('Rows deleted:', result.rowsAffected[0]);
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
      const senderResult = await pool.request()
        .input('sender_id', sql.VarChar, sender_id)
        .query('SELECT full_name, profile_photo FROM employees WHERE employee_id = @sender_id');
      
      if (senderResult.recordset.length > 0) {
        senderInfo = senderResult.recordset[0];
      }
    }
    
    const result = await pool.request()
      .input('type', sql.VarChar, 'test')
      .input('message', sql.VarChar, message)
      .input('user_id', sql.VarChar, user_id)
      .input('sender_id', sql.VarChar, sender_id)
      .query(`
        INSERT INTO notifications (type, message, user_id, sender_id, created_at) 
        OUTPUT INSERTED.*
        VALUES (@type, @message, @user_id, @sender_id, GETDATE())
      `);
    
    res.json({
      success: true,
      notification: result.recordset[0]
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

const os = require('os');
// System health check endpoint
app.get('/api/system/health', (req, res) => {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memUsage = (usedMem / totalMem) * 100;

  const cpus = os.cpus();
  const cpuLoad = cpus.map(cpu => {
    const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
    return ((total - cpu.times.idle) / total) * 100;
  });
  const avgCpu = cpuLoad.reduce((a, b) => a + b, 0) / cpuLoad.length;

  res.json({
    memory: {
      total: totalMem,
      free: freeMem,
      used: usedMem,
      percent: memUsage
    },
    cpu: {
      percent: avgCpu
    },
    uptime: os.uptime(),
    loadavg: os.loadavg(),
    timestamp: new Date().toISOString()
  });
});

// System Health Endpoint for Admin Panel
app.get('/api/system/health', async (req, res) => {
  try {
    // Uptime in seconds
    const uptime = process.uptime();
    // Memory usage in percent
    const memoryUsage = process.memoryUsage();
    const totalMem = process.env.TOTAL_MEM_MB ? parseInt(process.env.TOTAL_MEM_MB) * 1024 * 1024 : require('os').totalmem();
    const usedMem = memoryUsage.rss;
    const memoryPercent = totalMem ? (usedMem / totalMem) * 100 : 0;
    // CPU usage (not always available, so set to 0 for simplicity)
    let cpuPercent = 0;
    // Optionally, you can use os-utils or pidusage for more accurate CPU, but for now keep it simple
    res.json({
      uptime: Math.round(uptime),
      memory: { percent: Math.round(memoryPercent) },
      cpu: { percent: Math.round(cpuPercent) }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get system health', details: err.message });
  }
});

// Middleware to block leave endpoints for admin users
function blockAdminLeave(req, res, next) {
  // user info is usually attached to req.user after authentication
  // For this codebase, user info is returned on login, but not attached to req.user by default.
  // We'll check for employee_id in body/query and fetch role if not present.
  const employeeId = req.body.employee_id || req.body.employeeId || req.query.employee_id || req.query.employeeId;
  if (!employeeId) return next(); // If no employeeId, let it pass (could be admin viewing all leaves etc.)

  // Fetch user role from DB
  pool.request()
    .input('employee_id', sql.VarChar, employeeId)
    .query('SELECT role FROM employees WHERE employee_id = @employee_id')
    .then(result => {
      if (result.recordset.length && result.recordset[0].role === 'admin') {
        return res.status(403).json({ error: 'Admin users cannot access leave features.' });
      }
      next();
    })
    .catch(() => next()); // If DB error, let it pass (fail open)
}

// Apply this middleware to all leave-related endpoints
app.use(['/api/leaves', '/api/leaves/*'], blockAdminLeave);