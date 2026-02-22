// ============================================================================
// CREATOR WITHDRAWAL EDGE FUNCTION
// Handles manual withdrawal requests and eligibility checks for creators
// ============================================================================
//
// Endpoints:
// POST /creator-withdrawal
//   - action: 'withdraw' - Request manual withdrawal
//   - action: 'status' - Get withdrawal eligibility
//
// Security:
// - All operations require valid JWT authentication
// - STRIPE_SECRET_KEY is never exposed to client
// ============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { getUserFromToken, createServiceClient } from '../_shared/supabase.ts';
import { getStripeClient } from '../_shared/stripe.ts';
import { jsonResponse, errorResponse, unauthorizedResponse, serverErrorResponse } from '../_shared/response.ts';

interface WithdrawalRequest {
  action: 'withdraw' | 'status';
}

// Minimum withdrawal amount in cents (EUR 50)
const MINIMUM_WITHDRAWAL_CENTS = 5000;

// Cooldown period in hours
const COOLDOWN_HOURS = 72;

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Only accept POST
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    const user = await getUserFromToken(authHeader);

    if (!user) {
      return unauthorizedResponse('Invalid or missing authentication token');
    }

    // Parse request body
    const body: WithdrawalRequest = await req.json();
    const { action } = body;

    if (!action) {
      return errorResponse('Missing action parameter');
    }

    // Initialize Supabase client with service role
    const supabase = createServiceClient();

    // Get profile.id from auth user_id (CRITICAL: use profiles.id for DB operations)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.userId)
      .single();

    if (profileError || !profile) {
      console.error('Profile lookup error:', profileError);
      return errorResponse('Profile not found');
    }

    const creatorId = profile.id;

    switch (action) {
      case 'status': {
        return await handleGetStatus(supabase, creatorId);
      }
      case 'withdraw': {
        const stripe = getStripeClient();
        return await handleWithdraw(stripe, supabase, creatorId);
      }
      default: {
        return errorResponse(`Unknown action: ${action}`);
      }
    }
  } catch (error) {
    console.error('Withdrawal error:', error);
    return serverErrorResponse(
      error instanceof Error ? error.message : 'Failed to process withdrawal request'
    );
  }
});

// ============================================================================
// GET WITHDRAWAL STATUS
// Check if creator is eligible for withdrawal and return summary
// ============================================================================

async function handleGetStatus(
  supabase: ReturnType<typeof createServiceClient>,
  creatorId: string
): Promise<Response> {
  // Get creator billing info
  const { data: billing, error: billingError } = await supabase
    .from('creator_billing')
    .select(`
      stripe_account_id,
      stripe_account_status,
      pending_balance_cents,
      available_balance_cents,
      reserved_balance_cents,
      negative_balance_cents,
      last_withdrawal_at
    `)
    .eq('creator_id', creatorId)
    .single();

  if (billingError || !billing) {
    return errorResponse('Billing record not found');
  }

  // Calculate payout amount (available - negative balance)
  const payoutAmount = Math.max(0, (billing.available_balance_cents || 0) - (billing.negative_balance_cents || 0));

  // Check withdrawal eligibility
  const eligibility = checkWithdrawalEligibility(billing, payoutAmount);

  // Get pending balance details (days until available)
  const { data: pendingBalances } = await supabase
    .from('pending_balances')
    .select('net_amount_cents, available_at')
    .eq('creator_id', creatorId)
    .eq('status', 'pending')
    .order('available_at', { ascending: true });

  // Calculate next release date
  let nextReleaseDate: string | null = null;
  let nextReleaseAmount = 0;
  if (pendingBalances && pendingBalances.length > 0) {
    nextReleaseDate = pendingBalances[0].available_at;
    nextReleaseAmount = pendingBalances[0].net_amount_cents;
  }

  // Get reserve release schedule
  const { data: reserves } = await supabase
    .from('reserve_releases')
    .select('amount_cents, release_at')
    .eq('creator_id', creatorId)
    .eq('status', 'held')
    .order('release_at', { ascending: true })
    .limit(5);

  return jsonResponse({
    balances: {
      pending: billing.pending_balance_cents || 0,
      available: billing.available_balance_cents || 0,
      reserved: billing.reserved_balance_cents || 0,
      negative: billing.negative_balance_cents || 0,
      withdrawable: payoutAmount,
    },
    eligibility,
    nextPendingRelease: nextReleaseDate ? {
      date: nextReleaseDate,
      amount: nextReleaseAmount,
    } : null,
    reserveReleases: reserves || [],
    connectStatus: billing.stripe_account_status,
  });
}

// ============================================================================
// PROCESS WITHDRAWAL
// Create a manual withdrawal and transfer to Connect account
// ============================================================================

