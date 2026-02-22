// ============================================================================
// RELEASE PENDING BALANCES EDGE FUNCTION
// Moves funds from pending to available after 7-day hold period
// Also releases rolling reserves after 120-day period
// ============================================================================
//
// This function should be called daily by a cron job (pg_cron or external)
// It processes:
// 1. pending_balances where available_at <= NOW() and status = 'pending'
// 2. reserve_releases where release_at <= NOW() and status = 'held'
//
// Authentication:
// - Requires service role key or specific cron secret
// - Can be called via POST with JSON body: { "secret": "CRON_SECRET" }
// ============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { jsonResponse, errorResponse, serverErrorResponse, unauthorizedResponse } from '../_shared/response.ts';

interface ProcessingResult {
  pending_released: number;
  pending_amount_cents: number;
  reserves_released: number;
  reserve_amount_cents: number;
  errors: string[];
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only accept POST
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    // ========================================================================
    // AUTHENTICATION
    // Accept either:
    // 1. Service role key in Authorization header
    // 2. CRON_SECRET in request body
    // ========================================================================
    const authHeader = req.headers.get('Authorization');
    const cronSecret = Deno.env.get('CRON_SECRET');

    let isAuthorized = false;

    // Check service role key
    if (authHeader?.includes(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '')) {
      isAuthorized = true;
    }

    // Check cron secret in body
    if (!isAuthorized && cronSecret) {
      try {
        const body = await req.json();
        if (body.secret === cronSecret) {
          isAuthorized = true;
        }
      } catch {
        // Body parsing failed, continue with auth check
      }
    }

    // Allow if no auth is configured (development mode)
    if (!isAuthorized && !cronSecret) {
      console.warn('WARNING: No CRON_SECRET configured, allowing unauthenticated access');
      isAuthorized = true;
    }

    if (!isAuthorized) {
      return unauthorizedResponse('Invalid authentication');
    }

    const supabase = createServiceClient();
    const result: ProcessingResult = {
      pending_released: 0,
      pending_amount_cents: 0,
      reserves_released: 0,
      reserve_amount_cents: 0,
      errors: [],
    };

    // ========================================================================
    // PHASE 1: RELEASE PENDING BALANCES (7-day hold)
    // ========================================================================
    console.log('Phase 1: Processing pending balances...');

    const { data: pendingToRelease, error: pendingError } = await supabase
      .from('pending_balances')
      .select('*')
      .eq('status', 'pending')
      .lte('available_at', new Date().toISOString())
      .order('available_at', { ascending: true })
      .limit(100); // Process in batches

    if (pendingError) {
      console.error('Error fetching pending balances:', pendingError);
      result.errors.push(`Pending fetch error: ${pendingError.message}`);
    } else if (pendingToRelease && pendingToRelease.length > 0) {
      console.log(`Found ${pendingToRelease.length} pending balances to release`);

      for (const pending of pendingToRelease) {
        try {
          // Get current billing state
          const { data: billing } = await supabase
            .from('creator_billing')
            .select('*')
            .eq('creator_id', pending.creator_id)
            .single();

          if (!billing) {
            result.errors.push(`No billing for creator ${pending.creator_id}`);
            continue;
          }

          // Calculate new balances
          const newPending = Math.max(0, billing.pending_balance_cents - pending.net_amount_cents);
          const newAvailable = billing.available_balance_cents + pending.net_amount_cents;

          // Update pending_balance record
          await supabase
            .from('pending_balances')
            .update({
              status: 'released',
              released_at: new Date().toISOString(),
            })
            .eq('id', pending.id);

          // Update creator_billing
          await supabase
            .from('creator_billing')
            .update({
              pending_balance_cents: newPending,
              available_balance_cents: newAvailable,
              updated_at: new Date().toISOString(),
            })
            .eq('creator_id', pending.creator_id);

          // Create balance_transaction record
          await supabase
            .from('balance_transactions')
            .insert({
              creator_id: pending.creator_id,
              type: 'pending_released',
              amount_cents: pending.net_amount_cents,
              pending_after_cents: newPending,
              available_after_cents: newAvailable,
              reserved_after_cents: billing.reserved_balance_cents,
              negative_after_cents: billing.negative_balance_cents,
              reference_type: 'pending_balance',
              reference_id: pending.id,
              description: `Funds released: ${pending.product_name || 'unknown product'}`,
              metadata: {
                product_type: pending.product_type,
                gross_amount_cents: pending.gross_amount_cents,
                platform_fee_cents: pending.platform_fee_cents,
                stripe_fee_cents: pending.stripe_fee_cents,
                reserve_amount_cents: pending.reserve_amount_cents,
              },
            });

          result.pending_released++;
          result.pending_amount_cents += pending.net_amount_cents;

          console.log(`Released ${pending.net_amount_cents} cents for creator ${pending.creator_id}`);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';
          result.errors.push(`Error releasing pending ${pending.id}: ${errorMsg}`);
          console.error(`Error processing pending balance ${pending.id}:`, err);
        }
      }
    } else {
      console.log('No pending balances to release');
    }

