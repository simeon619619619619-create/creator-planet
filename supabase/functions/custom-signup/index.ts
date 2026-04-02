// ============================================================================
// CUSTOM SIGNUP — Per-community branded confirmation emails
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

// Community email config — add new communities here
const COMMUNITY_EMAIL_CONFIG: Record<string, {
  resendApiKey: string;
  senderEmail: string;
  senderName: string;
}> = {
  'bosy-club': {
    resendApiKey: Deno.env.get('RESEND_API_KEY_BOSY') || '',
    senderEmail: 'marketing@bosy.bg',
    senderName: 'BOSY Club',
  },
};

const DEFAULT_EMAIL_CONFIG = {
  resendApiKey: Deno.env.get('RESEND_API_KEY_DEFAULT') || '',
  senderEmail: 'noreply@founderclub.bg',
  senderName: 'Founders Club',
};

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { email, password, fullName, phone, marketingOptIn, communitySlug, redirectPath } = await req.json();

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

    // Build redirect URL
    const baseUrl = 'https://founderclub.bg';
    const emailRedirectTo = redirectPath ? `${baseUrl}${redirectPath}` : baseUrl;

    // Generate signup link (creates user + returns confirmation link, does NOT send email)
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'signup',
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: 'student',
          marketing_opt_in: marketingOptIn ?? false,
          phone: phone || '',
        },
        redirectTo: emailRedirectTo,
      },
    });

    if (linkError) {
      console.error('Generate link error:', linkError);
      return new Response(
        JSON.stringify({ error: linkError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update phone on profile if provided
    if (phone && linkData?.user?.id) {
      const uid = linkData.user.id;
      // Retry because the trigger might not have created the profile yet
      for (let i = 0; i < 5; i++) {
        const { error: updateErr } = await supabase
          .from('profiles')
          .update({ phone })
          .eq('user_id', uid);
        if (!updateErr) break;
        await new Promise(r => setTimeout(r, 500));
      }
    }

    // Get the confirmation URL from the link data
    const confirmationUrl = linkData?.properties?.action_link;
    if (!confirmationUrl) {
      return new Response(
        JSON.stringify({ error: 'Failed to generate confirmation link' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine email config based on community
    const emailConfig = (communitySlug && COMMUNITY_EMAIL_CONFIG[communitySlug])
      ? COMMUNITY_EMAIL_CONFIG[communitySlug]
      : DEFAULT_EMAIL_CONFIG;

    // Send branded confirmation email via Resend
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${emailConfig.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${emailConfig.senderName} <${emailConfig.senderEmail}>`,
        to: [email],
        subject: `Потвърдете регистрацията си в ${emailConfig.senderName}`,
        html: buildConfirmationEmail(fullName, confirmationUrl, emailConfig.senderName),
      }),
    });

    if (!resendResponse.ok) {
      const resendError = await resendResponse.text();
      console.error('Resend error:', resendError);
      return new Response(
        JSON.stringify({ error: 'Failed to send confirmation email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Confirmation email sent' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Custom signup error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function buildConfirmationEmail(name: string, confirmUrl: string, brandName: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0A0A0A;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#151515;border-radius:12px;border:1px solid #1F1F1F;">
          <tr>
            <td style="padding:40px 32px;text-align:center;">
              <h1 style="color:#FAFAFA;font-size:22px;font-weight:700;margin:0 0 8px;">
                ${brandName}
              </h1>
              <p style="color:#A0A0A0;font-size:14px;margin:0 0 32px;">
                Потвърдете имейла си
              </p>
              <p style="color:#FAFAFA;font-size:15px;line-height:1.6;margin:0 0 24px;">
                Здравейте, ${name}!<br><br>
                Благодарим ви за регистрацията. Моля, кликнете бутона по-долу, за да потвърдите имейла си и да активирате акаунта си.
              </p>
              <a href="${confirmUrl}" style="display:inline-block;background-color:#D4AF37;color:#000000;font-weight:700;font-size:15px;padding:14px 32px;border-radius:8px;text-decoration:none;">
                Потвърди имейла
              </a>
              <p style="color:#666666;font-size:12px;margin:32px 0 0;line-height:1.5;">
                Ако не сте се регистрирали, можете спокойно да игнорирате този имейл.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #1F1F1F;text-align:center;">
              <p style="color:#666666;font-size:11px;margin:0;">
                &copy; ${new Date().getFullYear()} ${brandName}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
