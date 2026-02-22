// ============================================================================
// DISCOUNT VALIDATE EDGE FUNCTION
// Validates discount codes and returns discount details
// ============================================================================
//
// Endpoints:
// POST /discount-validate
//   - Validates a discount code for a specific product
//   - Returns discount percentage, duration, and calculated prices
//   - Requires valid JWT authentication
//
// Security:
// - Requires authentication to prevent code enumeration
// - Validates targeting restrictions
// - Checks usage limits and expiry
// ============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { getUserFromToken, createServiceClient } from '../_shared/supabase.ts';
import { jsonResponse, errorResponse, unauthorizedResponse, serverErrorResponse } from '../_shared/response.ts';

interface DiscountValidateRequest {
  code: string;
  communityId?: string;
  courseId?: string;
}

interface DiscountValidateResponse {
  valid: boolean;
  discountPercent?: number;
  durationMonths?: number | null;
  durationLabel?: string;
  originalPriceCents?: number;
  discountAmountCents?: number;
  finalPriceCents?: number;
  codeId?: string;
  error?: string;
}

type ValidationErrorCode =
  | 'CODE_NOT_FOUND'
  | 'CODE_INACTIVE'
  | 'CODE_EXPIRED'
  | 'CODE_NOT_YET_VALID'
  | 'CODE_MAX_USES_REACHED'
  | 'CODE_NOT_FOR_YOU'
  | 'CODE_WRONG_PRODUCT'
  | 'CODE_ALREADY_USED'
  | 'PRODUCT_NOT_FOUND'
  | 'VALIDATION_ERROR';

const ERROR_MESSAGES: Record<ValidationErrorCode, string> = {
  CODE_NOT_FOUND: "This discount code doesn't exist",
  CODE_INACTIVE: 'This discount code is no longer active',
  CODE_EXPIRED: 'This discount code has expired',
  CODE_NOT_YET_VALID: 'This discount code is not yet valid',
  CODE_MAX_USES_REACHED: 'This discount code has reached its usage limit',
  CODE_NOT_FOR_YOU: 'This discount code is not valid for your account',
  CODE_WRONG_PRODUCT: "This discount code isn't valid for this product",
  CODE_ALREADY_USED: "You've already used this discount code",
  PRODUCT_NOT_FOUND: 'Product not found',
  VALIDATION_ERROR: 'Unable to validate discount code',
};

function getDurationLabel(durationMonths: number | null): string {
  if (durationMonths === null) return 'Forever';
  if (durationMonths === 1) return 'First month only';
  return `${durationMonths} months`;
}

