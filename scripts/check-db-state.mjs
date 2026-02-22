import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://znqesarsluytxhuiwfkt.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpucWVzYXJzbHV5dHhodWl3Zmt0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTI5ODM5NSwiZXhwIjoyMDgwODc0Mzk1fQ.5bJYWohY-ouYft3MMSWr0ulSd1LXQgt1YMM3A9hhUzE';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function testSignup() {
  console.log('Testing signup flow...\n');

  const timestamp = new Date().getTime();
  const testEmail = `test${timestamp}@example.com`;
  const testPassword = 'TestPassword123!';

  console.log(`Creating user: ${testEmail}`);

  const { data, error } = await supabase.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
    user_metadata: {
      full_name: 'Test User',
      role: 'student'
    }
  });

  if (error) {
    console.log('❌ Signup error:', error.message);
    console.log('Error details:', JSON.stringify(error, null, 2));
    return;
  }

  console.log('✅ User created:', data.user.id);
  console.log('Email:', data.user.email);
  console.log('Metadata:', JSON.stringify(data.user.user_metadata));

  // Wait a moment for trigger to execute
  await new Promise(r => setTimeout(r, 1000));

  // Check if profile was created
  console.log('\nChecking profile creation...');
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', data.user.id)
    .single();

  if (profileError) {
    console.log('❌ Profile error:', profileError.message);
    console.log('Error code:', profileError.code);
  } else {
    console.log('✅ Profile created:', JSON.stringify(profile, null, 2));
  }

  // Cleanup - delete test user
  console.log('\nCleaning up test user...');
  const { error: deleteError } = await supabase.auth.admin.deleteUser(data.user.id);
  if (deleteError) {
    console.log('Delete error:', deleteError.message);
  } else {
    console.log('✅ Test user deleted');
  }
}

testSignup();
