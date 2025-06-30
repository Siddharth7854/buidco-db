const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 5000;

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL Connection
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'buidco_leave',
  password: 'sid91221',
  port: 5432,
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Error connecting to the database:', err);
  } else {
    console.log('Connected to PostgreSQL database');
  }
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
app.use('/uploads/profile_photos', express.static(path.join(__dirname, 'uploads/profile_photos')));

// Create tables if they don't exist
async function createTables() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if tables exist first
    const tablesExist = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('employees', 'leaves')
      );
    `);

    if (!tablesExist.rows[0].exists) {
      console.log('Tables do not exist. Please create them manually with proper permissions.');
      return;
    }

    // Check if columns exist in employees table
    const columnsExist = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'employees'
        AND column_name IN ('cl_balance', 'rh_balance', 'el_balance')
      );
    `);

    if (!columnsExist.rows[0].exists) {
      console.log('Adding leave balance columns to employees table...');
      await client.query(`
        ALTER TABLE employees 
        ADD COLUMN IF NOT EXISTS cl_balance INTEGER DEFAULT 10,
        ADD COLUMN IF NOT EXISTS rh_balance INTEGER DEFAULT 5,
        ADD COLUMN IF NOT EXISTS el_balance INTEGER DEFAULT 18;
      `);
      console.log('Columns added successfully');
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '42501') { // Permission denied error
      console.log('Permission denied. Using existing tables...');
    } else {
      console.error('Error checking/creating tables:', err);
    }
  } finally {
    client.release();
  }
}

// Call the function to create tables
createTables();

// Add balance columns if they don't exist
const addBalanceColumns = async () => {
  try {
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
    console.log('Columns added successfully');
  } catch (err) {
    console.error('Error adding columns:', err);
  }
};

// Call the function to add balance columns
addBalanceColumns();

