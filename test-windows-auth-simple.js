const sql = require('mssql');

const config = {
  server: 'localhost',
  port: 62721,
  database: 'master',
  options: {
    trustServerCertificate: true,
    encrypt: false,
    enableArithAbort: true,
    useUTC: false,
    connectTimeout: 30000,
    requestTimeout: 30000,
    cancelTimeout: 5000,
    trustedConnection: true  // Windows Authentication
  }
};

async function testConnection() {
  console.log('🔍 Testing Windows Authentication connection...');
  console.log(`📍 Server: ${config.server}:${config.port}, Database: ${config.database}`);
  
  try {
    const pool = new sql.ConnectionPool(config);
    await pool.connect();
    console.log('✅ Successfully connected using Windows Authentication!');
    
    const result = await pool.request().query('SELECT @@VERSION as version');
    console.log('✅ SQL Server version:', result.recordset[0].version.substring(0, 100) + '...');
    
    await pool.close();
    return true;
  } catch (err) {
    console.log('❌ Failed to connect using Windows Authentication:');
    console.log(`   Error: ${err.message}`);
    console.log(`   Code: ${err.code}`);
    return false;
  }
}

testConnection().then(success => {
  if (success) {
    console.log('\n🎉 Windows Authentication works! Use this configuration.');
  } else {
    console.log('\n❌ Windows Authentication failed. Trying SQL Authentication...');
  }
}).catch(console.error); 