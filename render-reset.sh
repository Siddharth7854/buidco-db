#!/bin/bash

# Render Deployment Reset Script
echo "🚀 Starting Render deployment reset..."

# Remove potentially corrupted modules
echo "🧹 Cleaning up old installations..."
rm -rf node_modules
rm -f package-lock.json

# Clear npm cache
echo "🔄 Clearing npm cache..."
npm cache clean --force

# Install fresh dependencies
echo "📦 Installing fresh dependencies..."
npm install --production

# Verify Express installation
echo "✅ Verifying Express installation..."
if [ -d "node_modules/express" ]; then
    echo "✅ Express installed successfully"
    ls -la node_modules/express/lib/
else
    echo "❌ Express installation failed"
    exit 1
fi

echo "🎉 Deployment reset complete!"
echo "Now run: node index.cjs"
