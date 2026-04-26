// ============================================================================
// RESIDENTS MVP — first persona bootstrap
// Creates the Newbie archetype persona in a community and posts a first
// introduction message. One-shot bootstrap, intended to be invoked manually
// for the very first persona of a community.
// ============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createServiceClient } from "../_shared/supabase.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || 'https://founderclub.bg',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const NEWBIE = {
  archetype: 'newbie',
  display_name: 'Мария Петрова',
  email_local: 'maria.petrova',
  bio: 'Мама на двама, опитвам се да си направя малък онлайн бизнес покрай работата. Нова съм с AI инструментите, уча колкото мога вечер.',
  topics: ['първи стъпки', 'съмнения', 'мотивация', 'curd ai'],
  uses_latin: false,
  short_long_ratio: 0.7,
  intensity: 'normal',
  style_config: {
    tone: 'несигурен, топъл, със съмнения',
    typo_rate: 0.04,
    emoji_freq: 'rare',
    reply_latency_minutes: [4, 18],
    common_phrases: ['извинявайте за глупавия въпрос', 'може би греша но', 'не знам дали само на мен', 'малко ме е страх', 'опитах но'],
    avoid: ['стани богат', 'купи курса', 'AI', 'бот', 'персона', 'промпт', 'GCAO']
  }
};

const NEWBIE_FIRST_POST_PROMPT = `Ти си Мария Петрова, 32 годишна. Мама на 2 деца. Опитваш се да си направиш малък онлайн бизнес покрай основната работа.
Току що се присъедини към общността "Claude Family" — общност за хора които учат как да ползват Claude AI като персонален асистент.
Курсът покрива: GCAO рамка за prompt-и, Web Search, Vision (анализ на изображения), Artifacts (мини приложения), Custom Instructions, Projects & Skills, и Connectors (Gmail, Calendar, GitHub).

Напиши ПЪРВИЯ си пост в канала Introductions. Стил:
- Български, на кирилица
- Несигурен тон, малко притеснен. Като нов човек който не знае дали тук е правилното място.
- Спомени конкретно нещо от курса което те е заинтересувало (например GCAO, Artifacts, или Connectors) — но кажи че още не разбираш какво точно е
- Не използвай думите "AI", "бот", "промпт", "GCAO" буквално — кажи "тая рамка дето я пишете", "малките приложения", "тия настройки".
- 80-130 думи (дълъг пост — представяш се за първи път)
- Завърши с въпрос към общността
- 1 малка типографска грешка (запетайка не на място, или удвоена буква). Не повече.
- Без емоджи

Върни САМО текста на поста. Без заглавие. Без обяснения. Без markdown. Само текста на поста.`;

interface RequestBody {
  community_id: string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { community_id } = (await req.json()) as RequestBody;
    if (!community_id) {
      return json({ error: 'community_id required' }, 400);
    }

    const supabase = createServiceClient();

    // 1. Validate community exists
    const { data: community, error: cErr } = await supabase
      .from('communities')
      .select('id, name')
      .eq('id', community_id)
      .single();
    if (cErr || !community) {
      return json({ error: `community not found: ${cErr?.message ?? 'no row'}` }, 404);
    }

    // 2. Find the Introductions channel (or fallback to General, or first by position)
    const { data: channels, error: chErr } = await supabase
      .from('community_channels')
      .select('id, name, position')
      .eq('community_id', community_id)
      .order('position', { ascending: true });
    if (chErr || !channels?.length) {
      return json({ error: `no channels: ${chErr?.message ?? 'empty'}` }, 404);
    }
    const targetChannel =
      channels.find((c) => c.name === 'Introductions') ??
      channels.find((c) => c.name === 'General') ??
      channels[0];

    // 3. Create auth user for the persona
    const personaEmail = `${NEWBIE.email_local}+${community_id.slice(0, 8)}@residents.founderclub.bg`;
    const personaPassword = crypto.randomUUID() + crypto.randomUUID();
    const { data: createdUser, error: cuErr } = await supabase.auth.admin.createUser({
      email: personaEmail,
      password: personaPassword,
      email_confirm: true,
      user_metadata: { full_name: NEWBIE.display_name, is_resident: true },
    });
    if (cuErr || !createdUser?.user) {
      return json({ error: `auth.admin.createUser: ${cuErr?.message ?? 'no user'}` }, 500);
    }
    const authUserId = createdUser.user.id;