    // ========================================================================
    // PHASE 2: RELEASE ROLLING RESERVES (120-day hold)
    // ========================================================================
    console.log('Phase 2: Processing reserve releases...');

    const { data: reservesToRelease, error: reserveError } = await supabase
      .from('reserve_releases')
      .select('*')
      .eq('status', 'held')
      .lte('release_at', new Date().toISOString())
      .order('release_at', { ascending: true })
      .limit(100); // Process in batches

    if (reserveError) {
      console.error('Error fetching reserves:', reserveError);
      result.errors.push(`Reserve fetch error: ${reserveError.message}`);
    } else if (reservesToRelease && reservesToRelease.length > 0) {
      console.log(`Found ${reservesToRelease.length} reserves to release`);

      for (const reserve of reservesToRelease) {
        try {
          // Get current billing state
          const { data: billing } = await supabase
            .from('creator_billing')
            .select('*')
            .eq('creator_id', reserve.creator_id)
            .single();

          if (!billing) {
            result.errors.push(`No billing for creator ${reserve.creator_id}`);
            continue;
          }

          // Calculate new balances
          const newReserved = Math.max(0, billing.reserved_balance_cents - reserve.amount_cents);
          const newAvailable = billing.available_balance_cents + reserve.amount_cents;

          // Update reserve_release record
          await supabase
            .from('reserve_releases')
            .update({
              status: 'released',
              released_at: new Date().toISOString(),
            })
            .eq('id', reserve.id);

          // Update creator_billing
          await supabase
            .from('creator_billing')
            .update({
              reserved_balance_cents: newReserved,
              available_balance_cents: newAvailable,
              updated_at: new Date().toISOString(),
            })
            .eq('creator_id', reserve.creator_id);

          // Create balance_transaction record
          await supabase
            .from('balance_transactions')
            .insert({
              creator_id: reserve.creator_id,
              type: 'reserve_release',
              amount_cents: reserve.amount_cents,
              pending_after_cents: billing.pending_balance_cents,
              available_after_cents: newAvailable,
              reserved_after_cents: newReserved,
              negative_after_cents: billing.negative_balance_cents,
              reference_type: 'reserve_release',
              reference_id: reserve.id,
              description: 'Rolling reserve released (120-day period complete)',
              metadata: {
                pending_balance_id: reserve.pending_balance_id,
              },
            });

          result.reserves_released++;
          result.reserve_amount_cents += reserve.amount_cents;

          console.log(`Released reserve of ${reserve.amount_cents} cents for creator ${reserve.creator_id}`);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';
          result.errors.push(`Error releasing reserve ${reserve.id}: ${errorMsg}`);
          console.error(`Error processing reserve ${reserve.id}:`, err);
        }
      }
    } else {
      console.log('No reserves to release');
    }

    // ========================================================================
    // SUMMARY
    // ========================================================================
    console.log('='.repeat(50));
    console.log('Release Pending Balances - Summary');
    console.log('='.repeat(50));
    console.log(`Pending released: ${result.pending_released} (${result.pending_amount_cents} cents)`);
    console.log(`Reserves released: ${result.reserves_released} (${result.reserve_amount_cents} cents)`);
    console.log(`Errors: ${result.errors.length}`);
    if (result.errors.length > 0) {
      console.log('Errors:', result.errors);
    }

    return jsonResponse({
      success: true,
      processed_at: new Date().toISOString(),
      ...result,
    });

  } catch (error) {
    console.error('Release pending balances error:', error);
    return serverErrorResponse(
      error instanceof Error ? error.message : 'Processing failed'
    );
  }
});
