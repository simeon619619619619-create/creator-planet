// ============================================================================
// GHOST WRITER — SCHEDULED POST GENERATION
// Called by cron. Checks active schedules and generates posts via Gemini.
// Deploy: npx supabase functions deploy ghost-writer-post --no-verify-jwt
// ============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Minimum interval in ms for common cron patterns
function getMinIntervalMs(cron: string): number {
  // Simple heuristic based on cron expression
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) return 23 * 60 * 60 * 1000; // default 23h

  const [minute, hour, dayOfMonth, _month, dayOfWeek] = parts;

  // Weekly: specific day of week
  if (dayOfWeek !== '*' && dayOfMonth === '*') {
    return 6 * 24 * 60 * 60 * 1000; // ~6 days
  }
  // Monthly: specific day of month
  if (dayOfMonth !== '*') {
    return 27 * 24 * 60 * 60 * 1000; // ~27 days
  }
  // Every N hours
  if (hour.includes('/')) {
    const interval = parseInt(hour.split('/')[1]) || 24;
    return (interval - 1) * 60 * 60 * 1000;
  }
  // Specific hour = daily
  if (hour !== '*') {
    return 23 * 60 * 60 * 1000; // ~23h
  }
  // Every N minutes
  if (minute.includes('/')) {
    const interval = parseInt(minute.split('/')[1]) || 60;
    return (interval - 1) * 60 * 1000;
  }

  return 23 * 60 * 60 * 1000; // default daily
}

function isScheduleDue(lastRunAt: string | null, cron: string): boolean {
  if (!lastRunAt) return true;
  const elapsed = Date.now() - new Date(lastRunAt).getTime();
  return elapsed >= getMinIntervalMs(cron);
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
        generationConfig: { temperature: 0.8, maxOutputTokens: 1024 },
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

    if (configError) {
      console.error('Error fetching configs:', configError);
      return errorResponse('Failed to fetch configs', 500);
    }

    if (!configs || configs.length === 0) {
      return jsonResponse({ message: 'No active configs', processed: 0 });
    }

    let totalProcessed = 0;
    const errors: string[] = [];

    for (const config of configs) {
      // 2. Fetch active schedules for this config
      const { data: schedules, error: schedError } = await supabaseAdmin
        .from('ghost_writer_schedules')
        .select('*')
        .eq('config_id', config.id)
        .eq('is_active', true);

      if (schedError || !schedules) {
        errors.push(`Config ${config.id}: failed to fetch schedules`);
        continue;
      }

      for (const schedule of schedules) {
        // 3. Check if schedule is due
        if (!isScheduleDue(schedule.last_run_at, schedule.schedule_cron)) {
          continue;
        }

        try {
          // 4. Fetch last 5 posts from the channel for context
          const { data: recentPosts } = await supabaseAdmin
            .from('posts')
            .select('content, created_at')
            .eq('channel_id', schedule.channel_id)
            .order('created_at', { ascending: false })
            .limit(5);

          const postContext = (recentPosts ?? [])
            .map((p: { content: string; created_at: string }) => `[${p.created_at}] ${p.content}`)
            .join('\n');

          // 5. Build prompts and call Gemini
          const systemPrompt = `${config.persona_prompt}

You are writing a community post for a channel. Write as the creator/mentor.
Keep it concise, engaging, and authentic. Do NOT use markdown formatting.
Do NOT use asterisks, bold, or italic markers. Write plain text only.`;

          const userPrompt = `Post type: ${schedule.post_type}
${schedule.topic_hints ? `Topic hints: ${schedule.topic_hints}` : ''}

Recent posts in this channel (for context, avoid repeating):
${postContext || '(No recent posts)'}

Write a single community post. Just the post content, nothing else.`;

          const generatedContent = await callGemini(geminiKey, systemPrompt, userPrompt);

          if (!generatedContent.trim()) {
            errors.push(`Schedule ${schedule.id}: empty Gemini response`);
            continue;
          }

          // 6. Auto or preview mode
          if (config.approval_mode === 'auto') {
            // Insert directly into posts table
            const { error: postError } = await supabaseAdmin
              .from('posts')
              .insert({
                channel_id: schedule.channel_id,
                author_id: config.creator_id, // creator's profile_id
                content: generatedContent.trim(),
              });

            if (postError) {
              errors.push(`Schedule ${schedule.id}: failed to create post — ${postError.message}`);
              continue;
            }
          } else {
            // Insert into drafts for review
            const { error: draftError } = await supabaseAdmin
              .from('ghost_writer_drafts')
              .insert({
                community_id: config.community_id,
                schedule_id: schedule.id,
                channel_id: schedule.channel_id,
                content: generatedContent.trim(),
                status: 'pending',
              });

            if (draftError) {
              errors.push(`Schedule ${schedule.id}: failed to create draft — ${draftError.message}`);
              continue;
            }
          }

          // 7. Update last_run_at
          await supabaseAdmin
            .from('ghost_writer_schedules')
            .update({ last_run_at: new Date().toISOString() })
            .eq('id', schedule.id);

          totalProcessed++;
        } catch (scheduleError) {
          const msg = scheduleError instanceof Error ? scheduleError.message : String(scheduleError);
          errors.push(`Schedule ${schedule.id}: ${msg}`);
        }
      }
    }

    return jsonResponse({
      message: 'Ghost writer post cron complete',
      processed: totalProcessed,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Ghost writer post error:', error);
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return errorResponse(msg, 500);
  }
});