async function handleWithdraw(
  stripe: ReturnType<typeof getStripeClient>,
  supabase: ReturnType<typeof createServiceClient>,
  creatorId: string
): Promise<Response> {
  // Get creator billing info
  const { data: billing, error: billingError } = await supabase
    .from('creator_billing')
    .select(`
      stripe_account_id,
      stripe_account_status,
      available_balance_cents,
      negative_balance_cents,
      pending_balance_cents,
      reserved_balance_cents,
      last_withdrawal_at
    `)
    .eq('creator_id', creatorId)
    .single();

  if (billingError || !billing) {
    return errorResponse('Billing record not found');
  }

  // Calculate payout amount
  const availableBalance = billing.available_balance_cents || 0;
  const negativeBalance = billing.negative_balance_cents || 0;
  const payoutAmount = Math.max(0, availableBalance - negativeBalance);

  // Check eligibility
  const eligibility = checkWithdrawalEligibility(billing, payoutAmount);
  if (!eligibility.allowed) {
    return errorResponse(eligibility.message, 400);
  }

  // Create payout record
  const { data: payout, error: payoutError } = await supabase
    .from('payouts')
    .insert({
      creator_id: creatorId,
      amount_cents: payoutAmount,
      currency: 'EUR',
      type: 'manual',
      status: 'pending',
    })
    .select()
    .single();

  if (payoutError || !payout) {
    console.error('Failed to create payout record:', payoutError);
    return serverErrorResponse('Failed to initiate withdrawal');
  }

  try {
    // Create Stripe transfer to Connect account
    const transfer = await stripe.transfers.create({
      amount: payoutAmount,
      currency: 'eur',
      destination: billing.stripe_account_id!,
      metadata: {
        payout_id: payout.id,
        creator_id: creatorId,
        type: 'manual_withdrawal',
      },
    });

    // Update payout with Stripe transfer ID
    await supabase
      .from('payouts')
      .update({
        stripe_transfer_id: transfer.id,
        status: 'processing',
        processing_at: new Date().toISOString(),
      })
      .eq('id', payout.id);

    // Update creator billing
    const newAvailableBalance = availableBalance - payoutAmount;
    const newNegativeBalance = 0; // If there was negative balance, it's now paid off

    await supabase
      .from('creator_billing')
      .update({
        available_balance_cents: newAvailableBalance,
        negative_balance_cents: newNegativeBalance,
        last_withdrawal_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('creator_id', creatorId);

    // Create balance transaction record
    await supabase
      .from('balance_transactions')
      .insert({
        creator_id: creatorId,
        type: 'withdrawal',
        amount_cents: -payoutAmount, // Negative because it's a debit
        pending_after_cents: billing.pending_balance_cents || 0,
        available_after_cents: newAvailableBalance,
        reserved_after_cents: billing.reserved_balance_cents || 0,
        negative_after_cents: newNegativeBalance,
        reference_type: 'payout',
        reference_id: payout.id,
        stripe_id: transfer.id,
        description: 'Manual withdrawal',
      });

    // Mark payout as completed (transfer initiated successfully)
    await supabase
      .from('payouts')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', payout.id);

    return jsonResponse({
      success: true,
      payout: {
        id: payout.id,
        amount: payoutAmount,
        currency: 'EUR',
        status: 'completed',
        transferId: transfer.id,
      },
      newBalance: {
        available: newAvailableBalance,
        negative: newNegativeBalance,
      },
    });
  } catch (stripeError: unknown) {
    console.error('Stripe transfer error:', stripeError);

    // Update payout to failed
    const errorMessage = stripeError instanceof Error ? stripeError.message : 'Unknown error';
    const errorCode = typeof stripeError === 'object' && stripeError !== null && 'code' in stripeError
      ? (stripeError as { code: string }).code
      : 'unknown';

    await supabase
      .from('payouts')
      .update({
        status: 'failed',
        failed_at: new Date().toISOString(),
        failure_code: errorCode,
        failure_message: errorMessage,
      })
      .eq('id', payout.id);

    return serverErrorResponse(`Transfer failed: ${errorMessage}`);
  }
}

// ============================================================================
// WITHDRAWAL ELIGIBILITY CHECK
// ============================================================================

interface WithdrawalEligibility {
  allowed: boolean;
  reason?: 'CONNECT_NOT_ACTIVE' | 'COOLDOWN_ACTIVE' | 'BELOW_MINIMUM' | 'NEGATIVE_BALANCE';
  message: string;
  cooldownEndsAt?: string;
  currentAmount?: number;
  minimumAmount?: number;
}

function checkWithdrawalEligibility(
  billing: {
    stripe_account_id: string | null;
    stripe_account_status: string | null;
    last_withdrawal_at: string | null;
    negative_balance_cents?: number | null;
  },
  payoutAmount: number
): WithdrawalEligibility {
  // Check Connect status
  if (!billing.stripe_account_id || billing.stripe_account_status !== 'active') {
    return {
      allowed: false,
      reason: 'CONNECT_NOT_ACTIVE',
      message: 'Please complete Stripe Connect setup to receive payouts',
    };
  }

  // Check cooldown (72 hours)
  if (billing.last_withdrawal_at) {
    const lastWithdrawal = new Date(billing.last_withdrawal_at);
    const cooldownEnd = new Date(lastWithdrawal.getTime() + COOLDOWN_HOURS * 60 * 60 * 1000);
    const now = new Date();

    if (now < cooldownEnd) {
      return {
        allowed: false,
        reason: 'COOLDOWN_ACTIVE',
        message: `Please wait ${COOLDOWN_HOURS} hours between withdrawals`,
        cooldownEndsAt: cooldownEnd.toISOString(),
      };
    }
  }

  // Check minimum amount
  if (payoutAmount < MINIMUM_WITHDRAWAL_CENTS) {
    return {
      allowed: false,
      reason: 'BELOW_MINIMUM',
      message: 'Minimum withdrawal is EUR 50',
      currentAmount: payoutAmount,
      minimumAmount: MINIMUM_WITHDRAWAL_CENTS,
    };
  }

  return {
    allowed: true,
    message: 'Withdrawal available',
    currentAmount: payoutAmount,
  };
}
