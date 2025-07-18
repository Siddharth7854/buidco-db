require('dotenv').config();
const sql = require('mssql');

const config = {
  server: 'localhost',      // Default instance
  port: 1433,              // Default SQL Server port
  database: 'BUIDCO',
  user: 'sa',
  password: 'Sid91221',
  options: {
    trustServerCertificate: true,
    encrypt: false,
    enableArithAbort: true,
    useUTC: false,
    connectTimeout: 30000,
    requestTimeout: 30000,
    cancelTimeout: 5000
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

const pool = new sql.ConnectionPool(config);

async function connect() {
  try {
    await pool.connect();
    console.log('✅ Connected!');
    // Test query
    const result = await pool.request().query('SELECT @@VERSION as version');
    console.log(result.recordset[0].version);
    return pool;
  } catch (err) {
    console.error('❌ Connection error:', err);
    throw err;
  }
}

module.exports = { pool, connect };