// ============================================================================
// GHOST WRITER — PROACTIVE DMs
// Called by cron. Finds new, inactive, and at-risk students then sends
// personalized messages from the creator via Gemini.
// Deploy: npx supabase functions deploy ghost-writer-proactive --no-verify-jwt
// ============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type TriggerType = 'proactive_new_student' | 'proactive_inactive' | 'proactive_at_risk';

interface TriggerStudent {
  profileId: string;
  name: string;
  triggerType: TriggerType;
  context: string; // extra context for AI prompt
}

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
        generationConfig: { temperature: 0.8, maxOutputTokens: 512 },
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

    // 1. Fetch all active ghost writer configs
    const { data: configs, error: configError } = await supabaseAdmin
      .from('ghost_writer_config')
      .select('*')
      .eq('is_active', true);

    if (configError || !configs || configs.length === 0) {
      return jsonResponse({ message: 'No active configs', processed: 0 });
    }

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();

    let totalSent = 0;
    const errors: string[] = [];

    for (const config of configs) {
      const communityId = config.community_id;
      const creatorProfileId = config.creator_id;
      const triggerStudents: TriggerStudent[] = [];

      // ----------------------------------------------------------------
      // 2a. Find NEW students (joined in last 24h, no existing DM from creator)
      // ----------------------------------------------------------------
      try {
        const { data: newMembers } = await supabaseAdmin
          .from('memberships')
          .select('profile_id')
          .eq('community_id', communityId)
          .gte('joined_at', twentyFourHoursAgo);

        if (newMembers && newMembers.length > 0) {
          // Check which already have a creator conversation
          const { data: existingConvs } = await supabaseAdmin
            .from('direct_conversations')
            .select('student_profile_id')
            .eq('community_id', communityId)
            .eq('creator_profile_id', creatorProfileId);

          const existingSet = new Set(
            (existingConvs ?? []).map((c: { student_profile_id: string }) => c.student_profile_id)
          );

          for (const member of newMembers) {
            // Skip the creator themselves
            if (member.profile_id === creatorProfileId) continue;
            if (existingSet.has(member.profile_id)) continue;

            const { data: profile } = await supabaseAdmin
              .from('profiles')
              .select('display_name, full_name')
              .eq('id', member.profile_id)
              .single();

            triggerStudents.push({
              profileId: member.profile_id,
              name: profile?.display_name ?? profile?.full_name ?? 'Student',
              triggerType: 'proactive_new_student',
              context: 'This student just joined the community. Welcome them warmly.',
            });
          }
        }
      } catch (e) {
        errors.push(`Community ${communityId}: new student check failed — ${e}`);
      }

      // ----------------------------------------------------------------
      // 2b. Find INACTIVE students (last_activity > 3 days ago)
      // ----------------------------------------------------------------
      try {
        const { data: inactiveStudents } = await supabaseAdmin
          .from('student_health')
          .select('user_id, last_activity_at, status')
          .eq('community_id', communityId)
          .lt('last_activity_at', threeDaysAgo)
          .neq('status', 'dropped'); // don't message dropped students

        if (inactiveStudents && inactiveStudents.length > 0) {
          for (const student of inactiveStudents) {
            if (student.user_id === creatorProfileId) continue;

            const daysSince = Math.floor(
              (now.getTime() - new Date(student.last_activity_at).getTime()) / (24 * 60 * 60 * 1000)
            );

            const { data: profile } = await supabaseAdmin
              .from('profiles')
              .select('display_name, full_name')
              .eq('id', student.user_id)
              .single();

            triggerStudents.push({
              profileId: student.user_id,
              name: profile?.display_name ?? profile?.full_name ?? 'Student',
              triggerType: 'proactive_inactive',
              context: `This student has been inactive for ${daysSince} days. Re-engage them gently.`,
            });
          }
        }
      } catch (e) {
        errors.push(`Community ${communityId}: inactive check failed — ${e}`);
      }

      // ----------------------------------------------------------------
      // 2c. Find AT-RISK students (risk_score > 60)
      // ----------------------------------------------------------------
      try {
        const { data: atRiskStudents } = await supabaseAdmin
          .from('student_health')
          .select('user_id, risk_score, status, completion_rate')
          .eq('community_id', communityId)
          .gt('risk_score', 60)
          .neq('status', 'dropped');

        if (atRiskStudents && atRiskStudents.length > 0) {
          // Avoid duplicates with inactive list
          const alreadyTriggered = new Set(triggerStudents.map((s) => s.profileId));

          for (const student of atRiskStudents) {
            if (student.user_id === creatorProfileId) continue;
            if (alreadyTriggered.has(student.user_id)) continue;

            const { data: profile } = await supabaseAdmin
              .from('profiles')
              .select('display_name, full_name')
              .eq('id', student.user_id)
              .single();

            triggerStudents.push({
              profileId: student.user_id,
              name: profile?.display_name ?? profile?.full_name ?? 'Student',
              triggerType: 'proactive_at_risk',
              context: `This student has a risk score of ${student.risk_score}/100 and ${student.completion_rate}% completion. They need encouragement.`,
            });
          }
        }
      } catch (e) {
        errors.push(`Community ${communityId}: at-risk check failed — ${e}`);
      }

      // ----------------------------------------------------------------
      // 3. Process each trigger student
      // ----------------------------------------------------------------
      for (const student of triggerStudents) {
        try {
          // Check ghost_writer_dm_log to avoid duplicate messages (same student + trigger_type within 24h)
          const { data: recentLogs } = await supabaseAdmin
            .from('ghost_writer_dm_log')
            .select('id')
            .eq('community_id', communityId)
            .eq('student_id', student.profileId)
            .eq('trigger_type', student.triggerType)
            .gte('created_at', twentyFourHoursAgo)
            .limit(1);

          if (recentLogs && recentLogs.length > 0) {
            continue; // Already messaged this student for this trigger recently
          }

          // Get or create conversation
          let conversationId: string;

          const { data: existingConv } = await supabaseAdmin
            .from('direct_conversations')
            .select('id')
            .eq('community_id', communityId)
            .eq('creator_profile_id', creatorProfileId)
            .eq('student_profile_id', student.profileId)
            .single();

          if (existingConv) {
            conversationId = existingConv.id;
          } else {
            const { data: newConv, error: createError } = await supabaseAdmin
              .from('direct_conversations')
              .insert({
                community_id: communityId,
                creator_profile_id: creatorProfileId,
                student_profile_id: student.profileId,
                team_member_id: null,
              })
              .select('id')
              .single();

            if (createError || !newConv) {
              errors.push(`Student ${student.profileId}: failed to create conversation`);
              continue;
            }
            conversationId = newConv.id;
          }

          // Fetch student data points for context
          const { data: dataPoints } = await supabaseAdmin
            .from('student_data_points')
            .select('field_name, value')
            .eq('student_id', student.profileId)
            .eq('community_id', communityId)
            .order('collected_at', { ascending: false })
            .limit(10);

          const studentContext = dataPoints && dataPoints.length > 0
            ? `\nKnown data: ${dataPoints.map((d: { field_name: string; value: string }) => `${d.field_name}=${d.value}`).join(', ')}`
            : '';

          // Call Gemini
          const systemPrompt = `${config.persona_prompt}

You are writing a proactive direct message to a student as the creator/mentor.
Be personal, warm, and genuine. This should feel like a real message, not automated.
Do NOT use markdown formatting, asterisks, bold, or italic markers. Write plain text only.
Keep it to 2-4 sentences. Use the student's name.`;

          const userPrompt = `Student name: ${student.name}
Trigger: ${student.triggerType}
Context: ${student.context}${studentContext}

Write a personal DM to this student. Just the message, nothing else.`;

          const messageContent = await callGemini(geminiKey, systemPrompt, userPrompt);

          if (!messageContent.trim()) {
            errors.push(`Student ${student.profileId}: empty Gemini response`);
            continue;
          }

          // Insert message
          const { error: msgError } = await supabaseAdmin
            .from('direct_messages')
            .insert({
              conversation_id: conversationId,
              sender_profile_id: creatorProfileId,
              content: messageContent.trim(),
            });

          if (msgError) {
            errors.push(`Student ${student.profileId}: failed to send message — ${msgError.message}`);
            continue;
          }

          // Update conversation timestamp
          await supabaseAdmin
            .from('direct_conversations')
            .update({ last_message_at: new Date().toISOString() })
            .eq('id', conversationId);

          // Log in ghost_writer_dm_log
          await supabaseAdmin.from('ghost_writer_dm_log').insert({
            community_id: communityId,
            student_id: student.profileId,
            conversation_id: conversationId,
            trigger_type: student.triggerType,
            message_content: messageContent.trim(),
            data_extracted: null,
          });

          totalSent++;
        } catch (studentError) {
          const msg = studentError instanceof Error ? studentError.message : String(studentError);
          errors.push(`Student ${student.profileId}: ${msg}`);
        }
      }
    }

    return jsonResponse({
      message: 'Ghost writer proactive DMs complete',
      sent: totalSent,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Ghost writer proactive error:', error);
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return errorResponse(msg, 500);
  }
});
