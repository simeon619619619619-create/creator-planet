// ============================================================================
// RESIDENTS-EDIT
// One-shot edits for an existing persona — rename, avatar regen, bio regen.
// Inputs: { persona_id, new_display_name?, regen_avatar?: 'realistic'|'cartoon'|'fiction', regen_bio?: boolean }
// ============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

import { corsHeaders } from "../_residents/cors.ts";
const json = (b: unknown, s = 200, req?: Request) =>
  new Response(JSON.stringify(b, null, 2), {
    status: s,
    headers: { ...(req ? corsHeaders(req) : {}), 'Content-Type': 'application/json' },
  });

const ARCHETYPE_ROLE: Record<string, string> = {
  newbie: 'нов човек в темата, още не е сигурен дали ще се справи. Притеснен. Задава „глупави" въпроси.',
  rising_star: 'току-що започнал, но вече вижда напредък, споделя малки победи и моментум.',
  skeptic: 'прагматик, който задава твърди реалистични въпроси. Не атакува — пита.',
  empath: 'емоционално зрял човек, минал през трудни моменти, кратко подкрепя другите.',
  expert: 'някой с опит в съседна област, който споделя съвети по аналогия, без надменност.',
  lurker: 'тих наблюдател. Рядко пише. Когато пише — е дълго и рефлексивно.',
  connector: 'социален човек който свързва хора и теми. Често тагва другите.',
};

async function generateBio(archetype: string, displayName: string, communityName: string, communityDesc: string, geminiKey: string): Promise<string | null> {
  const role = ARCHETYPE_ROLE[archetype] ?? '';
  const prompt = `Ти си creative director, който създава реалистична персона за онлайн общност.

Общност: "${communityName}"
Описание на общността: ${communityDesc?.slice(0, 1500) ?? '(няма описание)'}

Архетип на персоната: ${archetype}
Роля на този архетип: ${role}
Име: ${displayName}

Напиши КРАТКО био (1-2 изречения, max 200 знака) на български, което:
- Описва кой е този човек СПЕЦИФИЧНО за тази общност (демография, защо е тук)
- Звучи като реален участник, не CV или продаваща визитка
- Отразява ролята на архетипа в темата на общността
- Без емоджи, без титли, без курсови продажби
- Първо лице („Аз съм..." или просто описание)

Върни САМО био-то. Без обяснения, без markdown.`;

  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.9, maxOutputTokens: 400, thinkingConfig: { thinkingBudget: 0 } },
      }),
    },
  );
  if (!r.ok) return null;
  const d = await r.json();
  const text: string | undefined = d?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  return text ?? null;
}

type AvatarStyle = 'realistic' | 'cartoon' | 'fiction';

const STYLE_PROMPTS: Record<AvatarStyle, (archetype: string) => string> = {
  realistic: (a) => {
    const desc: Record<string, string> = {
      newbie: 'a 32-year-old Bulgarian woman, kind face, slightly tired smile, simple clothes, soft natural lighting, mom-energy',
      rising_star: 'a 28-year-old Bulgarian man, casual t-shirt, slight smile, modern apartment background',
      skeptic: 'a 42-year-old Bulgarian man, salt-and-pepper hair, serious but kind face, business casual',
      empath: 'a 35-year-old Bulgarian woman, warm gentle smile, cozy sweater, soft window light',
      expert: 'a 40-year-old Bulgarian man, glasses, confident calm expression, smart casual shirt',
      lurker: 'a 30-year-old Bulgarian man, bookish, glasses, slightly serious face',
      connector: 'a 30-year-old Bulgarian woman, bright smile, stylish casual look, energetic vibe',
    };
    return `Realistic candid portrait photo of ${desc[a] ?? 'a person'}. Phone selfie style, slight grain, natural pose, looking at camera. Square crop. NOT studio.`;
  },
  cartoon: (a) => {
    const desc: Record<string, string> = {
      rising_star: 'energetic young man cartoon avatar, anime style, casual outfit, slight smile, hoodie or t-shirt, modern coloring',
      connector: 'young woman cartoon avatar, anime style, bright eyes, stylish outfit, friendly happy expression, vibrant colors',
      newbie: 'young woman cartoon avatar, soft watercolor style, gentle expression, casual sweater',
      empath: 'woman cartoon avatar, warm pastel colors, kind eyes, simple flat illustration',
      skeptic: 'man cartoon avatar, comic book style, slight smirk, glasses optional, plain background',
      expert: 'man cartoon avatar, professional style illustration, glasses, calm expression',
      lurker: 'man cartoon avatar, minimalist line art style, thoughtful expression, cool tones',
    };
    return `Square cartoon avatar illustration of ${desc[a] ?? 'a person'}. Stylized, NOT photorealistic. Clean simple background. Profile picture style, head and shoulders.`;
  },
  fiction: () => 'Square avatar of a fictional character — could be anime, video game, or fantasy style. Vibrant, distinctive, profile picture composition.',
};

