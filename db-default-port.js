const sql = require('mssql');

const config = {
  server: 'SIDDHARTH',
  port: 1433, // Default SQL Server port
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
    console.log('🔌 Attempting to connect to SQL Server with default port...');
    console.log(`📍 Server: ${config.server}:${config.port}, Database: ${config.database}`);
    
    await pool.connect();
    console.log('✅ Successfully connected to SQL Server with default port!');
    
    // Test the connection
    const result = await pool.request().query('SELECT @@VERSION as version');
    console.log('✅ SQL Server version:', result.recordset[0].version.substring(0, 100) + '...');
    
    return true;
  } catch (err) {
    console.error('❌ Failed to connect to SQL Server with default port:');
    console.error('   Error:', err.message);
    console.error('   Code:', err.code);
    return false;
  }
}

module.exports = { pool, connect }; 