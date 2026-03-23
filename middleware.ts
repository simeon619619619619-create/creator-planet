const SUPABASE_URL = 'https://ospbbeqiudjzcpqivmfg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zcGJiZXFpdWRqemNwcWl2bWZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MzI3ODcsImV4cCI6MjA4OTMwODc4N30.5_ZdvKI1koZ9PjBw7AdtsxMJE0FF3mnrJttNVaID_vY';

const BOT_PATTERNS = [
  'TelegramBot', 'Twitterbot', 'facebookexternalhit', 'LinkedInBot',
  'Slackbot', 'WhatsApp', 'Discordbot', 'Viber',
  'vkShare', 'Pinterestbot', 'Applebot',
];

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default async function middleware(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Only handle /community/:slug paths
  const match = pathname.match(/^\/community\/([^/]+)$/);
  if (!match) return fetch(request);

  const slugOrId = match[1];
  const ua = request.headers.get('user-agent') || '';

  // Only intercept bot requests
  const isBot = BOT_PATTERNS.some(bot => ua.includes(bot));
  if (!isBot) return fetch(request);

  // Fetch community data from Supabase
  try {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);
    const filter = isUUID ? `id=eq.${slugOrId}` : `slug=eq.${slugOrId}`;

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

    if (!community) return fetch(request);

    const title = escapeHtml(community.name);
    const description = escapeHtml(
      community.description
        ? community.description.substring(0, 200)
        : `Присъедини се към ${community.name} на Founders Club`
    );
    const image = community.thumbnail_url || 'https://www.founderclub.bg/og-image.png';
    const canonicalSlug = community.slug || community.id;
    const canonicalUrl = `https://www.founderclub.bg/community/${canonicalSlug}`;

    const html = `<!DOCTYPE html>
<html lang="bg">
<head>
  <meta charset="utf-8" />
  <title>${title} | Founders Club</title>
  <meta name="description" content="${description}" />

  <meta property="og:type" content="website" />
  <meta property="og:url" content="${canonicalUrl}" />
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

  <link rel="canonical" href="${canonicalUrl}" />
</head>
<body>
  <h1>${title}</h1>
  <p>${description}</p>
  <a href="${canonicalUrl}">Присъедини се към ${title}</a>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch {
    // On error, let the SPA handle it
    return fetch(request);
  }
}

export const config = {
  matcher: '/community/:slug*',
};
