// ============================================================================
// COMMUNITY CHECKOUT EDGE FUNCTION
// Handles Stripe Checkout sessions for paid community access
// ============================================================================
//
// Endpoints:
// POST /community-checkout
//   - Creates a Stripe Checkout session for community purchase
//   - Supports one-time payments and monthly subscriptions
//   - Uses Connect for automatic platform fee deduction
//
// Security:
// - Requires valid JWT authentication
// - Creates pending membership before checkout
// ============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { getUserFromToken, createServiceClient } from '../_shared/supabase.ts';
import { getStripeClient } from '../_shared/stripe.ts';
import { jsonResponse, errorResponse, unauthorizedResponse, serverErrorResponse } from '../_shared/response.ts';
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno';

interface CommunityCheckoutRequest {
  communityId: string;
  successUrl: string;
  cancelUrl: string;
  discountCode?: string; // Optional discount code
  checkoutMode?: 'one_time' | 'monthly'; // Required when pricing_type is 'both'
  useWalletBalance?: boolean; // Apply wallet balance to reduce charge
}

interface DiscountCodeData {
  id: string;
  code: string;
  discount_percent: number;
  duration_months: number | null;
  stripe_coupon_id: string | null;
}

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
    const body: CommunityCheckoutRequest = await req.json();
    const { communityId, successUrl, cancelUrl, discountCode, checkoutMode, useWalletBalance } = body;

    if (!communityId || !successUrl || !cancelUrl) {
      return errorResponse('Missing required fields: communityId, successUrl, cancelUrl');
    }

    // Initialize clients
    const stripe = getStripeClient();
    const supabase = createServiceClient();

    // Get user's profile ID (all database IDs reference profiles.id, not auth.users.id)
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('user_id', user.userId)
      .single();

    if (!profile) {
      return errorResponse('User profile not found');
    }

    const profileId = profile.id;

    // Get community with pricing and creator info
    const { data: community, error: communityError } = await supabase
      .from('communities')
      .select(`
        id,
        name,
        creator_id,
        pricing_type,
        price_cents,
        currency,
        stripe_product_id,
        stripe_price_id,
        monthly_price_cents,
        stripe_monthly_price_id
      `)
      .eq('id', communityId)
      .single();

    if (communityError || !community) {
      return errorResponse('Community not found');
    }

    // Validate pricing
    if (community.pricing_type === 'free') {
      return errorResponse('This community is free. Use the join endpoint instead.');
    }

    // Determine effective checkout mode for 'both' pricing
    const effectiveMode: 'one_time' | 'monthly' =
      community.pricing_type === 'both'
        ? (checkoutMode || 'one_time')
        : community.pricing_type === 'monthly'
          ? 'monthly'
          : 'one_time';

    if (community.pricing_type === 'both' && !checkoutMode) {
      return errorResponse('checkoutMode is required when pricing_type is both');
    }

    // Determine the price to use based on effective mode
    const activePriceCents = effectiveMode === 'monthly' && community.pricing_type === 'both'
      ? community.monthly_price_cents
      : community.price_cents;

    if (!activePriceCents || activePriceCents <= 0) {
      return errorResponse('Community price not configured');
    }

    // Check if user is already a paid member
    const { data: existingMembership } = await supabase
      .from('memberships')
      .select('id, payment_status, expires_at')
      .eq('community_id', communityId)
      .eq('user_id', profileId)
      .single();

    if (existingMembership) {
      // Check if membership is still valid
      if (existingMembership.payment_status === 'paid') {
        const expiresAt = existingMembership.expires_at;
        if (!expiresAt || new Date(expiresAt) > new Date()) {
          return errorResponse('You already have access to this community');
        }
      }
    }

    // Get creator's billing info for Connect account
    const { data: creatorBilling } = await supabase
      .from('creator_billing')
      .select(`
        stripe_account_id,
        stripe_account_status,
        plan:billing_plans(tier, platform_fee_percent)
      `)
      .eq('creator_id', community.creator_id)
      .single();

    if (!creatorBilling?.stripe_account_id) {
      return errorResponse('Creator has not set up payouts. Please contact the community owner.');
    }

    if (creatorBilling.stripe_account_status !== 'active') {
      return errorResponse('Creator payout account is not active. Please contact the community owner.');
    }

    // ========================================================================
    // DISCOUNT CODE VALIDATION (if provided)
    // ========================================================================
    let validatedDiscount: DiscountCodeData | null = null;
    let stripeCouponId: string | null = null;
    let originalPriceCents = activePriceCents;
    let discountAmountCents = 0;

    if (discountCode) {
      // Lookup discount code (case-insensitive)
      const { data: discountData, error: discountError } = await supabase
        .from('discount_codes')
        .select(`
          id,
          creator_id,
          code,
          discount_percent,
          duration_months,
          target_student_id,
          target_community_id,
          max_uses,
          current_uses,
          valid_from,
          valid_until,
          is_active,
          stripe_coupon_id
        `)
        .ilike('code', discountCode)
        .single();

      if (discountError || !discountData) {
        return errorResponse("This discount code doesn't exist");
      }

      // Validation checks
      if (!discountData.is_active) {
        return errorResponse('This discount code is no longer active');
      }

      if (discountData.valid_until && new Date(discountData.valid_until) < new Date()) {
        return errorResponse('This discount code has expired');
      }

      if (discountData.valid_from && new Date(discountData.valid_from) > new Date()) {
        return errorResponse('This discount code is not yet valid');
      }

      if (discountData.max_uses !== null && discountData.current_uses >= discountData.max_uses) {
        return errorResponse('This discount code has reached its usage limit');
      }

      if (discountData.target_student_id && discountData.target_student_id !== profileId) {
        return errorResponse('This discount code is not valid for your account');
      }

      if (discountData.target_community_id && discountData.target_community_id !== communityId) {
        return errorResponse("This discount code isn't valid for this community");
      }

      if (discountData.creator_id !== community.creator_id) {
        return errorResponse("This discount code isn't valid for this community");
      }

      // Check if user has already used this code
      const { data: existingRedemption } = await supabase
        .from('discount_redemptions')
        .select('id')
        .eq('discount_code_id', discountData.id)
        .eq('student_id', profileId)
        .limit(1)
        .maybeSingle();

      if (existingRedemption) {
        return errorResponse("You've already used this discount code");
      }

      // Create or get Stripe coupon (lazy creation with idempotency)
      if (discountData.stripe_coupon_id) {
        stripeCouponId = discountData.stripe_coupon_id;
      } else {
        // Create new Stripe coupon with proper error handling
        try {
          let duration: 'once' | 'repeating' | 'forever';
          let duration_in_months: number | undefined;

          if (discountData.duration_months === null) {
            duration = 'forever';
          } else if (discountData.duration_months === 1) {
            duration = 'once';
          } else {
            duration = 'repeating';
            duration_in_months = discountData.duration_months;
          }

          const coupon = await stripe.coupons.create({
            percent_off: discountData.discount_percent,
            duration,
            duration_in_months,
            metadata: {
              founders_club_code_id: discountData.id,
              creator_id: discountData.creator_id,
              code: discountData.code,
            },
          });

          stripeCouponId = coupon.id;

          // Save coupon ID back to database
          // Use try-catch to handle DB save failure - coupon is already created
          // If this fails, the next checkout attempt will create a duplicate coupon in Stripe
          // but the discount will still work. We log the error for manual cleanup.
          const { error: updateError } = await supabase
            .from('discount_codes')
            .update({ stripe_coupon_id: coupon.id })
            .eq('id', discountData.id);

          if (updateError) {
            console.error('Failed to save Stripe coupon ID to database. Coupon created:', coupon.id, 'Error:', updateError);
            // Don't fail checkout - the coupon was created and will work
            // Admin should reconcile orphaned coupons periodically
          }
        } catch (stripeError) {
          // Stripe coupon creation failed - user should retry or proceed without discount
          console.error('Failed to create Stripe coupon:', stripeError);
          return errorResponse('Unable to apply discount code. Please try again or proceed without the discount.');
        }
      }

      validatedDiscount = {
        id: discountData.id,
        code: discountData.code,
        discount_percent: discountData.discount_percent,
        duration_months: discountData.duration_months,
        stripe_coupon_id: stripeCouponId,
      };

      // Calculate discount amount for metadata
      discountAmountCents = Math.round(activePriceCents * (discountData.discount_percent / 100));
    }

    // Calculate the final price after any discount
    const finalPriceCents = validatedDiscount
      ? Math.max(0, activePriceCents - discountAmountCents)
      : activePriceCents;

    // ========================================================================
    // 100% DISCOUNT BYPASS - Grant free access without Stripe
    // ========================================================================
    if (finalPriceCents <= 0 && validatedDiscount) {
      // Guard: if user already has valid paid access, reject duplicate
      if (existingMembership?.payment_status === 'paid') {
        const expiresAt = (existingMembership as { expires_at?: string }).expires_at;
        if (!expiresAt || new Date(expiresAt) > new Date()) {
          return errorResponse('You already have access to this community');
        }
      }

      // Create or update membership directly as paid
      let membershipId: string;
      if (existingMembership) {
        await supabase
          .from('memberships')
          .update({ payment_status: 'paid' })
          .eq('id', existingMembership.id);
        membershipId = existingMembership.id;
      } else {
        const { data: newMembership, error: membershipError } = await supabase
          .from('memberships')
          .insert({
            community_id: communityId,
            user_id: profileId,
            role: 'member',
            payment_status: 'paid',
          })
          .select('id')
          .single();

        if (membershipError || !newMembership) {
          console.error('Failed to create free membership:', membershipError);
          return errorResponse('Failed to create membership record');
        }
        membershipId = newMembership.id;
      }

      // Record the discount redemption
      await supabase.from('discount_redemptions').insert({
        discount_code_id: validatedDiscount.id,
        student_id: profileId,
        community_id: communityId,
        original_amount_cents: activePriceCents,
        discount_amount_cents: discountAmountCents,
        final_amount_cents: 0,
      });

      // Increment usage count
      await supabase.rpc('increment_discount_usage', { code_id: validatedDiscount.id });

      // Record as a free purchase
      await supabase.from('community_purchases').insert({
        community_id: communityId,
        buyer_id: profileId,
        creator_id: community.creator_id,
        membership_id: membershipId,
        purchase_type: 'one_time',
        amount_cents: 0,
        currency: community.currency,
        platform_fee_cents: 0,
        stripe_fee_cents: 0,
        creator_payout_cents: 0,
        status: 'completed',
      });

      console.log(`100% discount applied: ${validatedDiscount.code} for community ${communityId} by ${profileId}`);

      // Return success URL directly - no Stripe checkout needed
      return jsonResponse({
        checkoutUrl: successUrl,
        sessionId: null,
        freeAccess: true,
      });
    }

    // ========================================================================
    // WALLET BALANCE DEDUCTION
    // ========================================================================
    let walletDeductionCents = 0;
    let chargeAmountCents = finalPriceCents;

    if (useWalletBalance && profileId) {
      const { data: wallet } = await supabase
        .from('wallets')
        .select('id, balance_cents')
        .eq('user_id', profileId)
        .eq('community_id', communityId)
        .single();

      if (wallet && wallet.balance_cents > 0) {
        walletDeductionCents = Math.min(wallet.balance_cents, finalPriceCents);
        chargeAmountCents = finalPriceCents - walletDeductionCents;

        // If wallet covers full amount — grant free access
        if (chargeAmountCents <= 0) {
          // Deduct from wallet
          await supabase
            .from('wallets')
            .update({
              balance_cents: wallet.balance_cents - walletDeductionCents,
              updated_at: new Date().toISOString(),
            })
            .eq('id', wallet.id);

          // Record spend transaction
          await supabase
            .from('wallet_transactions')
            .insert({
              wallet_id: wallet.id,
              type: 'spend',
              amount_cents: -walletDeductionCents,
              description: `Payment for ${community.name}`,
            });

          // Create/update membership as paid
          let membershipId: string;
          if (existingMembership) {
            await supabase
              .from('memberships')
              .update({ payment_status: 'paid', paid_at: new Date().toISOString() })
              .eq('id', existingMembership.id);
            membershipId = existingMembership.id;
          } else {
            const { data: newMem } = await supabase
              .from('memberships')
              .insert({
                community_id: communityId,
                user_id: profileId,
                role: 'member',
                payment_status: 'paid',
              })
              .select('id')
              .single();
            membershipId = newMem?.id || '';
          }

          await supabase.from('community_purchases').insert({
            community_id: communityId,
            buyer_id: profileId,
            creator_id: community.creator_id,
            membership_id: membershipId,
            purchase_type: 'one_time',
            amount_cents: 0,
            currency: community.currency,
            platform_fee_cents: 0,
            stripe_fee_cents: 0,
            creator_payout_cents: 0,
            status: 'completed',
          });

          console.log(`Full wallet payment: ${walletDeductionCents} cents from wallet for community ${communityId}`);

          return jsonResponse({
            checkoutUrl: successUrl,
            sessionId: null,
            freeAccess: true,
            walletUsed: walletDeductionCents,
          });
        }

        // Partial wallet deduction — deduct now, charge remainder via Stripe
        await supabase
          .from('wallets')
          .update({
            balance_cents: wallet.balance_cents - walletDeductionCents,
            updated_at: new Date().toISOString(),
          })
          .eq('id', wallet.id);

        await supabase
          .from('wallet_transactions')
          .insert({
            wallet_id: wallet.id,
            type: 'spend',
            amount_cents: -walletDeductionCents,
            description: `Partial payment for ${community.name}`,
          });

        console.log(`Partial wallet deduction: ${walletDeductionCents} cents, remaining charge: ${chargeAmountCents} cents`);
      }
    }

    // Calculate platform fee based on creator's plan
    // CRITICAL: Platform fee is calculated on the FINAL (discounted) price, not original
    // This ensures the fee percentage remains accurate for both creator and platform
    const feePercent = creatorBilling.plan?.platform_fee_percent ?? 6.9;
    const platformFee = Math.round(chargeAmountCents * (feePercent / 100));

    // Create or get Stripe product/price for this community
    let stripeProductId = community.stripe_product_id;

    // For 'both', pick the correct Stripe price ID column based on effective mode
    let stripePriceId = effectiveMode === 'monthly' && community.pricing_type === 'both'
      ? community.stripe_monthly_price_id
      : community.stripe_price_id;

    // Ensure product exists
    if (!stripeProductId) {
      const product = await stripe.products.create({
        name: `${community.name} - Community Access`,
        metadata: {
          community_id: communityId,
          creator_id: community.creator_id,
          platform: 'founders_club',
        },
      });
      stripeProductId = product.id;

      await supabase
        .from('communities')
        .update({ stripe_product_id: stripeProductId })
        .eq('id', communityId);
    }

    // Ensure price exists for the effective mode
    if (!stripePriceId) {
      const priceParams: Stripe.PriceCreateParams = {
        product: stripeProductId,
        currency: community.currency.toLowerCase(),
        unit_amount: activePriceCents,
        metadata: {
          community_id: communityId,
          pricing_type: community.pricing_type,
          effective_mode: effectiveMode,
        },
      };

      if (effectiveMode === 'monthly') {
        priceParams.recurring = { interval: 'month' };
      }

      const price = await stripe.prices.create(priceParams);
      stripePriceId = price.id;

      // Save to the correct column
      if (community.pricing_type === 'both' && effectiveMode === 'monthly') {
        await supabase
          .from('communities')
          .update({ stripe_monthly_price_id: stripePriceId })
          .eq('id', communityId);
      } else {
        await supabase
          .from('communities')
          .update({ stripe_price_id: stripePriceId })
          .eq('id', communityId);
      }
    }

    // If wallet partially used, create a one-time price for the reduced amount
    if (walletDeductionCents > 0 && chargeAmountCents > 0 && effectiveMode !== 'monthly') {
      const reducedPrice = await stripe.prices.create({
        product: stripeProductId,
        currency: community.currency.toLowerCase(),
        unit_amount: chargeAmountCents,
        metadata: {
          community_id: communityId,
          wallet_deduction_cents: walletDeductionCents.toString(),
          original_amount_cents: finalPriceCents.toString(),
        },
      });
      stripePriceId = reducedPrice.id;
    }

    // Create or update pending membership
    const membershipData = {
      community_id: communityId,
      user_id: profileId,
      role: 'member' as const,
      payment_status: 'pending',
    };

    let membershipId: string;

    if (existingMembership) {
      // Update existing membership to pending
      await supabase
        .from('memberships')
        .update({ payment_status: 'pending' })
        .eq('id', existingMembership.id);
      membershipId = existingMembership.id;
    } else {
      // Create new pending membership
      const { data: newMembership, error: membershipError } = await supabase
        .from('memberships')
        .insert(membershipData)
        .select('id')
        .single();

      if (membershipError || !newMembership) {
        console.error('Failed to create membership:', membershipError);
        return errorResponse('Failed to create membership record');
      }
      membershipId = newMembership.id;
    }

    // Create Stripe Checkout session
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: effectiveMode === 'monthly' ? 'subscription' : 'payment',
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: profile.email,
      metadata: {
        type: 'community_purchase',
        community_id: communityId,
        community_name: community.name,
        buyer_id: profileId,
        creator_id: community.creator_id,
        membership_id: membershipId,
        pricing_type: effectiveMode,
        platform_fee_cents: platformFee.toString(),
        // Discount tracking
        discount_code_id: validatedDiscount?.id || '',
        discount_code: validatedDiscount?.code || '',
        discount_percent: validatedDiscount?.discount_percent?.toString() || '',
        original_amount_cents: originalPriceCents.toString(),
        discount_amount_cents: discountAmountCents.toString(),
        wallet_deduction_cents: walletDeductionCents.toString(),
      },
    };

    // Apply discount coupon if present
    if (stripeCouponId) {
      sessionParams.discounts = [{ coupon: stripeCouponId }];
    }

    // Add Connect transfer for platform fee
    if (effectiveMode === 'monthly') {
      // For subscriptions, use subscription_data.application_fee_percent
      sessionParams.subscription_data = {
        application_fee_percent: feePercent,
        transfer_data: {
          destination: creatorBilling.stripe_account_id,
        },
        metadata: {
          type: 'community_subscription',
          community_id: communityId,
          buyer_id: profileId,
          creator_id: community.creator_id,
          membership_id: membershipId,
        },
      };
    } else {
      // For one-time payments, use payment_intent_data.application_fee_amount
      sessionParams.payment_intent_data = {
        application_fee_amount: platformFee,
        transfer_data: {
          destination: creatorBilling.stripe_account_id,
        },
        metadata: {
          type: 'community_purchase',
          community_id: communityId,
          buyer_id: profileId,
          creator_id: community.creator_id,
          membership_id: membershipId,
        },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    // Create pending purchase record (store the actual charged amount, not original)
    const { error: purchaseError } = await supabase
      .from('community_purchases')
      .insert({
        community_id: communityId,
        buyer_id: profileId,
        creator_id: community.creator_id,
        membership_id: membershipId,
        purchase_type: effectiveMode,
        amount_cents: finalPriceCents,
        currency: community.currency,
        platform_fee_cents: platformFee,
        stripe_fee_cents: 0,
        creator_payout_cents: 0,
        stripe_checkout_session_id: session.id,
        status: 'pending',
      });

    if (purchaseError) {
      console.error('Failed to create purchase record:', purchaseError);
      // Don't fail checkout - webhook will handle the record
    }

    return jsonResponse({
      checkoutUrl: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error('Community checkout error:', error);
    return serverErrorResponse(
      error instanceof Error ? error.message : 'Failed to create checkout session'
    );
  }
});
