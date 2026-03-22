// ============================================================================
// AI CHAT EDGE FUNCTION
// Handles AI chat requests using Gemini API for:
// - AI Success Manager (creator dashboard)
// - Community Chatbots (student-facing)
// ============================================================================
//
// Security:
// - JWT authentication required (Supabase auth token)
// - Gemini API key stored server-side only (GEMINI_API_KEY env var)
// ============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getUserFromToken } from "../_shared/supabase.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || 'https://founderclub.bg',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Clean up AI response formatting
function cleanResponse(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/—/g, '-')
    .replace(/–/g, '-')
    .replace(/^\s*[\*\-•]\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify JWT — reject unauthenticated requests
    const authHeader = req.headers.get('Authorization');
    const authUser = await getUserFromToken(authHeader);
    if (!authUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Gemini API key from server-side environment
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) {
      console.error('GEMINI_API_KEY not configured in edge function secrets');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { messages, systemInstruction, userName } = await req.json();

    // Build enhanced system instruction
    let enhancedInstruction = systemInstruction || '';
    const formatRules = `\n\nIMPORTANT INSTRUCTIONS:\n- Use plain text formatting only - no asterisks, no bold, no italic markers\n- Use regular dashes (-) instead of em dashes\n- Write in a natural, conversational tone\n- Do not use bullet points with asterisks, use plain sentences instead`;

    if (userName) {
      enhancedInstruction += `\n\n- Address the user by their name: ${userName}` + formatRules;
    } else {
      enhancedInstruction += formatRules;
    }

    // Convert to Gemini format
    const geminiContents = messages.map((msg: { role: string; content: string }) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    // Call Gemini API with server-side key
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: geminiContents,
          systemInstruction: {
            parts: [{ text: enhancedInstruction }]
          },
          generationConfig: {
            maxOutputTokens: 500,
            temperature: 0.7
          }
        })
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('Gemini API Error:', error);
      return new Response(
        JSON.stringify({ error: error.error?.message || 'API request failed' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    let content = data.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't generate a response.";
    content = cleanResponse(content);

    return new Response(
      JSON.stringify({ content }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Edge Function Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
