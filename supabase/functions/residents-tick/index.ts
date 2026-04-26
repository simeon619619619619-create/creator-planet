// ============================================================================
// RESIDENTS-TICK
// Scheduler — invoked every 15 min by pg_cron.
// Picks active personas, rolls probability based on window/intensity,
// fires residents-act for those that pass the roll.
// ============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || 'https://founderclub.bg',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b, null, 2), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

function currentWindow(d: Date): 'morning' | 'midday' | 'evening' | 'night' {
  // Server time is UTC. BG is UTC+3 (summer) / UTC+2 (winter). Use UTC+2 baseline.
  const h = (d.getUTCHours() + 3) % 24;
  if (h >= 7 && h < 12) return 'morning';
  if (h >= 12 && h < 16) return 'midday';
  if (h >= 16 && h < 22) return 'evening';
  return 'night';
}

function intensityMultiplier(intensity: string, globalIntensity: string): number {
  const map: Record<string, number> = { quiet: 0.4, normal: 1.0, active: 1.8 };
  return (map[intensity] ?? 1.0) * (map[globalIntensity] ?? 1.0);
}

const BASE_TICK_PROBABILITY = 0.18; // ~1 action per 5 ticks for normal intensity in window

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const now = new Date();
    const window = currentWindow(now);
    const dayOfWeek = (now.getUTCDay() + (now.getUTCHours() + 3 >= 24 ? 1 : 0)) % 7;

    const { data: due, error } = await supabase.rpc('get_personas_due_for_tick');
    if (error) return json({ error: `rpc: ${error.message}` }, 500);
    const personas = due ?? [];

    const decisions: any[] = [];
    const fired: string[] = [];

    for (const p of personas) {
      const windowOk = !!p.active_windows?.[window];
      const dayOk = (p.active_days ?? [1, 2, 3, 4, 5, 6, 0]).includes(dayOfWeek);
      if (!windowOk || !dayOk) {
        decisions.push({ persona_id: p.persona_id, decision: 'skip', reason: !windowOk ? 'window' : 'day' });
        continue;
      }
      const mult = intensityMultiplier(p.intensity, p.global_intensity);
      const prob = Math.min(0.6, BASE_TICK_PROBABILITY * mult);
      const roll = Math.random();
      if (roll > prob) {
        decisions.push({ persona_id: p.persona_id, decision: 'skip', reason: 'roll', prob, roll });
        continue;
      }

      decisions.push({ persona_id: p.persona_id, decision: 'fire', prob, roll });

      // Log the decision (so we can see "ticks_skipped" rate)
      await supabase.from('persona_activity_log').insert({
        persona_id: p.persona_id,
        community_id: p.community_id,
        action_type: 'tick_decision',
        metadata: { fire: true, window, prob, roll, intensity: p.intensity, global: p.global_intensity },
      });

      // Fire residents-act async (don't await each — fire-and-forget within tick)
      const actUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/residents-act`;
      // We don't await the response — keep tick fast
      fetch(actUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({ persona_id: p.persona_id, mode: 'auto' }),
      }).catch((e) => console.error('act fire failed', p.persona_id, e));
      fired.push(p.persona_id);
    }

    return json({
      ok: true,
      now: now.toISOString(),
      window,
      day_of_week: dayOfWeek,
      total_due: personas.length,
      fired: fired.length,
      decisions,
    });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
