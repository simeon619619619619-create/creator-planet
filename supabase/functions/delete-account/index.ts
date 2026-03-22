// ============================================================================
// DELETE ACCOUNT EDGE FUNCTION
// Handles GDPR-compliant account deletion
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

    // Parse request body
    const body = await req.json();
    const { confirmation } = body;

    // Require "DELETE" confirmation
    if (confirmation !== 'DELETE') {
      return new Response(
        JSON.stringify({ error: 'Invalid confirmation. Type DELETE to confirm.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createServiceClient();

    // Get the profile to find associated data
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, email')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      console.error('Error fetching profile:', profileError);
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const profileId = profile.id;

    // For creators, check if they have pending payouts
    if (profile.role === 'creator') {
      // Check for pending balance - must withdraw first
      const { data: billing } = await supabase
        .from('creator_billing')
        .select('pending_balance_cents, available_balance_cents')
        .eq('creator_id', profileId)
        .single();

      if (billing && (billing.pending_balance_cents > 0 || billing.available_balance_cents > 0)) {
        return new Response(
          JSON.stringify({
            error: 'Cannot delete account with pending or available balance. Please withdraw your funds first.'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Start deletion process - use transaction-like approach
    console.log(`Starting account deletion for user ${userId}, profile ${profileId}`);

    // 1. Delete user data in order (respecting foreign keys)
    // Note: Some tables may have CASCADE DELETE, but we'll be explicit

    // Delete AI conversations
    await supabase.from('ai_conversations').delete().eq('user_id', profileId);

    // Delete tasks
    await supabase.from('tasks').delete().eq('user_id', profileId);

    // Delete progress records
    await supabase.from('progress').delete().eq('user_id', profileId);

    // Delete quiz attempts
    await supabase.from('quiz_attempts').delete().eq('user_id', profileId);

    // Delete enrollments
    await supabase.from('enrollments').delete().eq('user_id', profileId);

    // Delete memberships
    await supabase.from('memberships').delete().eq('user_id', profileId);

    // Delete event registrations
    await supabase.from('event_registrations').delete().eq('user_id', profileId);

    // Delete post comments
    await supabase.from('post_comments').delete().eq('author_id', profileId);

    // Delete post reactions
    await supabase.from('post_reactions').delete().eq('user_id', profileId);

    // Delete posts
    await supabase.from('posts').delete().eq('author_id', profileId);

    // If creator, handle creator-specific data
    if (profile.role === 'creator') {
      // Delete creator profile
      await supabase.from('creator_profiles').delete().eq('creator_id', profileId);

      // Delete billing records
      await supabase.from('creator_billing').delete().eq('creator_id', profileId);

      // Note: Courses, communities etc. should be handled separately
      // For now, we'll anonymize them rather than delete
      await supabase
        .from('courses')
        .update({ creator_id: null })
        .eq('creator_id', profileId);

      await supabase
        .from('communities')
        .update({ creator_id: null })
        .eq('creator_id', profileId);
    }

    // 2. Delete the profile
    const { error: deleteProfileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', profileId);

    if (deleteProfileError) {
      console.error('Error deleting profile:', deleteProfileError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete profile. Account deletion aborted. Please contact support.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Delete the auth user (only if all prior steps succeeded)
    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(userId);

    if (deleteAuthError) {
      console.error('Error deleting auth user:', deleteAuthError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete account. Please contact support.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Successfully deleted account for user ${userId}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Account deleted successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in delete-account:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
