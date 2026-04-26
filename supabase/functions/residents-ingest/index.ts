// ============================================================================
// RESIDENTS-INGEST
// Ingests text content into community_knowledge with embeddings.
// Inputs:
//   { community_id, source_type, content?, gdoc_url?, title?, source_ref? }
// If gdoc_url is provided, fetches the doc as plain text.
// Splits into ~500-token chunks (≈ 2000 chars). Generates embeddings via
// Gemini text-embedding-004 and inserts rows into community_knowledge.
// ============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || 'https://founderclub.bg',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CHUNK_CHAR_SIZE = 2000;
const CHUNK_OVERLAP = 200;
const EMBED_DIM = 768;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function chunkText(text: string): string[] {
  const cleaned = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (cleaned.length <= CHUNK_CHAR_SIZE) return [cleaned];
  const chunks: string[] = [];
  let i = 0;
  while (i < cleaned.length) {
    const end = Math.min(i + CHUNK_CHAR_SIZE, cleaned.length);
    let cut = end;
    if (end < cleaned.length) {
      const para = cleaned.lastIndexOf('\n\n', end);
      const sent = cleaned.lastIndexOf('. ', end);
      cut = para > i + CHUNK_CHAR_SIZE / 2 ? para : sent > i + CHUNK_CHAR_SIZE / 2 ? sent + 1 : end;
    }
    chunks.push(cleaned.slice(i, cut).trim());
    if (cut >= cleaned.length) break;
    i = Math.max(cut - CHUNK_OVERLAP, i + 1);
  }
  return chunks.filter((c) => c.length > 50);
}

async function fetchGoogleDocText(url: string): Promise<string> {
  const m = url.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (!m) throw new Error('not a Google Doc URL');
  const docId = m[1];
  const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;
  const res = await fetch(exportUrl, { redirect: 'follow' });
  if (!res.ok) throw new Error(`gdoc fetch ${res.status}`);
  return await res.text();
}

async function embedBatch(texts: string[], geminiKey: string): Promise<number[][]> {
  const out: number[][] = [];
  for (const t of texts) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: { parts: [{ text: t }] },
          outputDimensionality: EMBED_DIM,
        }),
      },
    );
    if (!res.ok) throw new Error(`embed ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    const v: number[] | undefined = data?.embedding?.values;
    if (!v || v.length !== EMBED_DIM) throw new Error(`embed bad dim: ${v?.length}`);
    out.push(v);
  }
  return out;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const { community_id, source_type, gdoc_url, content, title, source_ref } = body;
    if (!community_id) return json({ error: 'community_id required' }, 400);
    if (!source_type) return json({ error: 'source_type required' }, 400);

    let rawText = content as string | undefined;
    let resolvedRef = source_ref as string | undefined;
    let resolvedTitle = title as string | undefined;
    if (!rawText && gdoc_url) {
      rawText = await fetchGoogleDocText(gdoc_url);
      resolvedRef = resolvedRef ?? gdoc_url;
      resolvedTitle = resolvedTitle ?? `gdoc:${gdoc_url.split('/').pop()}`;
    }
    if (!rawText) return json({ error: 'no content or gdoc_url' }, 400);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) return json({ error: 'GEMINI_API_KEY missing' }, 500);

    if (resolvedRef) {
      await supabase
        .from('community_knowledge')
        .delete()
        .eq('community_id', community_id)
        .eq('source_type', source_type)
        .eq('source_ref', resolvedRef);
    }

    const chunks = chunkText(rawText);
    if (!chunks.length) return json({ error: 'no chunks after split' }, 400);

    const embeddings = await embedBatch(chunks, geminiKey);

    const rows = chunks.map((c, i) => ({
      community_id,
      source_type,
      source_ref: resolvedRef ?? null,
      title: resolvedTitle ?? null,
      content: c,
      embedding: embeddings[i],
      chunk_index: i,
    }));
    const { error: insErr } = await supabase.from('community_knowledge').insert(rows);
    if (insErr) return json({ error: `insert: ${insErr.message}` }, 500);

    const totalChars = chunks.reduce((s, c) => s + c.length, 0);
    const approxTokens = Math.round(totalChars / 4);
    await supabase.from('ai_usage_log').insert({
      community_id,
      feature: 'knowledge_ingest',
      model: 'text-embedding-004',
      input_tokens: approxTokens,
      output_tokens: 0,
      cost_usd: (approxTokens / 1_000_000) * 0.025,
    });

    return json({ ok: true, chunks: chunks.length, total_chars: totalChars, approx_tokens: approxTokens });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
