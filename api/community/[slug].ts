import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readFileSync } from 'fs';
import { join } from 'path';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ospbbeqiudjzcpqivmfg.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

const BOT_USER_AGENTS = [
  'TelegramBot', 'Twitterbot', 'facebookexternalhit', 'LinkedInBot',
  'Slackbot', 'WhatsApp', 'Discordbot', 'Viber', 'Googlebot',
  'bingbot', 'YandexBot', 'vkShare', 'Pinterestbot',
];

function isBot(userAgent: string | undefined): boolean {
  if (!userAgent) return false;
  return BOT_USER_AGENTS.some(bot => userAgent.includes(bot));
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { slug } = req.query;
  const slugStr = Array.isArray(slug) ? slug[0] : slug;

  if (!slugStr) {
    return res.redirect(302, '/communities');
  }

  const ua = req.headers['user-agent'];

  // For non-bots, serve the SPA index.html so React Router handles routing
  if (!isBot(ua)) {
    try {
      const indexPath = join(process.cwd(), 'dist', 'index.html');
      const html = readFileSync(indexPath, 'utf-8');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(html);
    } catch {
      // Fallback: Vercel serves from output dir
      const indexPath = join(process.cwd(), 'index.html');
      try {
        const html = readFileSync(indexPath, 'utf-8');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(html);
      } catch {
        return res.redirect(302, '/');
      }
    }
  }

  // For bots, fetch community data and return HTML with dynamic OG tags
  try {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugStr);
    const filter = isUUID ? `id=eq.${slugStr}` : `slug=eq.${slugStr}`;

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/communities?${filter}&is_public=eq.true&select=id,name,description,thumbnail_url,slug`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );

    const communities = await response.json();
    const community = Array.isArray(communities) ? communities[0] : null;

    if (!community) {
      return res.redirect(302, '/communities');
    }

    const title = escapeHtml(community.name);
    const description = escapeHtml(
      community.description
        ? community.description.substring(0, 200)
        : `Присъедини се към ${community.name} на Founders Club`
    );
    const image = community.thumbnail_url || 'https://www.founderclub.bg/og-image.png';
    const canonicalSlug = community.slug || community.id;
    const url = `https://www.founderclub.bg/community/${canonicalSlug}`;

    const html = `<!DOCTYPE html>
<html lang="bg">
<head>
  <meta charset="utf-8" />
  <title>${title} | Founders Club</title>
  <meta name="description" content="${description}" />

  <meta property="og:type" content="website" />
  <meta property="og:url" content="${url}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${escapeHtml(image)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:site_name" content="Founders Club" />
  <meta property="og:locale" content="bg_BG" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${escapeHtml(image)}" />

  <link rel="canonical" href="${url}" />
</head>
<body>
  <h1>${title}</h1>
  <p>${description}</p>
  <a href="${url}">Присъедини се към ${title}</a>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).send(html);
  } catch (err) {
    console.error('OG tag generation error:', err);
    // Fallback: serve SPA
    try {
      const indexPath = join(process.cwd(), 'dist', 'index.html');
      const html = readFileSync(indexPath, 'utf-8');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(html);
    } catch {
      return res.redirect(302, '/');
    }
  }
}
