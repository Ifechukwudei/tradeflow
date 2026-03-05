#!/bin/sh

# Startup script for Tradeflow backend
# Waits for database, runs migrations, then starts the server

echo "🚀 Starting Tradeflow Backend..."

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
until nc -z postgres 5432; do
  echo "   PostgreSQL is unavailable - sleeping"
  sleep 2
done
echo "✅ PostgreSQL is ready!"

# Run database migrations
echo "📦 Running database migrations..."
if node src/db/migrate.js; then
  echo "✅ Migrations completed successfully!"
else
  echo "❌ Migration failed!"
  exit 1
fi

# Start the server
echo "🌐 Starting Express server..."
exec node src/index.js