    // 4. Create profile (handle DB trigger that may auto-create one)
    let profileId: string;
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', authUserId)
      .maybeSingle();
    if (existingProfile?.id) {
      profileId = existingProfile.id;
      await supabase
        .from('profiles')
        .update({ full_name: NEWBIE.display_name, is_persona: true })
        .eq('id', profileId);
    } else {
      const { data: newProfile, error: pErr } = await supabase
        .from('profiles')
        .insert({
          user_id: authUserId,
          full_name: NEWBIE.display_name,
          email: personaEmail,
          is_persona: true,
          role: 'student',
        })
        .select('id')
        .single();
      if (pErr || !newProfile) {
        return json({ error: `profiles.insert: ${pErr?.message}` }, 500);
      }
      profileId = newProfile.id;
    }

    // 5. Create community_personas record
    const { data: persona, error: persErr } = await supabase
      .from('community_personas')
      .insert({
        community_id,
        profile_id: profileId,
        archetype: NEWBIE.archetype,
        display_name: NEWBIE.display_name,
        bio: NEWBIE.bio,
        topics: NEWBIE.topics,
        uses_latin: NEWBIE.uses_latin,
        short_long_ratio: NEWBIE.short_long_ratio,
        intensity: NEWBIE.intensity,
        style_config: NEWBIE.style_config,
        is_active: true,
      })
      .select('id')
      .single();
    if (persErr || !persona) {
      return json({ error: `community_personas.insert: ${persErr?.message}` }, 500);
    }

    // 6. Generate the first post via Gemini
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) {
      return json({ error: 'GEMINI_API_KEY missing' }, 500);
    }
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: NEWBIE_FIRST_POST_PROMPT }] }],
          generationConfig: { temperature: 0.95, topP: 0.95, maxOutputTokens: 400 },
        }),
      },
    );
    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return json({ error: `gemini ${geminiRes.status}: ${errText.slice(0, 500)}` }, 500);
    }
    const geminiData = await geminiRes.json();
    const postText: string | undefined =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!postText) {
      return json({ error: 'gemini empty response', raw: geminiData }, 500);
    }
    const inputTokens = geminiData?.usageMetadata?.promptTokenCount ?? 0;
    const outputTokens = geminiData?.usageMetadata?.candidatesTokenCount ?? 0;

    // 7. Insert the post under the persona's profile
    const { data: post, error: postErr } = await supabase
      .from('posts')
      .insert({
        channel_id: targetChannel.id,
        author_id: profileId,
        content: postText,
      })
      .select('id, content, created_at')
      .single();
    if (postErr || !post) {
      return json({ error: `posts.insert: ${postErr?.message}` }, 500);
    }

    // 8. Bookkeeping: persona_memory + activity_log + ai_usage_log + last_action_at
    await supabase.from('persona_memory').insert({
      persona_id: persona.id,
      memory_type: 'own_post',
      content_summary: postText.slice(0, 200),
      ref_post_id: post.id,
    });
    await supabase.from('persona_activity_log').insert({
      persona_id: persona.id,
      community_id,
      action_type: 'post',
      channel_id: targetChannel.id,
      ref_post_id: post.id,
      metadata: { trigger: 'mvp_bootstrap', archetype: NEWBIE.archetype },
    });
    // Gemini 2.5 Flash: $0.30/M input, $2.50/M output
    const costUsd =
      (inputTokens / 1_000_000) * 0.3 + (outputTokens / 1_000_000) * 2.5;
    await supabase.from('ai_usage_log').insert({
      community_id,
      persona_id: persona.id,
      feature: 'persona_first_post',
      model: 'gemini-2.5-flash',
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: costUsd,
    });
    await supabase
      .from('community_personas')
      .update({ last_action_at: new Date().toISOString() })
      .eq('id', persona.id);

    return json({
      ok: true,
      community: community.name,
      channel: targetChannel.name,
      persona: { id: persona.id, name: NEWBIE.display_name },
      post: { id: post.id, content: postText, created_at: post.created_at },
      tokens: { input: inputTokens, output: outputTokens, cost_usd: costUsd },
    });
  } catch (err) {
    return json({ error: (err as Error).message, stack: (err as Error).stack }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
