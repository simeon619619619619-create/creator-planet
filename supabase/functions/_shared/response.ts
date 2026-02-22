// ============================================================================
// RESPONSE HELPERS
// Shared response utilities for Edge Functions
// ============================================================================

import { corsHeaders } from './cors.ts';

/**
 * Create a JSON success response
 */
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Create an error response
 */
export function errorResponse(message: string, status = 400): Response {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Create an unauthorized response
 */
export function unauthorizedResponse(message = 'Unauthorized'): Response {
  return errorResponse(message, 401);
}

/**
 * Create a forbidden response
 */
export function forbiddenResponse(message = 'Forbidden'): Response {
  return errorResponse(message, 403);
}

/**
 * Create a not found response
 */
export function notFoundResponse(message = 'Not found'): Response {
  return errorResponse(message, 404);
}

/**
 * Create a server error response
 */
export function serverErrorResponse(message = 'Internal server error'): Response {
  return errorResponse(message, 500);
}
