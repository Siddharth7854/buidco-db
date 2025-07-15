#!/bin/bash

# Render Express Fix Script
echo "🔧 Starting Express module fix..."

# Step 1: Clean everything
echo "📦 Cleaning node_modules and cache..."
rm -rf node_modules package-lock.json
npm cache clean --force

# Step 2: Install Express specifically first
echo "⚡ Installing Express 4.19.2..."
npm install express@4.19.2 --save --no-package-lock

# Step 3: Install all dependencies
echo "📋 Installing all dependencies..."
npm install --force --no-package-lock

# Step 4: Verify Express installation
echo "✅ Verifying Express installation..."
if node -e "console.log('Express version:', require('express/package.json').version)"; then
    echo "✅ Express verified successfully!"
else
    echo "❌ Express verification failed!"
    exit 1
fi

# Step 5: Start the application
echo "🚀 Starting application..."
exec node index.cjs
