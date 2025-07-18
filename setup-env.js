const fs = require('fs');
const path = require('path');

console.log('🔧 Setting up environment variables for SQL Server...\n');

const envContent = `# Database Configuration
DB_SERVER=SIDDHARTH
DB_PORT=62721
DB_NAME=BUIDCO
DB_USER=sa
DB_PASSWORD=Sid91221

# Server Configuration
PORT=5000
NODE_ENV=development

# API Configuration
API_BASE_URL=http://localhost:5000
CORS_ORIGIN=http://localhost:3000,http://localhost:8080,http://localhost:5173

# File Upload Configuration
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads

# Logging
LOG_LEVEL=debug
`;

const envPath = path.join(__dirname, '.env');

try {
  fs.writeFileSync(envPath, envContent);
  console.log('✅ .env file created successfully!');
  console.log('📋 Environment variables configured:');
  console.log('   - DB_SERVER: SIDDHARTH');
  console.log('   - DB_PORT: 62721');
  console.log('   - DB_NAME: BUIDCO');
  console.log('   - DB_USER: sa');
  console.log('   - DB_PASSWORD: Sid91221');
  console.log('\n🚀 You can now run: node index.cjs');
} catch (error) {
  console.error('❌ Error creating .env file:', error.message);
  console.log('\n📝 Please create a .env file manually with the following content:');
  console.log(envContent);
} 