// ============================================================================
// GHOST WRITER — AUTO-REPLY TO DMs
// Called via HTTP POST when a new DM arrives.
// Body: { message_id, conversation_id, sender_profile_id }
// Deploy: npx supabase functions deploy ghost-writer-reply --no-verify-jwt
// ============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function callGemini(
  geminiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { temperature: 0.7, maxOutputTokens: 512 },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Gemini API error: ${err.error?.message ?? response.statusText}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

async function extractDataPoints(
  geminiKey: string,
  message: string,
  fields: unknown[]
): Promise<{ field_name: string; value: string }[]> {
  if (!fields || !Array.isArray(fields) || fields.length === 0) return [];

  const fieldNames = fields.map((f: unknown) => {
    if (typeof f === 'string') return f;
    if (typeof f === 'object' && f !== null && 'name' in f) return (f as { name: string }).name;
    return String(f);
  });

  const prompt = `Analyze this student message and extract any data points that match these fields: ${fieldNames.join(', ')}

Student message: "${message}"

Return ONLY a JSON array of objects with "field_name" and "value" keys.
If no data points are found, return an empty array [].
Example: [{"field_name": "goal", "value": "lose weight"}]`;

  try {
    const result = await callGemini(geminiKey, 'You are a data extraction assistant. Return only valid JSON.', prompt);
    const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    console.error('Data extraction failed, skipping');
    return [];
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createServiceClient();
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) {
      return errorResponse('GEMINI_API_KEY not configured', 500);
    }

    const { message_id, conversation_id, sender_profile_id } = await req.json();

    if (!conversation_id || !sender_profile_id) {
      return errorResponse('Missing conversation_id or sender_profile_id', 400);
    }

    // 1. Fetch the conversation
    const { data: conversation, error: convError } = await supabaseAdmin
      .from('direct_conversations')
      .select('*')
      .eq('id', conversation_id)
      .single();

    if (convError || !conversation) {
      return errorResponse('Conversation not found', 404);
    }

    const communityId = conversation.community_id;
    const creatorProfileId = conversation.creator_profile_id;

    // Ghost writer replies only work on creator-to-student conversations
    if (!creatorProfileId) {
      return jsonResponse({ skipped: true, reason: 'Not a creator conversation' });
    }

    // 2. Fetch ghost writer config for this community
    const { data: config, error: configError } = await supabaseAdmin
      .from('ghost_writer_config')
      .select('*')
      .eq('community_id', communityId)
      .eq('is_active', true)
      .single();

    if (configError || !config) {
      return jsonResponse({ skipped: true, reason: 'Ghost writer not active for this community' });
    }

    // 3. Check auto_reply_enabled
    if (!config.auto_reply_enabled) {
      return jsonResponse({ skipped: true, reason: 'Auto-reply disabled' });
    }

    // 4. Don't reply to the creator's own messages
    if (sender_profile_id === creatorProfileId) {
      return jsonResponse({ skipped: true, reason: 'Sender is the creator' });
    }

    const studentProfileId = conversation.student_profile_id;

    // 5. Fetch student profile
    const { data: studentProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, display_name, full_name, avatar_url')
      .eq('id', studentProfileId)
      .single();

    const studentName = studentProfile?.display_name ?? studentProfile?.full_name ?? 'Student';

    // 6. Fetch student data points
    const { data: dataPoints } = await supabaseAdmin
      .from('student_data_points')
      .select('field_name, value')
      .eq('student_id', studentProfileId)
      .eq('community_id', communityId)
      .order('collected_at', { ascending: false })
      .limit(20);

    // 7. Fetch student health (if exists)
    const { data: healthRecords } = await supabaseAdmin
      .from('student_health')
      .select('risk_score, status, last_activity_at, completion_rate, engagement_score')
      .eq('user_id', studentProfileId)
      .limit(1);

    const health = healthRecords?.[0] ?? null;

    // 8. Fetch last 20 messages in conversation
    const { data: messages } = await supabaseAdmin
      .from('direct_messages')
      .select('sender_profile_id, content, created_at')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: false })
      .limit(20);

    const chatHistory = (messages ?? [])
      .reverse()
      .map((m: { sender_profile_id: string; content: string }) =>
        `${m.sender_profile_id === creatorProfileId ? 'Creator' : 'Student'}: ${m.content}`
      )
      .join('\n');

    // 9. Build prompt and call Gemini
    const studentContext = [
      `Student name: ${studentName}`,
      dataPoints && dataPoints.length > 0
        ? `Known data: ${dataPoints.map((d: { field_name: string; value: string }) => `${d.field_name}=${d.value}`).join(', ')}`
        : null,
      health
        ? `Health: risk_score=${health.risk_score}, status=${health.status}, completion=${health.completion_rate}%`
        : null,
    ].filter(Boolean).join('\n');

    const systemPrompt = `${config.persona_prompt}

You are replying to a student's direct message as the creator/mentor.
Be personal, helpful, and encouraging. Keep replies concise (1-3 paragraphs max).
Do NOT use markdown formatting, asterisks, bold, or italic markers. Write plain text only.
Use the student's name naturally when appropriate.

${studentContext}`;

    const userPrompt = `Conversation history:
${chatHistory}

Reply to the student's latest message as the creator. Just the reply, nothing else.`;

    const replyContent = await callGemini(geminiKey, systemPrompt, userPrompt);

    if (!replyContent.trim()) {
      return errorResponse('Empty AI response', 500);
    }

    // 10. Insert reply as a direct message from creator
    const { error: msgError } = await supabaseAdmin
      .from('direct_messages')
      .insert({
        conversation_id,
        sender_profile_id: creatorProfileId,
        content: replyContent.trim(),
      });

    if (msgError) {
      console.error('Failed to insert reply:', msgError);
      return errorResponse('Failed to send reply', 500);
    }

    // Update conversation's last_message_at
    await supabaseAdmin
      .from('direct_conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversation_id);

    // 11. Try to extract data points from student's last message
    const studentLastMessage = (messages ?? []).find(
      (m: { sender_profile_id: string }) => m.sender_profile_id === sender_profile_id
    );

    let dataExtracted: Record<string, string> | null = null;

    if (studentLastMessage && config.data_collection_fields) {
      const extracted = await extractDataPoints(
        geminiKey,
        studentLastMessage.content,
        config.data_collection_fields as unknown[]
      );

      if (extracted.length > 0) {
        dataExtracted = {};
        const now = new Date().toISOString();
        const rows = extracted.map((p) => ({
          student_id: studentProfileId,
          community_id: communityId,
          field_name: p.field_name,
          value: p.value,
          collected_at: now,
          source_conversation_id: conversation_id,
        }));

        await supabaseAdmin.from('student_data_points').insert(rows);

        for (const p of extracted) {
          dataExtracted[p.field_name] = p.value;
        }
      }
    }

    // 12. Log in ghost_writer_dm_log
    await supabaseAdmin.from('ghost_writer_dm_log').insert({
      community_id: communityId,
      student_id: studentProfileId,
      conversation_id,
      trigger_type: 'auto_reply',
      message_content: replyContent.trim(),
      data_extracted: dataExtracted,
    });

    return jsonResponse({ success: true, replied: true });
  } catch (error) {
    console.error('Ghost writer reply error:', error);
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return errorResponse(msg, 500);
  }
});
