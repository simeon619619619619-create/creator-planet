import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://znqesarsluytxhuiwfkt.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpucWVzYXJzbHV5dHhodWl3Zmt0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTI5ODM5NSwiZXhwIjoyMDgwODc0Mzk1fQ.5bJYWohY-ouYft3MMSWr0ulSd1LXQgt1YMM3A9hhUzE';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function testConnection() {
  console.log('Testing Supabase connection...');
  
  // First, check if profiles table exists
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .limit(1);
  
  if (error) {
    console.log('Profiles table error:', error.message);
    console.log('Error code:', error.code);
  } else {
    console.log('Profiles table exists, rows:', data.length);
  }
  
  // Check auth.users via admin API
  const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
  
  if (authError) {
    console.log('Auth admin error:', authError.message);
  } else {
    console.log('Auth users count:', authData.users.length);
    authData.users.forEach(u => {
      console.log(`  - ${u.email} (${u.id})`);
    });
  }
}

testConnection();
