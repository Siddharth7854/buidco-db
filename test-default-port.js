const sql = require('mssql');

const configs = [
  {
    name: 'Default SQL Server (MSSQLSERVER)',
    config: {
      server: 'localhost',
      port: 1433,
      database: 'master',
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
    name: 'SQL Server with instance name',
    config: {
      server: 'localhost\\MSSQLSERVER',
      port: 1433,
      database: 'master',
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
    name: 'SQL Server without port specification',
    config: {
      server: 'localhost',
      database: 'master',
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
    
    const result = await pool.request().query('SELECT @@VERSION as version');
    console.log(`✅ SQL Server version: ${result.recordset[0].version.substring(0, 100)}...`);
    
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
  console.log('🧪 Testing SQL Server connections on default port...\n');
  
  for (const test of configs) {
    const success = await testConnection(test.config, test.name);
    if (success) {
      console.log(`\n🎉 Working configuration found: ${test.name}`);
      console.log(`📋 Use this in your .env file:`);
      console.log(`DB_SERVER=${test.config.server}`);
      if (test.config.port) {
        console.log(`DB_PORT=${test.config.port}`);
      }
      return;
    }
  }
  
  console.log('\n❌ No working configuration found.');
  console.log('💡 Please check:');
  console.log('   1. SQL Server is running');
  console.log('   2. TCP/IP protocol is enabled');
  console.log('   3. SQL Server Browser service is running');
  console.log('   4. Try enabling TCP/IP in SQL Server Configuration Manager');
}

runTests().catch(console.error); 