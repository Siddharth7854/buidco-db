# SQL Server Connection Troubleshooting Guide

## �� **Current Issue**

SQL Server is running on port 62721 but not accepting connections.

## 🛠️ **Step-by-Step Solutions**

### **Step 1: Enable SQL Server TCP/IP Protocol**

1. **Open SQL Server Configuration Manager**

   - Press `Win + R`
   - Type `SQLServerManager13.msc` (for SQL Server 2016)
   - Press Enter

2. **Enable TCP/IP Protocol**

   - Expand "SQL Server Network Configuration"
   - Click "Protocols for MSSQLSERVER"
   - Right-click "TCP/IP" → "Enable"
   - Right-click "TCP/IP" → "Properties"
   - Go to "IP Addresses" tab
   - Set "TCP Port" to `62721` for all IP addresses
   - Click "OK"

3. **Restart SQL Server Service**
   - Open Services (`services.msc`)
   - Find "SQL Server (MSSQLSERVER)"
   - Right-click → "Restart"

### **Step 2: Enable SQL Server Browser Service**

1. **Start SQL Server Browser**
   - Open Services (`services.msc`)
   - Find "SQL Server Browser"
   - Right-click → "Start"
   - Set "Startup Type" to "Automatic"

### **Step 3: Configure Windows Firewall**

1. **Allow SQL Server through Firewall**

   ```cmd
   netsh advfirewall firewall add rule name="SQL Server" dir=in action=allow protocol=TCP localport=62721
   ```

2. **Allow SQL Server Browser**
   ```cmd
   netsh advfirewall firewall add rule name="SQL Server Browser" dir=in action=allow protocol=UDP localport=1434
   ```

### **Step 4: Test Connection**

Run this command to test if SQL Server is accessible:

```cmd
telnet localhost 62721
```

### **Step 5: Alternative Configuration**

If the above doesn't work, try using the default SQL Server port:

**Update your `.env` file:**

```env
DB_SERVER=localhost
DB_PORT=1433
DB_NAME=BUIDCO
DB_USER=sa
DB_PASSWORD=Sid91221
```

**Or try using the SQL Server instance name:**

```env
DB_SERVER=localhost\\MSSQLSERVER
DB_PORT=1433
DB_NAME=BUIDCO
DB_USER=sa
DB_PASSWORD=Sid91221
```

### **Step 6: Check SQL Server Authentication**

1. **Enable SQL Server Authentication**

   - Open SQL Server Management Studio
   - Connect to your server
   - Right-click server → "Properties"
   - Go to "Security"
   - Select "SQL Server and Windows Authentication mode"
   - Click "OK"

2. **Verify SA Account**
   - In SQL Server Management Studio
   - Expand "Security" → "Logins"
   - Right-click "sa" → "Properties"
   - Ensure "Login is disabled" is **NOT** checked
   - Set password if needed

### **Step 7: Test with SQL Server Management Studio**

1. **Try connecting via SSMS**
   - Server name: `localhost,62721` or `SIDDHARTH,62721`
   - Authentication: SQL Server Authentication
   - Login: `sa`
   - Password: `Sid91221`

### **Step 8: Quick Fix - Use Default Port**

If nothing works, try using the default SQL Server port:

**Update `db.js`:**

```javascript
const config = {
  server: process.env.DB_SERVER || "localhost",
  port: parseInt(process.env.DB_PORT) || 1433, // Changed from 62721
  database: process.env.DB_NAME || "BUIDCO",
  user: process.env.DB_USER || "sa",
  password: process.env.DB_PASSWORD || "Sid91221",
  // ... rest of config
};
```

**Update your environment variables:**

```env
DB_SERVER=localhost
DB_PORT=1433
DB_NAME=BUIDCO
DB_USER=sa
DB_PASSWORD=Sid91221
```

## 🚀 **After Fixing**

Run the server:

```cmd
node index.cjs
```

You should see:

```
✅ SQL Server connected successfully
✅ Connection test query executed successfully
```

## 📞 **Need Help?**

If you're still having issues:

1. Check SQL Server error logs
2. Verify SQL Server is running
3. Try connecting with SQL Server Management Studio first
4. Check if antivirus is blocking connections
