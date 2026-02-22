// ============================================================================
// TBI CHECKOUT EDGE FUNCTION
// Creates TBI Bank installment applications
// ============================================================================
//
// Endpoints:
// POST /tbi-checkout
//   - Requires authentication
//   - Creates a TBI application for community or course purchase
//   - Returns redirect URL to TBI checkout
//
// Security:
// - EGN is hashed before storage (never stored in plain text)
// - All TBI API keys are server-side only
// - Creates pending membership/enrollment record
// ============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { getUserFromToken, createServiceClient } from '../_shared/supabase.ts';
import { jsonResponse, errorResponse, unauthorizedResponse, serverErrorResponse } from '../_shared/response.ts';
import {
  registerApplication,
  validateAmount,
  validateEGN,
  validateBulgarianPhone,
  hashEGN,
  generateOrderId,
  getTBIConfig,
  type TBICustomerData,
} from '../_shared/tbi.ts';

interface CheckoutRequest {
  productType: 'community' | 'course';
  productId: string;
  productName: string;
  amountCents: number;
  schemeId: number;
  customer: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    egn: string;
  };
  successUrl: string;
  cancelUrl: string;
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
    const body: CheckoutRequest = await req.json();
    const {
      productType,
      productId,
      productName,
      amountCents,
      schemeId,
      customer,
      successUrl,
      cancelUrl,
    } = body;

    // Validate required fields
    if (!productType || !productId || !productName || !amountCents || !schemeId) {
      return errorResponse('Missing required fields');
    }

    if (!customer || !customer.first_name || !customer.last_name || !customer.email || !customer.phone || !customer.egn) {
      return errorResponse('Missing customer information');
    }

    if (!successUrl || !cancelUrl) {
      return errorResponse('Missing redirect URLs');
    }

    // Validate amount
    const amountValidation = validateAmount(amountCents);
    if (!amountValidation.valid) {
      return errorResponse(amountValidation.error || 'Invalid amount');
    }

    // Validate EGN
    if (!validateEGN(customer.egn)) {
      return errorResponse('Invalid EGN format');
    }

    // Validate phone
    if (!validateBulgarianPhone(customer.phone)) {
      return errorResponse('Invalid phone number format');
    }

    // Initialize clients
    const supabase = createServiceClient();
    const config = getTBIConfig();

    // Get user's profile ID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('user_id', user.userId)
      .single();

    if (profileError || !profile) {
      return errorResponse('User profile not found');
    }

    const profileId = profile.id;

    // Get product details and creator info
    let product: { id: string; name: string; creator_id: string; price_cents: number } | null = null;
    let creatorId: string;

    if (productType === 'community') {
      const { data: community, error: communityError } = await supabase
        .from('communities')
        .select('id, name, creator_id, price_cents, tbi_enabled')
        .eq('id', productId)
        .single();

      if (communityError || !community) {
        return errorResponse('Community not found');
      }

      if (!community.tbi_enabled) {
        return errorResponse('TBI payments are not enabled for this community');
      }

      product = {
        id: community.id,
        name: community.name,
        creator_id: community.creator_id,
        price_cents: community.price_cents || 0,
      };
      creatorId = community.creator_id;
    } else {
      const { data: course, error: courseError } = await supabase
        .from('courses')
        .select('id, title, creator_id, price_cents')
        .eq('id', productId)
        .single();

      if (courseError || !course) {
        return errorResponse('Course not found');
      }

      product = {
        id: course.id,
        name: course.title,
        creator_id: course.creator_id,
        price_cents: course.price_cents || 0,
      };
      creatorId = course.creator_id;
    }

    // Verify amount matches product price (allow some flexibility for schemes)
    if (product.price_cents > 0 && Math.abs(amountCents - product.price_cents) > 100) {
      console.warn(`Amount mismatch: requested ${amountCents}, product price ${product.price_cents}`);
    }

    // Check for existing pending application — auto-cancel pending ones on retry
    const { data: existingApp } = await supabase
      .from('tbi_applications')
      .select('id, status, created_at')
      .eq('buyer_id', profileId)
      .eq(productType === 'community' ? 'community_id' : 'course_id', productId)
      .in('status', ['pending', 'processing', 'approved'])
      .single();

    if (existingApp) {
      if (existingApp.status === 'pending') {
        // Always cancel pending apps on retry (user is re-submitting)
        await supabase
          .from('tbi_applications')
          .update({ status: 'cancelled', tbi_status: 'Cancelled: user retried checkout' })
          .eq('id', existingApp.id);
        console.log(`Auto-cancelled pending TBI application ${existingApp.id}`);
      } else {
        // Only block for actively processing or approved applications
        return errorResponse(`You already have a ${existingApp.status} application for this ${productType}`);
      }
    }

    // Generate unique order ID
    const orderId = generateOrderId();

    // Hash EGN for storage (never store plain text)
    const egnHash = await hashEGN(customer.egn);

    // Build webhook/status URL
    const statusUrl = 'https://znqesarsluytxhuiwfkt.supabase.co/functions/v1/tbi-webhook';

    // Calculate expiry date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + config.applicationExpiryDays);

    // Create pending membership/enrollment first
    let membershipId: string | null = null;
    let enrollmentId: string | null = null;

    if (productType === 'community') {
      // Check for existing membership
      const { data: existingMembership } = await supabase
        .from('memberships')
        .select('id')
        .eq('community_id', productId)
        .eq('user_id', profileId)
        .single();

      if (existingMembership) {
        membershipId = existingMembership.id;
        // Update to pending
        await supabase
          .from('memberships')
          .update({ payment_status: 'pending' })
          .eq('id', membershipId);
      } else {
        // Create new pending membership
        const { data: newMembership, error: membershipError } = await supabase
          .from('memberships')
          .insert({
            community_id: productId,
            user_id: profileId,
            role: 'member',
            payment_status: 'pending',
          })
          .select('id')
          .single();

        if (membershipError) {
          console.error('Error creating membership:', membershipError);
          return errorResponse('Failed to create membership record');
        }
        membershipId = newMembership.id;
      }
    } else {
      // Check for existing enrollment
      const { data: existingEnrollment } = await supabase
        .from('enrollments')
        .select('id')
        .eq('course_id', productId)
        .eq('user_id', profileId)
        .single();

      if (existingEnrollment) {
        enrollmentId = existingEnrollment.id;
        // Update to pending
        await supabase
          .from('enrollments')
          .update({ status: 'pending' })
          .eq('id', enrollmentId);
      } else {
        // Create new pending enrollment
        const { data: newEnrollment, error: enrollmentError } = await supabase
          .from('enrollments')
          .insert({
            course_id: productId,
            user_id: profileId,
            status: 'pending',
            progress_percent: 0,
          })
          .select('id')
          .single();

        if (enrollmentError) {
          console.error('Error creating enrollment:', enrollmentError);
          return errorResponse('Failed to create enrollment record');
        }
        enrollmentId = newEnrollment.id;
      }
    }

    // Create TBI application record
    const { data: application, error: appError } = await supabase
      .from('tbi_applications')
      .insert({
        community_id: productType === 'community' ? productId : null,
        course_id: productType === 'course' ? productId : null,
        buyer_id: profileId,
        creator_id: creatorId,
        membership_id: membershipId,
        tbi_order_id: orderId,
        amount_cents: amountCents,
        currency: 'EUR',
        scheme_id: schemeId,
        status: 'pending',
        customer_email: customer.email,
        customer_phone: customer.phone,
        customer_first_name: customer.first_name,
        customer_last_name: customer.last_name,
        customer_egn: egnHash,
        status_url: statusUrl,
        expires_at: expiresAt.toISOString(),
      })
      .select('id')
      .single();

    if (appError || !application) {
      console.error('Error creating TBI application:', appError);
      return serverErrorResponse('Failed to create application record');
    }

    // Build TBI customer data
    const tbiCustomer: TBICustomerData = {
      first_name: customer.first_name,
      last_name: customer.last_name,
      email: customer.email,
      phone: customer.phone,
      egn: customer.egn,
    };

    // Call TBI API
    console.log('TBI checkout: calling registerApplication', {
      orderId, amountCents, schemeId, productName,
      successUrl, cancelUrl, statusUrl,
      customerEmail: tbiCustomer.email,
    });

    const tbiResponse = await registerApplication(
      orderId,
      amountCents,
      schemeId,
      tbiCustomer,
      productName,
      successUrl,
      cancelUrl,
      statusUrl
    );

    console.log('TBI RegisterApplication response:', JSON.stringify(tbiResponse));

    if (!tbiResponse.success || !tbiResponse.application_id) {
      // Update application status to failed
      const { error: updateErr } = await supabase
        .from('tbi_applications')
        .update({
          status: 'rejected',
          tbi_status: tbiResponse.error || 'TBI API error',
        })
        .eq('id', application.id);

      console.log('TBI app status update to rejected:', updateErr ? updateErr.message : 'ok');

      return errorResponse(tbiResponse.error || 'Failed to register with TBI Bank');
    }

    // Update application with TBI response
    const { error: updateError } = await supabase
      .from('tbi_applications')
      .update({
        tbi_application_id: tbiResponse.application_id,
        status_url: tbiResponse.redirect_url || statusUrl,
      })
      .eq('id', application.id);

    if (updateError) {
      console.error('Error updating application with TBI response:', updateError);
    }

    return jsonResponse({
      applicationId: application.id,
      redirectUrl: tbiResponse.redirect_url,
    });
  } catch (error) {
    console.error('TBI Checkout error:', error);
    return serverErrorResponse(
      error instanceof Error ? error.message : 'Failed to create checkout'
    );
  }
});