// Ensure cancel_request_status and cancel_reason columns exist
(async () => {
  try {
    await pool.query(`
      ALTER TABLE leaves
      ADD COLUMN IF NOT EXISTS cancel_request_status VARCHAR(20),
      ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
    `);
    // Create notifications table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        type VARCHAR(50),
        message TEXT,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        user_id INTEGER
      );
    `);
  } catch (err) {
    console.error('Error ensuring columns/tables:', err);
  }
})();

// Create leave_documents table if not exists
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS leave_documents (
        id SERIAL PRIMARY KEY,
        leave_id VARCHAR(20) REFERENCES leaves(id) ON DELETE CASCADE,
        file_name TEXT,
        file_url TEXT,
        file_size INTEGER,
        upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (err) {
    console.error('Error creating leave_documents table:', err);
  }
})();

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

// ...existing code...
// Routes
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query(
      `SELECT * FROM employees WHERE (email = $1 OR employee_id = $1) AND password = $2 AND status = 'Active'`,
      [email, password]
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

    const result = await pool.query(
      `INSERT INTO employees
      (employee_id, full_name, email, mobile_number, designation, role, joining_date, current_posting, password, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
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
    const { employee_id } = req.query;
    if (employee_id) {
      const result = await pool.query('SELECT * FROM employees WHERE employee_id = $1', [employee_id]);
      return res.json(result.rows);
    }
    const result = await pool.query('SELECT * FROM employees');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    // Add notification for admin
    await pool.query(
      'INSERT INTO notifications (type, message, user_id) VALUES ($1, $2, NULL)',
      ['New Leave Request', `New leave request from ${employeeName} (${employeeId}) for ${type} from ${startDate} to ${endDate}.`,]
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

    const transformedData = result.rows.map(row => ({
      ...row,
      designation: row.designation || row.employee_designation || 'Not Specified'
    }));

    res.json(transformedData);
  } catch (err) {
    console.error('Error in /api/leaves:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get leave requests for specific employee
app.get('/api/leaves/:employeeId', async (req, res) => {
  try {
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
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Approve leave request
app.patch('/api/leaves/:id/approve', async (req, res) => {
  const client = await pool.connect();
  try {
    console.log('Starting leave approval process for ID:', req.params.id);
    await client.query('BEGIN');

    // Get the leave request details
    console.log('Fetching leave request details...');
    const leaveResult = await client.query(
      'SELECT l.*, e.designation as employee_designation FROM leaves l LEFT JOIN employees e ON l.employee_id = e.employee_id WHERE l.id::text = $1',
      [req.params.id]
    );
    console.log('Leave request result:', leaveResult.rows[0]);

    if (leaveResult.rows.length === 0) {
      console.log('Leave request not found');
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }

    const leave = leaveResult.rows[0];
    console.log('Leave details:', leave);

    // Check if leave is already approved
    if (leave.status === 'Approved') {
      console.log('Leave already approved');
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Leave request is already approved' });
    }

    // Get employee details
    console.log('Fetching employee details for ID:', leave.employee_id);
    const employeeResult = await client.query(
      'SELECT * FROM employees WHERE employee_id = $1',
      [leave.employee_id]
    );
    console.log('Employee result:', employeeResult.rows[0]);

    if (employeeResult.rows.length === 0) {
      console.log('Employee not found');
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const employee = employeeResult.rows[0];

    // Check leave balance
    let balanceColumn;
    let currentBalance;
    switch (leave.type) {
      case 'CL':
        balanceColumn = 'cl_balance';
        currentBalance = employee.cl_balance || 0;
        break;
      case 'RH':
        balanceColumn = 'rh_balance';
        currentBalance = employee.rh_balance || 0;
        break;
      case 'EL':
        balanceColumn = 'el_balance';
        currentBalance = employee.el_balance || 0;
        break;
      default:
        console.log('Invalid leave type:', leave.type);
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'Invalid leave type' });
    }

    console.log('Leave balance check:', {
      type: leave.type,
      balanceColumn,
      currentBalance,
      requestedDays: leave.days
    });

    if (currentBalance < leave.days) {
      console.log('Insufficient balance');
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        message: `Insufficient leave balance. Current balance: ${currentBalance}, Requested: ${leave.days}` 
      });
    }

    // Update leave status
    console.log('Updating leave status to Approved');
    const updateResult = await client.query(
      'UPDATE leaves SET status = $1, approved_date = $2 WHERE id::text = $3 RETURNING *',
      ['Approved', new Date(), req.params.id]
    );

    // Deduct leave days from balance
    console.log('Deducting leave balance:', {
      balanceColumn,
      daysToDeduct: leave.days,
      employeeId: leave.employee_id
    });
    
    const updateBalanceQuery = `UPDATE employees SET ${balanceColumn} = ${balanceColumn} - $1 WHERE employee_id = $2`;
    console.log('Update balance query:', updateBalanceQuery);
    
    await client.query(
      updateBalanceQuery,
      [leave.days, leave.employee_id]
    );

    console.log('Committing transaction...');
    await client.query('COMMIT');
    console.log('Leave approval successful');
    res.json({ success: true, leave: updateResult.rows[0] });
  } catch (err) {
    console.error('Error in approve leave:', err);
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

// Reject leave request
app.patch('/api/leaves/:id/reject', async (req, res) => {
  try {
    const { remarks } = req.body;
    const result = await pool.query(
      'UPDATE leaves SET status = $1, remarks = $2, rejected_date = $3 WHERE id::text = $4 RETURNING *',
      ['Rejected', remarks, new Date(), req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }

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
app.patch('/api/leaves/:id/request-cancel', async (req, res) => {
  try {
    const { cancel_reason, user_id } = req.body;
    const result = await pool.query(
      'UPDATE leaves SET cancel_request_status = $1, cancel_reason = $2 WHERE id::text = $3 RETURNING *',
      ['Requested', cancel_reason, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }
    // Insert a notification for admin (global notification, user_id = NULL)
    await pool.query(
      'INSERT INTO notifications (type, message, user_id) VALUES ($1, $2, NULL)',
      ['Leave Cancellation Request', `Leave ID ${req.params.id} requested cancellation.`]
    );
    res.json({ success: true, leave: result.rows[0] });
  } catch (err) {
    console.error('Error in request-cancel:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin approves cancellation
app.patch('/api/leaves/:id/approve-cancel', async (req, res) => {
  try {
    // Find the leave to get the user_id
    const leaveResult = await pool.query('SELECT employee_id FROM leaves WHERE id::text = $1', [req.params.id]);
    const userId = leaveResult.rows.length > 0 ? leaveResult.rows[0].employee_id : null;
    const result = await pool.query(
      'UPDATE leaves SET cancel_request_status = $1 WHERE id::text = $2 RETURNING *',
      ['Approved', req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }
    // Insert notification for user
    if (userId) {
      await pool.query(
        'INSERT INTO notifications (type, message, user_id) VALUES ($1, $2, $3)',
        ['Leave Cancellation Approved', `Your leave cancellation for ID ${req.params.id} was approved.`, userId]
      );
    }
    res.json({ success: true, leave: result.rows[0] });
  } catch (err) {
    console.error('Error in approve-cancel:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin rejects cancellation
app.patch('/api/leaves/:id/reject-cancel', async (req, res) => {
  try {
    const { reason } = req.body;
    // Find the leave to get the user_id
    const leaveResult = await pool.query('SELECT employee_id FROM leaves WHERE id::text = $1', [req.params.id]);
    const userId = leaveResult.rows.length > 0 ? leaveResult.rows[0].employee_id : null;
    const result = await pool.query(
      'UPDATE leaves SET cancel_request_status = $1, cancel_reason = $2 WHERE id::text = $3 RETURNING *',
      ['Rejected', reason || 'Rejected by admin', req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }
    // Insert notification for user
    if (userId) {
      await pool.query(
        'INSERT INTO notifications (type, message, user_id) VALUES ($1, $2, $3)',
        ['Leave Cancellation Rejected', `Your leave cancellation for ID ${req.params.id} was rejected.`, userId]
      );
    }
    res.json({ success: true, leave: result.rows[0] });
  } catch (err) {
    console.error('Error in reject-cancel:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get notifications for a specific user
app.get('/api/notifications/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50', [userId]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching user notifications:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get notifications for admin/global
app.get('/api/notifications', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM notifications WHERE user_id IS NULL ORDER BY created_at DESC LIMIT 50');
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
    // You can save the file path to DB here if needed
    const profilePhotoUrl = `/uploads/profile_photos/${req.file.filename}`;
    res.json({
      success: true,
      message: 'Profile photo uploaded successfully',
      url: profilePhotoUrl
    });
  } catch (err) {
    console.error('Error uploading profile photo:', err);
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
        daysPerYear: 10,
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
app.post('/api/leaves/cancel-approved', async (req, res) => {
  try {
    const { leave_id, employee_id, cancel_reason } = req.body;
    
    if (!leave_id || !employee_id) {
      return res.status(400).json({ error: 'Leave ID and Employee ID are required' });
    }

    // First check if the leave exists and is approved
    const leaveCheck = await pool.query(
      'SELECT * FROM leaves WHERE id::text = $1 AND employee_id = $2 AND status = $3',
      [leave_id, employee_id, 'Approved']
    );

    if (leaveCheck.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Leave not found or not approved. Only approved leaves can be cancelled.' 
      });
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
      return res.status(400).json({ 
        error: 'Cannot cancel leave that has already started or passed' 
      });
    }

    // Update leave status to cancelled
    const result = await pool.query(
      `UPDATE leaves 
       SET status = 'Cancelled', 
           cancel_request_status = 'Cancelled',
           cancel_reason = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id::text = $2 AND employee_id = $3 
       RETURNING *`,
      [cancel_reason || 'Cancelled by employee', leave_id, employee_id]
    );

    if (result.rows.length === 0) {
      return res.status(500).json({ error: 'Failed to cancel leave' });
    }

    // Restore leave balance
    const leaveType = leave.leave_type ? leave.leave_type.toLowerCase() : (leave.type ? leave.type.toLowerCase() : '');
    let balanceColumn = '';
    
    if (leaveType.includes('casual')) {
      balanceColumn = 'cl_balance';
    } else if (leaveType.includes('earned')) {
      balanceColumn = 'el_balance';
    } else if (leaveType.includes('restricted')) {
      balanceColumn = 'rh_balance';
    }

    if (balanceColumn) {
      await pool.query(
        `UPDATE employees 
         SET ${balanceColumn} = ${balanceColumn} + $1 
         WHERE employee_id = $2`,
        [leave.duration || leave.days, employee_id]
      );
    }

    // Create notification for manager
    await pool.query(
      `INSERT INTO notifications (type, message, user_id, created_at) 
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
      [
        'leave_cancelled',
        `Leave request ${leave_id} has been cancelled by employee ${employee_id}`,
        leave.manager_id || 1 // Default manager ID if not set
      ]
    );

    res.json({
      success: true,
      message: 'Leave cancelled successfully',
      leave: result.rows[0],
      balanceRestored: balanceColumn ? true : false
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

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}); 