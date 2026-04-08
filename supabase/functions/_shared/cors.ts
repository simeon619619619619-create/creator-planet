// ============================================================================
// CORS HEADERS
// Shared CORS configuration for all Edge Functions
// ============================================================================

const ALLOWED_ORIGINS = [
  'https://founderclub.bg',
  'https://www.founderclub.bg',
  'http://localhost:5173',
  'http://localhost:3000',
];

const baseCorsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Vary': 'Origin',
};

/**
 * Build CORS headers for a specific request, echoing the origin back
 * if it's in the allowed list.
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || '';
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[1];
  return {
    ...baseCorsHeaders,
    'Access-Control-Allow-Origin': allowOrigin,
  };
}

/**
 * Legacy static export — kept for backwards compatibility.
 * Prefer getCorsHeaders(req) when a request is available.
 */
export const corsHeaders: Record<string, string> = {
  ...baseCorsHeaders,
  'Access-Control-Allow-Origin': 'https://www.founderclub.bg',
};

/**
 * Handle CORS preflight requests
 */
export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }
  return null;
}
