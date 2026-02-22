// ============================================================================
// SUPABASE CLIENT
// Shared Supabase client for Edge Functions
// ============================================================================

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

/**
 * Create a Supabase client with service role (for server-side operations)
 */
export function createServiceClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Create a Supabase client with user's JWT token
 */
export function createUserClient(authHeader: string): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Verify JWT token and get user ID
 *
 * IMPORTANT: Must extract token and pass it explicitly to getUser(token)
 * per Supabase docs: https://supabase.com/docs/guides/functions/auth
 */
export async function getUserFromToken(authHeader: string | null): Promise<{ userId: string } | null> {
  if (!authHeader) {
    console.error('No auth header provided');
    return null;
  }

  try {
    // Extract the JWT token from "Bearer <token>" format
    const token = authHeader.replace('Bearer ', '');

    if (!token || token === authHeader) {
      console.error('Invalid auth header format - expected "Bearer <token>"');
      return null;
    }

    const client = createUserClient(authHeader);

    // CRITICAL: Pass the token explicitly to getUser() for proper validation
    const { data: { user }, error } = await client.auth.getUser(token);

    if (error || !user) {
      console.error('Auth error:', error?.message || 'No user returned');
      return null;
    }

    return { userId: user.id };
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}
