const sql = require('mssql');

const configs = [
  {
    name: 'SIDDHARTH:62721',
    config: {
      server: 'SIDDHARTH',
      port: 62721,
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
      }
    }
  },
  {
    name: 'localhost:62721',
    config: {
      server: 'localhost',
      port: 62721,
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
      }
    }
  },
  {
    name: '127.0.0.1:62721',
    config: {
      server: '127.0.0.1',
      port: 62721,
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
      }
    }
  }
];

async function testConnection(config, name) {
  console.log(`\n🔍 Testing connection to ${name}...`);
  
  try {
    const pool = new sql.ConnectionPool(config);
    await pool.connect();
    console.log(`✅ Successfully connected to ${name}`);
    
    const result = await pool.request().query('SELECT 1 AS test');
    console.log(`✅ Test query executed: ${result.recordset[0].test}`);
    
    await pool.close();
    return true;
  } catch (err) {
    console.log(`❌ Failed to connect to ${name}:`);
    console.log(`   Error: ${err.message}`);
    console.log(`   Code: ${err.code}`);
    return false;
  }
}

async function runTests() {
  console.log('🧪 Testing SQL Server connections...\n');
  
  for (const test of configs) {
    const success = await testConnection(test.config, test.name);
    if (success) {
      console.log(`\n🎉 Working configuration found: ${test.name}`);
      console.log(`📋 Use this in your .env file:`);
      console.log(`DB_SERVER=${test.config.server}`);
      console.log(`DB_PORT=${test.config.port}`);
      return;
    }
  }
  
  console.log('\n❌ No working configuration found.');
  console.log('💡 Please check:');
  console.log('   1. SQL Server is running');
  console.log('   2. SQL Server Browser service is enabled');
  console.log('   3. TCP/IP protocol is enabled');
  console.log('   4. Port 62721 is open');
}

runTests().catch(console.error); 