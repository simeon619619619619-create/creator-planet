// ============================================================================
// PROCESS PAYOUTS EDGE FUNCTION
// Processes scheduled automatic payouts for eligible creators
// ============================================================================
//
// This function should be called weekly (Fridays) by a cron job (pg_cron or external)
// It processes creators with:
// - available_balance_cents >= 5000 (EUR 50 minimum)
// - stripe_account_status = 'active'
// - Deducts any negative_balance before payout
//
// Authentication:
// - Requires service role key or specific cron secret
// - Can be called via POST with JSON body: { "secret": "CRON_SECRET" }
// ============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { getStripeClient } from '../_shared/stripe.ts';
import { jsonResponse, errorResponse, serverErrorResponse, unauthorizedResponse } from '../_shared/response.ts';

interface ProcessingResult {
  processed: number;
  successful: number;
  failed: number;
  total_amount_cents: number;
  errors: PayoutError[];
  details: PayoutDetail[];
}

interface PayoutError {
  creator_id: string;
  amount_cents: number;
  error: string;
  stripe_error_code?: string;
}

interface PayoutDetail {
  creator_id: string;
  payout_id: string;
  amount_cents: number;
  transfer_id: string;
  status: 'completed' | 'failed';
}

// Minimum payout amount in cents (EUR 50)
const MINIMUM_PAYOUT_CENTS = 5000;

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
        const body = await req.clone().json();
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
    const stripe = getStripeClient();

    const result: ProcessingResult = {
      processed: 0,
      successful: 0,
      failed: 0,
      total_amount_cents: 0,
      errors: [],
      details: [],
    };

    // ========================================================================
    // FIND ELIGIBLE CREATORS
    // Criteria:
    // - available_balance_cents >= MINIMUM_PAYOUT_CENTS (5000 = EUR 50)
    // - stripe_account_status = 'active'
    // - Has a valid stripe_account_id
    // ========================================================================
    console.log('Finding eligible creators for automatic payout...');

    const { data: eligibleCreators, error: fetchError } = await supabase
      .from('creator_billing')
      .select(`
        creator_id,
        stripe_account_id,
        stripe_account_status,
        pending_balance_cents,
        available_balance_cents,
        reserved_balance_cents,
        negative_balance_cents
      `)
      .eq('stripe_account_status', 'active')
      .gte('available_balance_cents', MINIMUM_PAYOUT_CENTS)
      .not('stripe_account_id', 'is', null)
      .order('available_balance_cents', { ascending: false });

    if (fetchError) {
      console.error('Error fetching eligible creators:', fetchError);
      return serverErrorResponse(`Failed to fetch eligible creators: ${fetchError.message}`);
    }

    if (!eligibleCreators || eligibleCreators.length === 0) {
      console.log('No eligible creators found for payout');
      return jsonResponse({
        success: true,
        message: 'No eligible creators for payout',
        processed_at: new Date().toISOString(),
        ...result,
      });
    }

    console.log(`Found ${eligibleCreators.length} eligible creators`);

    // ========================================================================
    // PROCESS EACH CREATOR
    // For each eligible creator:
    // 1. Calculate payout amount (available - negative balance)
    // 2. Skip if resulting amount < minimum
    // 3. Create payout record
    // 4. Create Stripe Transfer
    // 5. Update balances
    // 6. Create audit trail
    // ========================================================================
    for (const creator of eligibleCreators) {
      result.processed++;

      try {
        const availableBalance = creator.available_balance_cents || 0;
        const negativeBalance = creator.negative_balance_cents || 0;

        // Calculate actual payout amount (deduct negative balance first)
        const payoutAmount = Math.max(0, availableBalance - negativeBalance);

        // Skip if below minimum after deducting negative balance
        if (payoutAmount < MINIMUM_PAYOUT_CENTS) {
          console.log(`Creator ${creator.creator_id}: Payout amount ${payoutAmount} below minimum after negative balance deduction`);
          continue;
        }

        console.log(`Processing creator ${creator.creator_id}: Payout ${payoutAmount} cents (available: ${availableBalance}, negative: ${negativeBalance})`);

        // Create payout record
        const { data: payout, error: payoutInsertError } = await supabase
          .from('payouts')
          .insert({
            creator_id: creator.creator_id,
            amount_cents: payoutAmount,
            currency: 'EUR',
            type: 'automatic',
            status: 'pending',
          })
          .select()
          .single();

        if (payoutInsertError || !payout) {
          throw new Error(`Failed to create payout record: ${payoutInsertError?.message}`);
        }

        try {
          // Create Stripe transfer to Connect account
          const transfer = await stripe.transfers.create({
            amount: payoutAmount,
            currency: 'eur',
            destination: creator.stripe_account_id!,
            metadata: {
              payout_id: payout.id,
              creator_id: creator.creator_id,
              type: 'automatic_payout',
              scheduled_run: new Date().toISOString(),
            },
          });

          // Update payout with transfer ID and set to processing
          await supabase
            .from('payouts')
            .update({
              stripe_transfer_id: transfer.id,
              status: 'processing',
              processing_at: new Date().toISOString(),
            })
            .eq('id', payout.id);

          // Calculate new balances
          // Payout amount already accounts for negative balance deduction (available - negative)
          // So after payout, negative balance is cleared
          const newAvailableBalance = availableBalance - payoutAmount;
          const newNegativeBalance = 0; // Cleared by the payout since payoutAmount = available - negative

          // Update creator billing
          await supabase
            .from('creator_billing')
            .update({
              available_balance_cents: newAvailableBalance,
              negative_balance_cents: newNegativeBalance,
              updated_at: new Date().toISOString(),
            })
            .eq('creator_id', creator.creator_id);

          // Create balance transaction record (audit trail)
          await supabase
            .from('balance_transactions')
            .insert({
              creator_id: creator.creator_id,
              type: 'payout',
              amount_cents: -payoutAmount, // Negative because it's a debit
              pending_after_cents: creator.pending_balance_cents || 0,
              available_after_cents: newAvailableBalance,
              reserved_after_cents: creator.reserved_balance_cents || 0,
              negative_after_cents: newNegativeBalance,
              reference_type: 'payout',
              reference_id: payout.id,
              stripe_id: transfer.id,
              description: 'Weekly automatic payout',
              metadata: {
                payout_type: 'automatic',
                negative_balance_cleared: negativeBalance,
              },
            });

          // Mark payout as completed
          await supabase
            .from('payouts')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
            })
            .eq('id', payout.id);

          result.successful++;
          result.total_amount_cents += payoutAmount;
          result.details.push({
            creator_id: creator.creator_id,
            payout_id: payout.id,
            amount_cents: payoutAmount,
            transfer_id: transfer.id,
            status: 'completed',
          });

          console.log(`Successfully processed payout ${payout.id} for creator ${creator.creator_id}: ${payoutAmount} cents (transfer: ${transfer.id})`);

        } catch (stripeError: unknown) {
          // Stripe transfer failed - update payout record
          const errorMessage = stripeError instanceof Error ? stripeError.message : 'Unknown Stripe error';
          const errorCode = typeof stripeError === 'object' && stripeError !== null && 'code' in stripeError
            ? (stripeError as { code: string }).code
            : 'unknown';

          console.error(`Stripe transfer failed for creator ${creator.creator_id}:`, stripeError);

          // Update payout to failed
          await supabase
            .from('payouts')
            .update({
              status: 'failed',
              failed_at: new Date().toISOString(),
              failure_code: errorCode,
              failure_message: errorMessage,
              retry_count: 1,
            })
            .eq('id', payout.id);

          result.failed++;
          result.errors.push({
            creator_id: creator.creator_id,
            amount_cents: payoutAmount,
            error: errorMessage,
            stripe_error_code: errorCode,
          });
          result.details.push({
            creator_id: creator.creator_id,
            payout_id: payout.id,
            amount_cents: payoutAmount,
            transfer_id: '',
            status: 'failed',
          });
        }

      } catch (processingError: unknown) {
        // General processing error for this creator
        const errorMessage = processingError instanceof Error ? processingError.message : 'Unknown error';
        console.error(`Error processing creator ${creator.creator_id}:`, processingError);

        result.failed++;
        result.errors.push({
          creator_id: creator.creator_id,
          amount_cents: creator.available_balance_cents || 0,
          error: errorMessage,
        });
      }
    }

    // ========================================================================
    // SUMMARY
    // ========================================================================
    console.log('='.repeat(50));
    console.log('Process Payouts - Summary');
    console.log('='.repeat(50));
    console.log(`Processed: ${result.processed} creators`);
    console.log(`Successful: ${result.successful}`);
    console.log(`Failed: ${result.failed}`);
    console.log(`Total amount: ${result.total_amount_cents} cents (EUR ${(result.total_amount_cents / 100).toFixed(2)})`);
    if (result.errors.length > 0) {
      console.log('Errors:', JSON.stringify(result.errors, null, 2));
    }

    return jsonResponse({
      success: true,
      message: `Processed ${result.successful} payouts, ${result.failed} failed`,
      processed_at: new Date().toISOString(),
      ...result,
    });

  } catch (error) {
    console.error('Process payouts error:', error);
    return serverErrorResponse(
      error instanceof Error ? error.message : 'Processing failed'
    );
  }
});
