const sql = require('mssql');

const configs = [
  {
    name: 'Local Instance (MSSQLSERVER)',
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
    name: 'Named Instance (SIDDHARTH\\MSSQLSERVER)',
    config: {
      server: 'SIDDHARTH\\MSSQLSERVER',
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
    name: 'Windows Authentication',
    config: {
      server: 'localhost',
      port: 1433,
      database: 'master',
      options: {
        trustServerCertificate: true,
        encrypt: false,
        enableArithAbort: true,
        useUTC: false,
        connectTimeout: 30000,
        requestTimeout: 30000,
        cancelTimeout: 5000,
        trustedConnection: true
      }
    }
  },
  {
    name: 'SQL Server Browser (no port)',
    config: {
      server: 'SIDDHARTH',
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
    return { success: true, config: config };
  } catch (err) {
    console.log(`❌ Failed to connect to ${name}:`);
    console.log(`   Error: ${err.message}`);
    console.log(`   Code: ${err.code}`);
    return { success: false, error: err.message };
  }
}

async function runTests() {
  console.log('🧪 Testing different SQL Server connection methods...\n');
  
  for (const test of configs) {
    const result = await testConnection(test.config, test.name);
    if (result.success) {
      console.log(`\n🎉 Working configuration found: ${test.name}`);
      console.log(`📋 Use this configuration in your app`);
      return result.config;
    }
  }
  
  console.log('\n❌ No working configuration found.');
  console.log('💡 Please check:');
  console.log('   1. SQL Server is running');
  console.log('   2. TCP/IP protocol is enabled');
  console.log('   3. SQL Server Browser service is running');
  console.log('   4. Try enabling TCP/IP in SQL Server Configuration Manager');
  return null;
}

runTests().catch(console.error); 