// ============================================================================
// CUSTOM SIGNUP — Auto-confirmed, no email verification required
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { email, password, fullName, phone, marketingOptIn } = await req.json();

    if (!email || !password || !fullName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, password, fullName' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Create user with auto-confirmation (no email verification)
    const { data: userData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: 'student',
        marketing_opt_in: marketingOptIn ?? false,
        phone: phone || '',
      },
    });

    if (createError) {
      console.error('Create user error:', createError);
      // Map common errors to Bulgarian
      let errorMsg = createError.message;
      if (errorMsg.includes('already been registered')) {
        errorMsg = 'Вече съществува акаунт с този имейл. Опитайте с Вход.';
      }
      // Return 200 so supabase.functions.invoke passes the body to fnData
      return new Response(
        JSON.stringify({ success: false, error: errorMsg }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update phone on profile if provided
    if (phone && userData?.user?.id) {
      const uid = userData.user.id;
      for (let i = 0; i < 5; i++) {
        const { error: updateErr } = await supabase
          .from('profiles')
          .update({ phone })
          .eq('user_id', uid);
        if (!updateErr) break;
        await new Promise(r => setTimeout(r, 500));
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Account created' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Custom signup error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Възникна грешка. Моля, опитайте отново.' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
