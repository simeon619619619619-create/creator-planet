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

    // Find the target user by email — must be a student in caller's communities
    const { data: targetProfile, error: targetError } = await supabase
      .from('profiles')
      .select('id, user_id, full_name, role')
      .eq('email', email)
      .single();

    if (targetError || !targetProfile) {
      return new Response(
        JSON.stringify({ error: 'User not found with this email' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prevent resetting passwords for creators or superadmins
    if (targetProfile.role === 'creator' || targetProfile.role === 'superadmin') {
      return new Response(
        JSON.stringify({ error: 'Cannot reset password for this user role' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify target user is a member of one of the caller's communities
    const { data: callerCommunities } = await supabase
      .from('communities')
      .select('id')
      .eq('creator_id', callerProfile.id);

    const callerCommunityIds = (callerCommunities || []).map(c => c.id);

    if (callerCommunityIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'You have no communities' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: membership } = await supabase
      .from('community_members')
      .select('id')
      .eq('profile_id', targetProfile.id)
      .in('community_id', callerCommunityIds)
      .limit(1);

    if (!membership || membership.length === 0) {
      return new Response(
        JSON.stringify({ error: 'This user is not a member of your communities' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const targetUserId = targetProfile.user_id;
    const targetUserName = targetProfile.full_name;

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
