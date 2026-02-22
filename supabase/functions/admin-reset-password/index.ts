// ============================================================================
// ADMIN RESET PASSWORD EDGE FUNCTION
// Allows creators to reset passwords for their students
// ============================================================================

import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { createServiceClient, getUserFromToken } from '../_shared/supabase.ts';

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Only allow POST
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user authentication
    const authHeader = req.headers.get('Authorization');
    const userAuth = await getUserFromToken(authHeader);

    if (!userAuth) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { userId } = userAuth;
    const supabase = createServiceClient();

    // Verify the calling user is a creator
    const { data: callerProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('user_id', userId)
      .single();

    if (profileError || !callerProfile) {
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (callerProfile.role !== 'creator') {
      return new Response(
        JSON.stringify({ error: 'Only creators can reset student passwords' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body = await req.json();
    const { email, newPassword } = body;

    if (!email || !newPassword) {
      return new Response(
        JSON.stringify({ error: 'Email and newPassword are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate password length
    if (newPassword.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 6 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find the target user by email
    const { data: targetUsers, error: userError } = await supabase
      .from('profiles')
      .select('id, user_id, full_name, role')
      .eq('email', email)
      .limit(1);

    // If not found in profiles.email, try auth.users
    let targetUserId: string | null = null;
    let targetUserName: string | null = null;

    if (targetUsers && targetUsers.length > 0) {
      targetUserId = targetUsers[0].user_id;
      targetUserName = targetUsers[0].full_name;
    } else {
      // Look up in auth.users directly
      const { data: authUser } = await supabase.rpc('get_user_id_by_email', { target_email: email });

      if (!authUser) {
        // Fall back to direct query
        const { data: directUser } = await supabase
          .from('auth.users')
          .select('id')
          .eq('email', email)
          .single();

        if (directUser) {
          targetUserId = directUser.id;
        }
      } else {
        targetUserId = authUser;
      }
    }

    // If still not found, try using admin API to list users
    if (!targetUserId) {
      const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

      if (!listError && users) {
        const foundUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
        if (foundUser) {
          targetUserId = foundUser.id;
          targetUserName = foundUser.user_metadata?.full_name || email;
        }
      }
    }

    if (!targetUserId) {
      return new Response(
        JSON.stringify({ error: 'User not found with this email' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update the password using admin API
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      targetUserId,
      { password: newPassword }
    );

    if (updateError) {
      console.error('Error updating password:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update password: ' + updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Password reset for ${email} by creator ${callerProfile.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Password successfully reset for ${targetUserName || email}`,
        email: email
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in admin-reset-password:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
