#!/usr/bin/env node

/**
 * Execute Supabase Migration Script
 * This script reads the SQL migration file and executes it on Supabase
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const SUPABASE_PROJECT_REF = 'znqesarsluytxhuiwfkt';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpucWVzYXJzbHV5dHhodWl3Zmt0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTI5ODM5NSwiZXhwIjoyMDgwODc0Mzk1fQ.5bJYWohY-ouYft3MMSWr0ulSd1LXQgt1YMM3A9hhUzE';
const MIGRATION_FILE = path.join(__dirname, 'supabase/migrations/003_complete_reset.sql');

// Read migration SQL
console.log('📖 Reading migration file:', MIGRATION_FILE);
let migrationSQL;
try {
  migrationSQL = fs.readFileSync(MIGRATION_FILE, 'utf8');
  console.log('✅ Migration file loaded successfully');
  console.log('📏 SQL length:', migrationSQL.length, 'characters');
} catch (error) {
  console.error('❌ Error reading migration file:', error.message);
  process.exit(1);
}

// Execute SQL using Supabase REST API
async function executeSQLViaREST(sql) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ query: sql });

    const options = {
      hostname: `${SUPABASE_PROJECT_REF}.supabase.co`,
      port: 443,
      path: '/rest/v1/rpc/exec_sql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: res.statusCode, data });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

// Alternative method: Execute via pgmeta API
async function executeSQLViaPgMeta(sql) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ query: sql });

    const options = {
      hostname: `${SUPABASE_PROJECT_REF}.supabase.co`,
      port: 443,
      path: '/pg/exec_sql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: res.statusCode, data });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

// Alternative method: Execute via PostgREST admin API
async function executeSQLViaPostgREST(sql) {
  return new Promise((resolve, reject) => {
    // PostgREST doesn't support arbitrary SQL execution
    // We need to use the Supabase client library or direct PostgreSQL connection
    reject(new Error('PostgREST method not suitable for DDL operations'));
  });
}

// Main execution
async function main() {
  console.log('\n🚀 Starting migration execution...\n');
  console.log('Target:', `https://${SUPABASE_PROJECT_REF}.supabase.co`);
  console.log('\n' + '='.repeat(80) + '\n');

  // Try Method 1: REST API
  console.log('📡 Method 1: Attempting execution via REST API...');
  try {
    const result = await executeSQLViaREST(migrationSQL);
    console.log('✅ Migration executed successfully via REST API!');
    console.log('Status Code:', result.statusCode);
    console.log('Response:', result.data);
    return;
  } catch (error) {
    console.log('⚠️  REST API method failed:', error.message);
  }

  // Try Method 2: PgMeta API
  console.log('\n📡 Method 2: Attempting execution via PgMeta API...');
  try {
    const result = await executeSQLViaPgMeta(migrationSQL);
    console.log('✅ Migration executed successfully via PgMeta API!');
    console.log('Status Code:', result.statusCode);
    console.log('Response:', result.data);
    return;
  } catch (error) {
    console.log('⚠️  PgMeta API method failed:', error.message);
  }

  console.log('\n' + '='.repeat(80));
  console.log('❌ All automatic methods failed.');
  console.log('\n📝 Manual execution options:');
  console.log('\n1. Use Supabase Dashboard SQL Editor:');
  console.log(`   - Visit: https://supabase.com/dashboard/project/${SUPABASE_PROJECT_REF}/sql/new`);
  console.log('   - Copy the content from:', MIGRATION_FILE);
  console.log('   - Paste and run in the SQL editor');
  console.log('\n2. Use psql command line (requires database password):');
  console.log('   psql -h db.znqesarsluytxhuiwfkt.supabase.co -U postgres -d postgres -f supabase/migrations/003_complete_reset.sql');
  console.log('\n3. Save SQL for manual execution:');

  const outputFile = path.join(__dirname, 'migration-to-execute.sql');
  fs.writeFileSync(outputFile, migrationSQL);
  console.log(`   SQL saved to: ${outputFile}`);

  console.log('\n' + '='.repeat(80) + '\n');
  process.exit(1);
}

// Run the script
main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
