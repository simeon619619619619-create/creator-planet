import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://znqesarsluytxhuiwfkt.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpucWVzYXJzbHV5dHhodWl3Zmt0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTI5ODM5NSwiZXhwIjoyMDgwODc0Mzk1fQ.5bJYWohY-ouYft3MMSWr0ulSd1LXQgt1YMM3A9hhUzE';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function verifyUser() {
  console.log('Checking users in database...\n');

  // Check auth.users via admin API
  const { data: authData, error: authError } = await supabase.auth.admin.listUsers();

  if (authError) {
    console.log('Auth admin error:', authError.message);
    return;
  }

  console.log('=== AUTH USERS ===');
  console.log('Total users:', authData.users.length);
  authData.users.forEach(u => {
    console.log(`\nUser: ${u.email}`);
    console.log(`  ID: ${u.id}`);
    console.log(`  Role: ${u.user_metadata?.role || 'not set'}`);
    console.log(`  Full Name: ${u.user_metadata?.full_name || 'not set'}`);
    console.log(`  Email Confirmed: ${u.email_confirmed_at ? 'Yes' : 'No'}`);
  });

  // Check profiles table
  console.log('\n=== PROFILES ===');
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('*');

  if (profileError) {
    console.log('Profiles error:', profileError.message);
    return;
  }

  console.log('Total profiles:', profiles.length);
  profiles.forEach(p => {
    console.log(`\nProfile for: ${p.email}`);
    console.log(`  ID: ${p.id}`);
    console.log(`  User ID: ${p.user_id}`);
    console.log(`  Role: ${p.role}`);
    console.log(`  Full Name: ${p.full_name}`);
    console.log(`  Created: ${p.created_at}`);
  });
}

verifyUser();
