#!/usr/bin/env node

/**
 * Execute Supabase Migration using Direct Database API
 * Uses various methods to execute the SQL migration
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const SUPABASE_PROJECT_REF = 'znqesarsluytxhuiwfkt';
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

console.log('='.repeat(80));
console.log('🚀 EXECUTING MIGRATION ON SUPABASE');
console.log('='.repeat(80));
console.log(`\nProject: ${SUPABASE_PROJECT_REF}`);
console.log(`URL: ${SUPABASE_URL}\n`);

// Method 1: Try the pgmeta API directly
async function executePgMetaAPI() {
  console.log('📡 Method 1: Attempting via Supabase pgmeta API...\n');

  try {
    const response = await fetch(`${SUPABASE_URL}/pg/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({
        query: migrationSQL
      })
    });

    const responseText = await response.text();
    console.log(`Response Status: ${response.status}`);
    console.log(`Response: ${responseText}\n`);

    if (response.ok) {
      console.log('✅ Success!\n');
      return true;
    } else {
      console.log('⚠️  Failed\n');
      return false;
    }
  } catch (error) {
    console.log(`⚠️  Error: ${error.message}\n`);
    return false;
  }
}

// Method 2: Try creating a temporary function to execute SQL
async function executeViaTemporaryFunction() {
  console.log('📡 Method 2: Creating temporary SQL execution function...\n');

  // First, create a function that can execute arbitrary SQL
  const createFunctionSQL = `
    CREATE OR REPLACE FUNCTION public.exec_migration(sql_query TEXT)
    RETURNS TEXT
    SECURITY DEFINER
    SET search_path = public
    AS $$
    BEGIN
      EXECUTE sql_query;
      RETURN 'Success';
    EXCEPTION
      WHEN OTHERS THEN
        RETURN 'Error: ' || SQLERRM;
    END;
    $$ LANGUAGE plpgsql;
  `;

  try {
    // Try to create the function first
    const createResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_migration`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        sql_query: createFunctionSQL
      })
    });

    console.log(`Create function response: ${createResponse.status}`);

    if (!createResponse.ok) {
      console.log('⚠️  Could not create temporary function\n');
      return false;
    }

    // Now execute the migration
    const executeResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_migration`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        sql_query: migrationSQL
      })
    });

    const result = await executeResponse.text();
    console.log(`Execute migration response: ${executeResponse.status}`);
    console.log(`Result: ${result}\n`);

    if (executeResponse.ok && result.includes('Success')) {
      console.log('✅ Success!\n');
      return true;
    } else {
      console.log('⚠️  Failed\n');
      return false;
    }
  } catch (error) {
    console.log(`⚠️  Error: ${error.message}\n`);
    return false;
  }
}

// Method 3: Try browser automation approach
async function printManualInstructions() {
  console.log('='.repeat(80));
  console.log('📋 MANUAL EXECUTION REQUIRED');
  console.log('='.repeat(80));
  console.log('\n⚠️  Automatic execution via API is not supported by Supabase.');
  console.log('The migration must be executed manually via the Dashboard.\n');
  console.log('Please follow these steps:\n');
  console.log('1. Open the Supabase SQL Editor:');
  console.log(`   https://supabase.com/dashboard/project/${SUPABASE_PROJECT_REF}/sql/new\n`);
  console.log('2. Copy the entire SQL from the file:');
  console.log(`   ${MIGRATION_FILE}\n`);
  console.log('3. Paste it into the SQL editor');
  console.log('4. Click the "Run" button (or press Cmd/Ctrl + Enter)\n');
  console.log('5. Verify success - you should see:');
  console.log('   - "Migration 003 Complete" message');
  console.log('   - "5 policies created"');
  console.log('   - "1 triggers created"\n');
  console.log('='.repeat(80));

  // Save SQL to an easy-to-access file
  const outputFile = path.join(__dirname, 'MIGRATION_TO_RUN.sql');
  fs.writeFileSync(outputFile, migrationSQL);
  console.log(`\n✅ Migration SQL saved to: ${outputFile}`);
  console.log('   (Copy from this file for easier access)\n');

  // Print first few lines as preview
  console.log('='.repeat(80));
  console.log('📄 MIGRATION PREVIEW (first 40 lines):');
  console.log('='.repeat(80) + '\n');
  const lines = migrationSQL.split('\n');
  lines.slice(0, 40).forEach((line, idx) => {
    console.log(`${String(idx + 1).padStart(4, ' ')} │ ${line}`);
  });
  if (lines.length > 40) {
    console.log(`\n     ... and ${lines.length - 40} more lines`);
  }
  console.log('\n' + '='.repeat(80));
}

// Main execution
async function main() {
  // Try automatic methods
  let success = await executePgMetaAPI();
  if (!success) {
    success = await executeViaTemporaryFunction();
  }

  // If all automatic methods fail, provide manual instructions
  if (!success) {
    await printManualInstructions();
    console.log('\n💡 TIP: After running the migration in the Dashboard:');
    console.log('   - Check that the "profiles" table exists');
    console.log('   - Verify that 5 RLS policies are active');
    console.log('   - Test user signup to ensure the trigger works\n');
  } else {
    console.log('🎉 Migration executed successfully!');
    console.log('\n📋 Next steps:');
    console.log('   1. Verify the profiles table exists');
    console.log('   2. Check RLS policies are active');
    console.log('   3. Test user authentication flow\n');
  }
}

// Run the script
main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
