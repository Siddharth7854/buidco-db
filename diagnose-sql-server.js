const sql = require('mssql');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

async function checkSQLServerServices() {
  console.log('🔍 Checking SQL Server Services...\n');
  
  try {
    const { stdout } = await execAsync('sc query MSSQLSERVER');
    console.log('SQL Server Service Status:');
    console.log(stdout);
  } catch (err) {
    console.log('❌ Error checking SQL Server service:', err.message);
  }
  
  try {
    const { stdout } = await execAsync('sc query SQLBrowser');
    console.log('\nSQL Server Browser Service Status:');
    console.log(stdout);
  } catch (err) {
    console.log('❌ Error checking SQL Server Browser service:', err.message);
  }
}

async function checkPorts() {
  console.log('\n🔍 Checking SQL Server Ports...\n');
  
  try {
    const { stdout } = await execAsync('netstat -an | findstr :1433');
    console.log('Port 1433 (Default):');
    console.log(stdout || 'No connections on port 1433');
  } catch (err) {
    console.log('❌ Error checking port 1433:', err.message);
  }
  
  try {
    const { stdout } = await execAsync('netstat -an | findstr :62721');
    console.log('\nPort 62721 (Custom):');
    console.log(stdout || 'No connections on port 62721');
  } catch (err) {
    console.log('❌ Error checking port 62721:', err.message);
  }
}

async function testDifferentConfigs() {
  console.log('\n🔍 Testing Different Connection Configurations...\n');
  
  const configs = [
    {
      name: 'Windows Auth - localhost:62721',
      config: {
        server: 'localhost',
        port: 62721,
        database: 'master',
        options: {
          trustServerCertificate: true,
          encrypt: false,
          enableArithAbort: true,
          useUTC: false,
          connectTimeout: 10000,
          requestTimeout: 10000,
          cancelTimeout: 5000,
          trustedConnection: true
        }
      }
    },
    {
      name: 'SQL Auth - localhost:62721',
      config: {
        server: 'localhost',
        port: 62721,
        database: 'master',
        user: 'sa',
        password: 'Sid91221',
        options: {
          trustServerCertificate: true,
          encrypt: false,
          enableArithAbort: true,
          useUTC: false,
          connectTimeout: 10000,
          requestTimeout: 10000,
          cancelTimeout: 5000
        }
      }
    },
    {
      name: 'Windows Auth - 127.0.0.1:62721',
      config: {
        server: '127.0.0.1',
        port: 62721,
        database: 'master',
        options: {
          trustServerCertificate: true,
          encrypt: false,
          enableArithAbort: true,
          useUTC: false,
          connectTimeout: 10000,
          requestTimeout: 10000,
          cancelTimeout: 5000,
          trustedConnection: true
        }
      }
    }
  ];
  
  for (const test of configs) {
    console.log(`\n🔍 Testing: ${test.name}`);
    try {
      const pool = new sql.ConnectionPool(test.config);
      await pool.connect();
      console.log(`✅ SUCCESS: ${test.name}`);
      
      const result = await pool.request().query('SELECT @@VERSION as version');
      console.log(`✅ SQL Server version: ${result.recordset[0].version.substring(0, 50)}...`);
      
      await pool.close();
      return test.config; // Return the working config
    } catch (err) {
      console.log(`❌ FAILED: ${test.name}`);
      console.log(`   Error: ${err.message}`);
      console.log(`   Code: ${err.code}`);
    }
  }
  
  return null;
}

async function runDiagnostics() {
  console.log('🔧 SQL Server Connection Diagnostics\n');
  console.log('=====================================\n');
  
  await checkSQLServerServices();
  await checkPorts();
  
  const workingConfig = await testDifferentConfigs();
  
  console.log('\n📋 Summary:');
  if (workingConfig) {
    console.log('✅ Found working configuration!');
    console.log('📋 Use this configuration in your app:');
    console.log(JSON.stringify(workingConfig, null, 2));
  } else {
    console.log('❌ No working configuration found.');
    console.log('\n💡 Troubleshooting Steps:');
    console.log('1. Enable Mixed Mode Authentication in SQL Server');
    console.log('2. Enable SA account and set password');
    console.log('3. Check Windows Firewall settings');
    console.log('4. Verify SQL Server is configured for TCP/IP');
    console.log('5. Try connecting with SQL Server Management Studio first');
  }
}

runDiagnostics().catch(console.error); 