// Flexible CORS headers — accept production domain, www, localhost, vercel previews.
const STATIC_ALLOWED = new Set([
  'https://founderclub.bg',
  'https://www.founderclub.bg',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:8080',
]);

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const allowOrigin =
    STATIC_ALLOWED.has(origin) || /\.vercel\.app$/.test(origin) || /\.founderclub\.bg$/.test(origin)
      ? origin
      : 'https://founderclub.bg';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}
