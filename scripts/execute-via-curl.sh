#!/bin/bash

# Execute Supabase Migration via Management API
# This uses the Supabase Management API to run migrations

SUPABASE_PROJECT_REF="znqesarsluytxhuiwfkt"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpucWVzYXJzbHV5dHhodWl3Zmt0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTI5ODM5NSwiZXhwIjoyMDgwODc0Mzk1fQ.5bJYWohY-ouYft3MMSWr0ulSd1LXQgt1YMM3A9hhUzE"
MIGRATION_FILE="supabase/migrations/003_complete_reset.sql"

echo "📖 Reading migration file: $MIGRATION_FILE"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Migration file not found!"
    exit 1
fi

SQL_CONTENT=$(cat "$MIGRATION_FILE")
echo "✅ Migration file loaded successfully"
echo "📏 SQL length: ${#SQL_CONTENT} characters"
echo ""
echo "================================================================================"
echo "🚀 Attempting to execute migration via Supabase API..."
echo "================================================================================"
echo ""

# Try method 1: Using the database REST API with a custom function
# First, we need to create a function that can execute arbitrary SQL
# But this creates a chicken-and-egg problem

# Try method 2: Using PostgREST to insert into a migration tracking table
# This also won't work for DDL

# Try method 3: Direct PostgreSQL connection
echo "🔌 Method: Direct PostgreSQL connection"
echo ""
echo "⚠️  This method requires the database password."
echo "Please enter your Supabase database password when prompted."
echo ""

# Construct connection string
DB_HOST="db.znqesarsluytxhuiwfkt.supabase.co"
DB_PORT="5432"
DB_NAME="postgres"
DB_USER="postgres"

echo "Connection details:"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo ""

# Check if psql is installed
if ! command -v psql &> /dev/null; then
    echo "❌ psql is not installed!"
    echo ""
    echo "Installation options:"
    echo "  macOS: brew install postgresql"
    echo "  Ubuntu: sudo apt-get install postgresql-client"
    echo "  Windows: Download from https://www.postgresql.org/download/"
    echo ""
    exit 1
fi

echo "✅ psql found"
echo ""
echo "🚀 Executing migration with psql..."
echo ""

# Execute with psql
PGPASSWORD="" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$MIGRATION_FILE"

EXIT_CODE=$?

echo ""
echo "================================================================================"

if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Migration executed successfully!"
    echo ""
    echo "🔍 Verifying migration..."
    echo ""

    # Verify by checking if profiles table exists
    PGPASSWORD="" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\dt public.profiles"

    echo ""
    echo "📋 Checking RLS policies..."
    PGPASSWORD="" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT schemaname, tablename, policyname FROM pg_policies WHERE tablename = 'profiles';"

else
    echo "❌ Migration failed with exit code: $EXIT_CODE"
    echo ""
    echo "Please check the error messages above."
fi

echo "================================================================================"
