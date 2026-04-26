// ============================================================================
// RESIDENTS-CREATE
// Creates a persona of a given archetype in a community.
// - Picks display_name from archetype pool (deterministic per community)
// - Creates auth user + profile + community_personas record
// - Generates avatar via Gemini Image (best-effort, non-blocking)
// Inputs: { community_id, archetype }
// ============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { ARCHETYPES, type Archetype, pickName } from '../_residents/archetypes.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || 'https://founderclub.bg',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b, null, 2), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

async function generateAvatar(personaName: string, archetype: Archetype, geminiKey: string): Promise<Uint8Array | null> {
  // rising_star and connector use cartoon avatars (younger, casual personas)
  const useCartoon = archetype === 'rising_star' || archetype === 'connector';
  const cartoonDesc: Record<Archetype, string> = {
    newbie: 'young woman cartoon avatar, soft watercolor style, gentle expression',
    rising_star: 'energetic young man cartoon avatar, anime style, casual outfit, slight smile, hoodie or t-shirt, modern coloring',
    skeptic: 'man cartoon avatar, comic book style, slight smirk, glasses optional, plain background',
    empath: 'woman cartoon avatar, warm pastel colors, kind eyes, simple flat illustration',
    expert: 'man cartoon avatar, professional style illustration, glasses, calm expression',
    lurker: 'man cartoon avatar, minimalist line art style, thoughtful expression, cool tones',
    connector: 'young woman cartoon avatar, anime style, bright eyes, stylish outfit, friendly happy expression, vibrant colors',
  };
  const realisticDesc: Record<Archetype, string> = {
    newbie: 'a 32-year-old Bulgarian woman, kind face, slightly tired smile, simple clothes, soft natural lighting, mom-energy',
    rising_star: 'a 28-year-old Bulgarian man, casual t-shirt, slight smile, modern apartment background',
    skeptic: 'a 42-year-old Bulgarian man, salt-and-pepper hair, serious but kind face, business casual',
    empath: 'a 35-year-old Bulgarian woman, warm gentle smile, cozy sweater, soft window light',
    expert: 'a 40-year-old Bulgarian man, glasses, confident calm expression, smart casual shirt',
    lurker: 'a 30-year-old Bulgarian man, bookish, glasses, slightly serious face',
    connector: 'a 30-year-old Bulgarian woman, bright smile, stylish casual look, energetic vibe',
  };
  const prompt = useCartoon
    ? `Square cartoon avatar illustration of ${cartoonDesc[archetype]}. Stylized, NOT photorealistic. Clean simple background. Profile picture style, head and shoulders.`
    : `Realistic candid portrait photo of ${realisticDesc[archetype]}. Phone selfie style, slight grain, natural pose, looking at camera. Square crop. NOT studio. NOT model. Like a real person's profile photo.`;
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['IMAGE'] },
        }),
      },
    );
    if (!r.ok) {
      console.error('avatar gen failed', r.status, (await r.text()).slice(0, 300));
      return null;
    }
    const d = await r.json();
    const b64: string | undefined = d?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData?.data;
    if (!b64) return null;
    return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  } catch (e) {
    console.error('avatar exception', (e as Error).message);
    return null;
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const { community_id, archetype } = await req.json();
    if (!community_id) return json({ error: 'community_id required' }, 400);
    if (!archetype || !ARCHETYPES[archetype as Archetype]) return json({ error: 'invalid archetype' }, 400);

    const seed = ARCHETYPES[archetype as Archetype];
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Prevent duplicate archetype per community
    const { data: existing } = await supabase
      .from('community_personas')
      .select('id, display_name')
      .eq('community_id', community_id)
      .eq('archetype', archetype)
      .maybeSingle();
    if (existing) return json({ error: `archetype already exists: ${existing.display_name}`, persona_id: existing.id }, 409);

    const displayName = pickName(archetype as Archetype, community_id);
    const personaEmail = `${seed.email_local}+${community_id.slice(0, 8)}@residents.founderclub.bg`;
    const password = crypto.randomUUID() + crypto.randomUUID();

    const { data: created, error: cuErr } = await supabase.auth.admin.createUser({
      email: personaEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: displayName, is_resident: true },
    });
    if (cuErr || !created?.user) return json({ error: `auth: ${cuErr?.message}` }, 500);
    const userId = created.user.id;

    let profileId: string;
    const { data: existingProfile } = await supabase.from('profiles').select('id').eq('user_id', userId).maybeSingle();
    if (existingProfile) {
      profileId = existingProfile.id;
      await supabase.from('profiles').update({ full_name: displayName, is_persona: true }).eq('id', profileId);
    } else {
      const { data: prof, error: pErr } = await supabase
        .from('profiles')
        .insert({ user_id: userId, email: personaEmail, full_name: displayName, is_persona: true, role: 'student' })
        .select('id')
        .single();
      if (pErr || !prof) return json({ error: `profile: ${pErr?.message}` }, 500);
      profileId = prof.id;
    }

    // Avatar (best-effort, ~2-4s)
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (geminiKey) {
      const bytes = await generateAvatar(displayName, archetype as Archetype, geminiKey);
      if (bytes) {
        const path = `residents/${profileId}.png`;
        const { error: upErr } = await supabase.storage.from('avatars').upload(path, bytes, {
          contentType: 'image/png',
          upsert: true,
        });
        if (!upErr) {
          const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
          await supabase.from('profiles').update({ avatar_url: pub.publicUrl }).eq('id', profileId);
        }
      }
    }

    const bio = seed.bio_template;

    const { data: persona, error: pErr } = await supabase
      .from('community_personas')
      .insert({
        community_id,
        profile_id: profileId,
        archetype,
        display_name: displayName,
        bio,
        topics: seed.topics,
        uses_latin: seed.uses_latin,
        short_long_ratio: seed.short_long_ratio,
        intensity: seed.intensity,
        style_config: seed.style_config,
        is_active: true,
      })
      .select('id')
      .single();
    if (pErr || !persona) return json({ error: `persona: ${pErr?.message}` }, 500);

    // Ensure schedule config exists (master_enabled stays whatever it was)
    await supabase.from('persona_schedule_config').upsert(
      { community_id, master_enabled: false },
      { onConflict: 'community_id', ignoreDuplicates: true },
    );

    return json({
      ok: true,
      persona: { id: persona.id, archetype, display_name: displayName, profile_id: profileId },
    });
  } catch (err) {
    return json({ error: (err as Error).message, stack: (err as Error).stack }, 500);
  }
});
