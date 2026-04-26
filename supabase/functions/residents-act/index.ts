// ============================================================================
// RESIDENTS-ACT
// Generates and posts a single action (new post or comment) for one persona.
// Inputs: { persona_id, mode?: 'post'|'comment'|'auto', target_post_id? }
// Reads persona config + recent feed + RAG knowledge + manual notes,
// generates content via Gemini 2.5 Flash, inserts into posts or post_comments.
// ============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

type Mode = 'post' | 'comment' | 'auto';
const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || 'https://founderclub.bg',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b, null, 2), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

async function embed(text: string, key: string): Promise<number[]> {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: { parts: [{ text }] }, outputDimensionality: 768 }),
    },
  );
  if (!r.ok) throw new Error(`embed ${r.status}`);
  const d = await r.json();
  return d.embedding.values;
}

async function gemini(prompt: string, key: string, maxOut = 1500): Promise<{ text: string; input: number; output: number }> {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.95,
          topP: 0.95,
          maxOutputTokens: maxOut,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    },
  );
  if (!r.ok) throw new Error(`gemini ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  const text: string = d?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
  return {
    text,
    input: d?.usageMetadata?.promptTokenCount ?? 0,
    output: d?.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

function decideLength(shortLongRatio: number): 'short' | 'long' {
  return Math.random() < shortLongRatio ? 'short' : 'long';
}

// Inject 3-5% random typos
function injectTypos(text: string, rate: number): string {
  if (rate <= 0) return text;
  const words = text.split(/(\s+)/);
  const out: string[] = [];
  for (const w of words) {
    if (/^\s+$/.test(w) || w.length < 4) {
      out.push(w);
      continue;
    }
    if (Math.random() < rate) {
      const i = 1 + Math.floor(Math.random() * (w.length - 2));
      const swap = w[i];
      out.push(w.slice(0, i) + w[i + 1] + swap + w.slice(i + 2));
    } else {
      out.push(w);
    }
  }
  return out.join('');
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const { persona_id, mode = 'auto', target_post_id } = await req.json();
    if (!persona_id) return json({ error: 'persona_id required' }, 400);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) return json({ error: 'GEMINI_API_KEY missing' }, 500);

    const { data: persona, error: pErr } = await supabase
      .from('community_personas')
      .select('*, communities(name)')
      .eq('id', persona_id)
      .single();
    if (pErr || !persona) return json({ error: `persona: ${pErr?.message}` }, 404);
    if (!persona.is_active) return json({ ok: false, reason: 'persona inactive' }, 200);

    const { data: cfg } = await supabase
      .from('persona_schedule_config')
      .select('manual_notes, master_enabled')
      .eq('community_id', persona.community_id)
      .maybeSingle();
    if (cfg && !cfg.master_enabled && req.headers.get('x-force') !== '1') {
      return json({ ok: false, reason: 'master disabled' }, 200);
    }

    const { data: channels } = await supabase
      .from('community_channels')
      .select('id, name, position')
      .eq('community_id', persona.community_id)
      .order('position', { ascending: true });
    const generalChannel = channels?.find((c: any) => c.name === 'General') ?? channels?.[0];
    if (!generalChannel) return json({ error: 'no channels' }, 404);

    // Decide mode
    let actualMode: Mode = mode;
    if (mode === 'auto') {
      const { data: lastActions } = await supabase
        .from('persona_activity_log')
        .select('action_type')
        .eq('persona_id', persona_id)
        .order('created_at', { ascending: false })
        .limit(3);
      const recentPosts = (lastActions ?? []).filter((a: any) => a.action_type === 'post').length;
      // Bias toward comments after 1+ recent posts
      actualMode = Math.random() < (recentPosts >= 1 ? 0.7 : 0.4) ? 'comment' : 'post';
    }

    // Recent feed (last 20)
    const { data: recentPosts } = await supabase
      .from('posts')
      .select('id, content, created_at, channel_id, profiles(full_name, is_persona)')
      .in('channel_id', channels?.map((c: any) => c.id) ?? [])
      .order('created_at', { ascending: false })
      .limit(20);

    // Rate limit: skip if real user posted in last 30 min and persona has acted recently
    const realUserRecent = (recentPosts ?? []).find((p: any) => {
      const isHuman = p.profiles && !p.profiles.is_persona;
      const recent = Date.now() - new Date(p.created_at).getTime() < 30 * 60 * 1000;
      return isHuman && recent;
    });
    if (realUserRecent && actualMode === 'post') {
      await supabase.from('persona_activity_log').insert({
        persona_id,
        community_id: persona.community_id,
        action_type: 'tick_skipped',
        metadata: { reason: 'real_user_recent_post' },
      });
      return json({ ok: false, reason: 'yielded to real user' });
    }

    // Pick target for comment mode
    let targetPost: any = null;
    if (actualMode === 'comment') {
      if (target_post_id) {
        const { data: tp } = await supabase.from('posts').select('id, content, channel_id, author_id').eq('id', target_post_id).single();
        targetPost = tp;
      } else {
        // Pick a recent post the persona hasn't commented on
        const candidates = (recentPosts ?? []).filter((p: any) => p.profiles?.full_name !== persona.display_name);
        if (!candidates.length) actualMode = 'post';
        else targetPost = candidates[Math.floor(Math.random() * Math.min(5, candidates.length))];
      }
    }

    // RAG retrieval
    const queryText = actualMode === 'comment' ? targetPost?.content ?? '' : persona.topics?.join(' ') ?? persona.bio;
    let knowledgeChunks: Array<{ content: string; title: string | null }> = [];
    if (queryText) {
      try {
        const qEmb = await embed(queryText.slice(0, 1500), geminiKey);
        const { data: matches } = await supabase.rpc('match_community_knowledge', {
          p_community_id: persona.community_id,
          p_query_embedding: qEmb,
          p_match_count: 4,
        });
        knowledgeChunks = matches ?? [];
      } catch (e) {
        console.error('RAG failed:', (e as Error).message);
      }
    }

    // Persona memory (last 5 own posts)
    const { data: memory } = await supabase
      .from('persona_memory')
      .select('content_summary, created_at')
      .eq('persona_id', persona_id)
      .order('created_at', { ascending: false })
      .limit(5);

    // Build prompt
    const length = decideLength(persona.short_long_ratio ?? 0.5);
    const lengthInstr =
      length === 'short' ? 'МНОГО КРАТКО: 8-25 думи. Едно изречение или две.' : 'ДЪЛГО: 110-200 думи. Развий мисълта.';

    const knowledgeSection = knowledgeChunks.length
      ? '\n\nКонтекст от курса (използвай естествено, не цитирай буквално):\n' +
        knowledgeChunks.map((k: any, i: number) => `[${i + 1}] ${k.content.slice(0, 600)}`).join('\n\n')
      : '';

    const memorySection = memory?.length
      ? '\n\nТвои предишни постове в общността (не повтаряй ги):\n' +
        memory.map((m: any) => `- ${m.content_summary?.slice(0, 120)}`).join('\n')
      : '';

    const recentSection = recentPosts?.length
      ? '\n\nПоследни постове в общността:\n' +
        recentPosts
          .slice(0, 8)
          .map((p: any) => `- ${p.profiles?.full_name ?? '?'}: ${p.content.slice(0, 150)}`)
          .join('\n')
      : '';

    const manualNotes = cfg?.manual_notes ? `\n\nВажни инструкции от създателя на общността (ИМАТ ПРИОРИТЕТ):\n${cfg.manual_notes}` : '';

    const styleHints = persona.style_config ?? {};
    const avoidList = (styleHints.avoid ?? []).join(', ');
    const phrasesList = (styleHints.common_phrases ?? []).slice(0, 3).join(' / ');

    const targetSection =
      actualMode === 'comment' && targetPost
        ? `\n\nКоментираш този пост:\n"${targetPost.content.slice(0, 500)}"\n`
        : '';

    const intro = actualMode === 'post' ? 'Напиши нов пост в общността.' : 'Напиши коментар на горния пост.';

    const prompt = `Ти си ${persona.display_name}.
${persona.bio}

ТВОЯТ СТИЛ:
- Тон: ${styleHints.tone ?? 'естествен'}
- Език: ${persona.uses_latin ? 'Български на ЛАТИНИЦА (например "kak si be", "mn qko") — естествено, не натрапено' : 'Кирилица'}
- Никога не използвай: ${avoidList}
- Фрази които понякога ползваш: ${phrasesList}

${manualNotes}

${recentSection}${memorySection}${knowledgeSection}${targetSection}

${intro}
${lengthInstr}

Стриктни правила:
1. НИКОГА не разкривай, че си AI/бот/асистент. Дръж се като реален човек.
2. НЕ препоръчвай курса, продукт или нещо за купуване.
3. Без markdown, без емоджи (освен ако стилът ти го позволява).
4. Звучи естествено, не perfect. Понякога една грешка в запетайките или сричките е ОК.
5. Не повтаряй вече казано от теб или от други.

Върни САМО текста на ${actualMode === 'post' ? 'поста' : 'коментара'}. Без заглавие, без markdown, без обяснения.`;

    const { text: rawText, input, output } = await gemini(prompt, geminiKey, length === 'short' ? 600 : 1500);
    if (!rawText) return json({ error: 'gemini empty' }, 500);

    const finalText = injectTypos(rawText, styleHints.typo_rate ?? 0.02);

    // Insert
    let insertedId: string;
    let refField: 'ref_post_id' | 'ref_comment_id';
    if (actualMode === 'post') {
      const { data: post, error: piErr } = await supabase
        .from('posts')
        .insert({ channel_id: generalChannel.id, author_id: persona.profile_id, content: finalText })
        .select('id')
        .single();
      if (piErr || !post) return json({ error: `post insert: ${piErr?.message}` }, 500);
      insertedId = post.id;
      refField = 'ref_post_id';
    } else {
      const { data: comment, error: ciErr } = await supabase
        .from('post_comments')
        .insert({ post_id: targetPost.id, author_id: persona.profile_id, content: finalText })
        .select('id')
        .single();
      if (ciErr || !comment) return json({ error: `comment insert: ${ciErr?.message}` }, 500);
      insertedId = comment.id;
      refField = 'ref_comment_id';
    }

    // Bookkeeping
    await supabase.from('persona_memory').insert({
      persona_id,
      memory_type: 'own_post',
      content_summary: finalText.slice(0, 200),
      [refField]: insertedId,
    });
    await supabase.from('persona_activity_log').insert({
      persona_id,
      community_id: persona.community_id,
      action_type: actualMode,
      channel_id: actualMode === 'post' ? generalChannel.id : targetPost?.channel_id,
      [refField]: insertedId,
      metadata: { length, knowledge_used: knowledgeChunks.length, target_post_id: targetPost?.id ?? null },
    });
    const cost = (input / 1_000_000) * 0.3 + (output / 1_000_000) * 2.5;
    await supabase.from('ai_usage_log').insert({
      community_id: persona.community_id,
      persona_id,
      feature: actualMode === 'post' ? 'persona_post' : 'persona_comment',
      model: 'gemini-2.5-flash',
      input_tokens: input,
      output_tokens: output,
      cost_usd: cost,
    });
    await supabase.from('community_personas').update({ last_action_at: new Date().toISOString() }).eq('id', persona_id);

    return json({
      ok: true,
      mode: actualMode,
      length,
      content: finalText,
      ref_id: insertedId,
      tokens: { input, output, cost_usd: cost },
    });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
