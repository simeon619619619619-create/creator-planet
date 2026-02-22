// ============================================================================
// AI CHAT EDGE FUNCTION
// Handles AI chat requests using Gemini API for:
// - AI Success Manager (creator dashboard)
// - Community Chatbots (student-facing)
// ============================================================================
//
// Endpoints:
// POST /ai-chat
//   - messages: Array<{ role: 'user' | 'assistant', content: string }>
//   - systemInstruction: string (system prompt for the AI)
//   - apiKey: string (Gemini API key from frontend via VITE_OPENAI_API_KEY)
//   - userName?: string (optional user name for personalization)
//
// Response:
//   - { content: string } - The AI's response text
//
// Security:
// - API key is passed from frontend (VITE_OPENAI_API_KEY - actually Gemini key)
// ============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Clean up AI response formatting
function cleanResponse(text: string): string {
  return text
    // Remove markdown bold/italic markers
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Remove em dashes and replace with regular dashes
    .replace(/—/g, '-')
    .replace(/–/g, '-')
    // Remove bullet point markers at start of lines
    .replace(/^\s*[\*\-•]\s+/gm, '')
    // Clean up extra whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { messages, systemInstruction, apiKey, userName } = await req.json();

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Gemini API key not provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build enhanced system instruction with user name and formatting rules
    let enhancedInstruction = systemInstruction;
    if (userName) {
      enhancedInstruction = `${systemInstruction}\n\nIMPORTANT INSTRUCTIONS:\n- Address the user by their name: ${userName}\n- Use plain text formatting only - no asterisks, no bold, no italic markers\n- Use regular dashes (-) instead of em dashes\n- Write in a natural, conversational tone\n- Do not use bullet points with asterisks, use plain sentences instead`;
    } else {
      enhancedInstruction = `${systemInstruction}\n\nIMPORTANT INSTRUCTIONS:\n- Use plain text formatting only - no asterisks, no bold, no italic markers\n- Use regular dashes (-) instead of em dashes\n- Write in a natural, conversational tone\n- Do not use bullet points with asterisks, use plain sentences instead`;
    }

    // Convert OpenAI-style messages to Gemini format
    const geminiContents = messages.map((msg: { role: string; content: string }) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    // Call Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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

    // Clean up the response
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
