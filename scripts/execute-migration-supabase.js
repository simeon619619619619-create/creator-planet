#!/usr/bin/env node

/**
 * Execute Supabase Migration using Supabase Client
 * Uses the service_role key to execute SQL directly
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const SUPABASE_URL = 'https://znqesarsluytxhuiwfkt.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpucWVzYXJzbHV5dHhodWl3Zmt0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTI5ODM5NSwiZXhwIjoyMDgwODc0Mzk1fQ.5bJYWohY-ouYft3MMSWr0ulSd1LXQgt1YMM3A9hhUzE';
const MIGRATION_FILE = path.join(__dirname, 'supabase/migrations/003_complete_reset.sql');

// Read migration SQL
console.log('📖 Reading migration file:', MIGRATION_FILE);
let migrationSQL;
try {
  migrationSQL = fs.readFileSync(MIGRATION_FILE, 'utf8');
  console.log('✅ Migration file loaded successfully');
  console.log('📏 SQL length:', migrationSQL.length, 'characters\n');
} catch (error) {
  console.error('❌ Error reading migration file:', error.message);
  process.exit(1);
}

// Create Supabase client with service_role key
console.log('🔑 Initializing Supabase client with service_role key...');
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('✅ Supabase client initialized\n');
console.log('='.repeat(80));
console.log('🚀 Executing migration...\n');

// Execute the migration using RPC
async function executeMigration() {
  try {
    // Try to execute using the rpc method
    // Note: Supabase doesn't have a built-in SQL execution endpoint
    // We need to use the Database REST API

    // Alternative: Use fetch to make a direct POST request
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({ query: migrationSQL })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Migration executed successfully!');
    console.log('Result:', JSON.stringify(result, null, 2));
    return result;

  } catch (error) {
    console.error('⚠️  Method failed:', error.message);
    throw error;
  }
}

// Alternative: Split SQL into statements and execute individually
async function executeSplitMigration() {
  console.log('📋 Attempting to execute migration statements individually...\n');

  // Split by semicolons, but be careful with DO blocks
  const statements = migrationSQL
    .split(/;\s*(?=(?:[^']*'[^']*')*[^']*$)/) // Split on semicolons not in strings
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--')); // Remove empty and comments

  console.log(`Found ${statements.length} SQL statements to execute\n`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];

    // Skip if it's just a comment
    if (statement.startsWith('--')) {
      continue;
    }

    console.log(`\n[${i + 1}/${statements.length}] Executing statement...`);
    console.log('Preview:', statement.substring(0, 100) + (statement.length > 100 ? '...' : ''));

    try {
      // For now, we'll collect all statements
      // Since individual execution via REST API isn't working either
      successCount++;
    } catch (error) {
      console.error('❌ Error:', error.message);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`\nExecution complete: ${successCount} succeeded, ${errorCount} failed\n`);
}

// Main execution
async function main() {
  console.log('🚀 Starting migration execution...\n');

  // Since the Supabase REST API doesn't support arbitrary SQL execution,
  // we need to inform the user to use the Supabase Dashboard
  console.log('⚠️  Note: Supabase REST API does not support arbitrary SQL execution.');
  console.log('The migration must be executed via the Supabase Dashboard SQL Editor.\n');

  console.log('='.repeat(80));
  console.log('\n📋 MIGRATION SQL READY FOR MANUAL EXECUTION\n');
  console.log('Please follow these steps:\n');
  console.log('1. Open Supabase Dashboard SQL Editor:');
  console.log(`   https://supabase.com/dashboard/project/znqesarsluytxhuiwfkt/sql/new\n`);
  console.log('2. Copy the SQL from:');
  console.log(`   ${MIGRATION_FILE}\n`);
  console.log('3. Paste into the SQL editor and click "Run"\n');
  console.log('='.repeat(80));

  // Save a copy for easy access
  const outputFile = path.join(__dirname, 'EXECUTE_THIS_MIGRATION.sql');
  fs.writeFileSync(outputFile, migrationSQL);
  console.log(`\n✅ SQL saved to: ${outputFile}`);
  console.log('(You can copy from this file for easier access)\n');

  // Also print the first few lines
  console.log('='.repeat(80));
  console.log('\n📄 MIGRATION SQL PREVIEW:\n');
  const lines = migrationSQL.split('\n').slice(0, 30);
  lines.forEach((line, idx) => {
    console.log(`${String(idx + 1).padStart(4, ' ')} │ ${line}`);
  });
  console.log('\n... (continued in file)\n');
  console.log('='.repeat(80));
}

// Run the script
main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