function validationError(code: ValidationErrorCode): DiscountValidateResponse {
  return {
    valid: false,
    error: ERROR_MESSAGES[code],
  };
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
    const body: DiscountValidateRequest = await req.json();
    const { code, communityId, courseId } = body;

    if (!code) {
      return errorResponse('Missing required field: code');
    }

    if (!communityId && !courseId) {
      return errorResponse('Must provide either communityId or courseId');
    }

    // Initialize Supabase client
    const supabase = createServiceClient();

    // Get user's profile ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.userId)
      .single();

    if (!profile) {
      return errorResponse('User profile not found');
    }

    const profileId = profile.id;

    // Lookup discount code (case-insensitive)
    const { data: discountCode, error: codeError } = await supabase
      .from('discount_codes')
      .select(`
        id,
        creator_id,
        code,
        discount_percent,
        duration_months,
        target_student_id,
        target_community_id,
        target_course_id,
        max_uses,
        current_uses,
        valid_from,
        valid_until,
        is_active,
        stripe_coupon_id
      `)
      .ilike('code', code)
      .single();

    if (codeError || !discountCode) {
      return jsonResponse(validationError('CODE_NOT_FOUND'));
    }

    // ========================================================================
    // VALIDATION CHECKS (in order)
    // ========================================================================

    // 1. Check if code is active
    if (!discountCode.is_active) {
      return jsonResponse(validationError('CODE_INACTIVE'));
    }

    // 2. Check expiry (valid_until)
    if (discountCode.valid_until) {
      const expiryDate = new Date(discountCode.valid_until);
      if (expiryDate < new Date()) {
        return jsonResponse(validationError('CODE_EXPIRED'));
      }
    }

    // 3. Check if code is within valid period (valid_from)
    if (discountCode.valid_from) {
      const startDate = new Date(discountCode.valid_from);
      if (startDate > new Date()) {
        return jsonResponse(validationError('CODE_NOT_YET_VALID'));
      }
    }

    // 4. Check max uses
    if (discountCode.max_uses !== null && discountCode.current_uses >= discountCode.max_uses) {
      return jsonResponse(validationError('CODE_MAX_USES_REACHED'));
    }

    // 5. Check if targeted to specific student
    if (discountCode.target_student_id && discountCode.target_student_id !== profileId) {
      return jsonResponse(validationError('CODE_NOT_FOR_YOU'));
    }

    // 6. Get product info and validate targeting
    let productPriceCents = 0;
    let productCreatorId: string | null = null;

    if (communityId) {
      // Check if code is targeted to a different community
      if (discountCode.target_community_id && discountCode.target_community_id !== communityId) {
        return jsonResponse(validationError('CODE_WRONG_PRODUCT'));
      }

      // Get community details
      const { data: community, error: communityError } = await supabase
        .from('communities')
        .select('id, creator_id, price_cents, pricing_type')
        .eq('id', communityId)
        .single();

      if (communityError || !community) {
        return jsonResponse(validationError('PRODUCT_NOT_FOUND'));
      }

      // Verify the discount code belongs to this community's creator
      if (discountCode.creator_id !== community.creator_id) {
        return jsonResponse(validationError('CODE_WRONG_PRODUCT'));
      }

      productPriceCents = community.price_cents || 0;
      productCreatorId = community.creator_id;
    } else if (courseId) {
      // Check if code is targeted to a different course
      if (discountCode.target_course_id && discountCode.target_course_id !== courseId) {
        return jsonResponse(validationError('CODE_WRONG_PRODUCT'));
      }

      // Get course details
      const { data: course, error: courseError } = await supabase
        .from('courses')
        .select('id, creator_id, price_cents')
        .eq('id', courseId)
        .single();

      if (courseError || !course) {
        return jsonResponse(validationError('PRODUCT_NOT_FOUND'));
      }

      // Verify the discount code belongs to this course's creator
      if (discountCode.creator_id !== course.creator_id) {
        return jsonResponse(validationError('CODE_WRONG_PRODUCT'));
      }

      productPriceCents = course.price_cents || 0;
      productCreatorId = course.creator_id;
    }

    // 7. Check if user has already redeemed this specific code
    const { data: existingRedemption } = await supabase
      .from('discount_redemptions')
      .select('id')
      .eq('discount_code_id', discountCode.id)
      .eq('student_id', profileId)
      .limit(1)
      .maybeSingle();

    if (existingRedemption) {
      return jsonResponse(validationError('CODE_ALREADY_USED'));
    }

    // ========================================================================
    // VALIDATION PASSED - Calculate discount
    // ========================================================================

    const discountAmountCents = Math.round(productPriceCents * (discountCode.discount_percent / 100));
    const finalPriceCents = productPriceCents - discountAmountCents;

    const response: DiscountValidateResponse = {
      valid: true,
      discountPercent: discountCode.discount_percent,
      durationMonths: discountCode.duration_months,
      durationLabel: getDurationLabel(discountCode.duration_months),
      originalPriceCents: productPriceCents,
      discountAmountCents: discountAmountCents,
      finalPriceCents: Math.max(0, finalPriceCents), // Ensure non-negative
      codeId: discountCode.id,
    };

    return jsonResponse(response);
  } catch (error) {
    console.error('Discount validation error:', error);
    return serverErrorResponse(
      error instanceof Error ? error.message : 'Failed to validate discount code'
    );
  }
});
