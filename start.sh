#!/bin/sh

# Startup script for Tradeflow backend
# Waits for database, runs migrations, then starts the server

echo "🚀 Starting Tradeflow Backend..."

# Get database host from environment variable (defaults to 'postgres' for Docker)
DB_HOST=${DB_HOST:-postgres}
DB_PORT=${DB_PORT:-5432}

echo "📍 Database host: $DB_HOST:$DB_PORT"

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; then
    echo "✅ PostgreSQL is ready!"
    break
  fi
  
  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo "   Attempt $RETRY_COUNT/$MAX_RETRIES - PostgreSQL is unavailable, waiting..."
  sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  echo "❌ Failed to connect to PostgreSQL after $MAX_RETRIES attempts"
  echo "   Trying to start anyway (database might be ready)..."
fi

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