async function generateAvatar(archetype: string, style: AvatarStyle, geminiKey: string): Promise<Uint8Array | null> {
  const prompt = STYLE_PROMPTS[style](archetype);
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
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(req) });
  try {
    const { persona_id, new_display_name, regen_avatar, regen_bio } = await req.json();
    if (!persona_id) return json({ error: 'persona_id required' }, 400, req);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: persona, error: pErr } = await supabase
      .from('community_personas')
      .select('id, archetype, profile_id, display_name, community_id, communities(name, description)')
      .eq('id', persona_id)
      .single();
    if (pErr || !persona) return json({ error: `persona: ${pErr?.message}` }, 404, req);

    const updates: Record<string, unknown> = {};

    let newBio: string | null = null;
    if (regen_bio) {
      const geminiKey = Deno.env.get('GEMINI_API_KEY');
      if (!geminiKey) return json({ error: 'GEMINI_API_KEY missing' }, 500, req);
      const community: any = persona.communities;
      newBio = await generateBio(
        persona.archetype,
        new_display_name ?? persona.display_name,
        community?.name ?? '',
        community?.description ?? '',
        geminiKey,
      );
      if (!newBio) return json({ error: 'bio generation failed' }, 500, req);
      updates.bio = newBio;
    }
    if (new_display_name) {
      updates.display_name = new_display_name;
      const { error: pUErr } = await supabase
        .from('profiles')
        .update({ full_name: new_display_name })
        .eq('id', persona.profile_id);
      if (pUErr) return json({ error: `profiles update: ${pUErr.message}` }, 500, req);
    }

    let avatarUrl: string | null = null;
    if (regen_avatar) {
      const geminiKey = Deno.env.get('GEMINI_API_KEY');
      if (!geminiKey) return json({ error: 'GEMINI_API_KEY missing' }, 500, req);
      const bytes = await generateAvatar(persona.archetype, regen_avatar as AvatarStyle, geminiKey);
      if (!bytes) return json({ error: 'avatar generation failed' }, 500, req);
      const path = `residents/${persona.profile_id}.png`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, bytes, {
        contentType: 'image/png',
        upsert: true,
      });
      if (upErr) return json({ error: `storage: ${upErr.message}` }, 500, req);
      const cacheBust = `?v=${Date.now()}`;
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      avatarUrl = pub.publicUrl + cacheBust;
      await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', persona.profile_id);
    }

    if (Object.keys(updates).length) {
      const { error: cuErr } = await supabase.from('community_personas').update(updates).eq('id', persona_id);
      if (cuErr) return json({ error: `personas update: ${cuErr.message}` }, 500, req);
    }

    return json({ ok: true, persona_id, updates, avatar_url: avatarUrl, bio: newBio }, 200, req);
  } catch (err) {
    return json({ error: (err as Error).message }, 500, req);
  }
});
