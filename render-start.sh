#!/bin/bash

# Render.com start script for Tradeflow backend
# Optimized for Supabase/managed PostgreSQL

echo "🚀 Starting Tradeflow Backend on Render..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL environment variable is not set!"
  echo "   Please add DATABASE_URL in Render dashboard"
  exit 1
fi

echo "✅ DATABASE_URL is configured"

# Run database migrations
echo "📦 Running database migrations..."
if node src/db/migrate.js; then
  echo "✅ Migrations completed successfully!"
else
  echo "❌ Migration failed!"
  echo "   Check your database connection and credentials"
  exit 1
fi

# Start the server
echo "🌐 Starting Express server on port ${PORT:-3000}..."
exec node src/index.js
