/**
 * Discount Service
 *
 * Client-side service for managing discount codes.
 * Handles CRUD operations and discount validation.
 */

import { supabase } from '../../core/supabase/client';
import type {
  DiscountCode,
  DiscountCodeWithDetails,
  DiscountRedemption,
  CreateDiscountCodeInput,
  UpdateDiscountCodeInput,
  DiscountValidationResponse,
} from './discountTypes';

// ============================================================================
// DISCOUNT CODE CRUD
// ============================================================================

/**
 * Get all discount codes for a creator
 */
export async function getDiscountCodes(creatorId: string): Promise<DiscountCodeWithDetails[]> {
  const { data, error } = await supabase
    .from('discount_codes')
    .select(`
      *,
      target_student:profiles!discount_codes_target_student_id_fkey(id, full_name, email),
      target_community:communities!discount_codes_target_community_id_fkey(id, name),
      target_course:courses!discount_codes_target_course_id_fkey(id, title)
    `)
    .eq('creator_id', creatorId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching discount codes:', error);
    throw error;
  }

  return (data || []) as DiscountCodeWithDetails[];
}

/**
 * Get a single discount code by ID
 */
export async function getDiscountCode(codeId: string): Promise<DiscountCodeWithDetails | null> {
  const { data, error } = await supabase
    .from('discount_codes')
    .select(`
      *,
      target_student:profiles!discount_codes_target_student_id_fkey(id, full_name, email),
      target_community:communities!discount_codes_target_community_id_fkey(id, name),
      target_course:courses!discount_codes_target_course_id_fkey(id, title)
    `)
    .eq('id', codeId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    console.error('Error fetching discount code:', error);
    throw error;
  }

  return data as DiscountCodeWithDetails;
}

/**
 * Create a new discount code
 */
export async function createDiscountCode(
  creatorId: string,
  input: CreateDiscountCodeInput
): Promise<DiscountCode> {
  // If targeting a student by email, look up their profile ID
  let targetStudentId: string | null = null;

  if (input.target_student_email) {
    const { data: studentProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', input.target_student_email)
      .single();

    if (!studentProfile) {
      throw new Error(`No user found with email: ${input.target_student_email}`);
    }

    targetStudentId = studentProfile.id;
  }

  const { data, error } = await supabase
    .from('discount_codes')
    .insert({
      creator_id: creatorId,
      code: input.code.toUpperCase(), // Normalize to uppercase
      discount_percent: input.discount_percent,
      duration_months: input.duration_months,
      target_student_id: targetStudentId,
      target_community_id: input.target_community_id || null,
      target_course_id: input.target_course_id || null,
      max_uses: input.max_uses || null,
      valid_until: input.valid_until || null,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('A discount code with this name already exists');
    }
    console.error('Error creating discount code:', error);
    throw error;
  }

  return data as DiscountCode;
}

/**
 * Update an existing discount code
 */
export async function updateDiscountCode(
  codeId: string,
  input: UpdateDiscountCodeInput
): Promise<DiscountCode> {
  const updateData: Record<string, unknown> = {};

  if (input.code !== undefined) updateData.code = input.code.toUpperCase();
  if (input.discount_percent !== undefined) updateData.discount_percent = input.discount_percent;
  if (input.duration_months !== undefined) updateData.duration_months = input.duration_months;
  if (input.target_student_id !== undefined) updateData.target_student_id = input.target_student_id;
  if (input.target_community_id !== undefined) updateData.target_community_id = input.target_community_id;
  if (input.target_course_id !== undefined) updateData.target_course_id = input.target_course_id;
  if (input.max_uses !== undefined) updateData.max_uses = input.max_uses;
  if (input.valid_until !== undefined) updateData.valid_until = input.valid_until;
  if (input.is_active !== undefined) updateData.is_active = input.is_active;

  const { data, error } = await supabase
    .from('discount_codes')
    .update(updateData)
    .eq('id', codeId)
    .select()
    .single();

  if (error) {
    console.error('Error updating discount code:', error);
    throw error;
  }

  return data as DiscountCode;
}

/**
 * Deactivate a discount code (soft delete)
 */
export async function deactivateDiscountCode(codeId: string): Promise<void> {
  const { error } = await supabase
    .from('discount_codes')
    .update({ is_active: false })
    .eq('id', codeId);

  if (error) {
    console.error('Error deactivating discount code:', error);
    throw error;
  }
}

/**
 * Reactivate a discount code
 */
export async function reactivateDiscountCode(codeId: string): Promise<void> {
  const { error } = await supabase
    .from('discount_codes')
    .update({ is_active: true })
    .eq('id', codeId);

  if (error) {
    console.error('Error reactivating discount code:', error);
    throw error;
  }
}

/**
 * Delete a discount code permanently
 */
export async function deleteDiscountCode(codeId: string): Promise<void> {
  const { error } = await supabase
    .from('discount_codes')
    .delete()
    .eq('id', codeId);

  if (error) {
    console.error('Error deleting discount code:', error);
    throw error;
  }
}

// ============================================================================
// DISCOUNT REDEMPTIONS
// ============================================================================

/**
 * Get redemptions for a specific discount code
 */
export async function getDiscountRedemptions(codeId: string): Promise<DiscountRedemption[]> {
  const { data, error } = await supabase
    .from('discount_redemptions')
    .select(`
      *,
      student:profiles!discount_redemptions_student_id_fkey(id, full_name, email),
      community:communities!discount_redemptions_community_id_fkey(id, name),
      course:courses!discount_redemptions_course_id_fkey(id, title)
    `)
    .eq('discount_code_id', codeId)
    .order('redeemed_at', { ascending: false });

  if (error) {
    console.error('Error fetching redemptions:', error);
    throw error;
  }

  return (data || []) as DiscountRedemption[];
}

/**
 * Get all redemptions for a creator's discount codes
 */
export async function getCreatorRedemptions(creatorId: string): Promise<DiscountRedemption[]> {
  const { data, error } = await supabase
    .from('discount_redemptions')
    .select(`
      *,
      discount_code:discount_codes!inner(id, code, creator_id),
      student:profiles!discount_redemptions_student_id_fkey(id, full_name, email),
      community:communities!discount_redemptions_community_id_fkey(id, name)
    `)
    .eq('discount_code.creator_id', creatorId)
    .order('redeemed_at', { ascending: false });

  if (error) {
    console.error('Error fetching creator redemptions:', error);
    throw error;
  }

  return (data || []) as DiscountRedemption[];
}

// ============================================================================
// DISCOUNT VALIDATION (Client-side preview)
// ============================================================================

/**
 * Validate a discount code via edge function
 * Used to show preview before checkout
 */
export async function validateDiscountCode(
  code: string,
  communityId?: string,
  courseId?: string
): Promise<DiscountValidationResponse> {
  const { data: session } = await supabase.auth.getSession();

  if (!session?.session?.access_token) {
    return {
      valid: false,
      error: 'You must be logged in to use discount codes',
    };
  }

  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/discount-validate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.session.access_token}`,
        },
        body: JSON.stringify({
          code,
          communityId,
          courseId,
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      return {
        valid: false,
        error: result.error || 'Failed to validate discount code',
      };
    }

    return result as DiscountValidationResponse;
  } catch (error) {
    console.error('Error validating discount code:', error);
    return {
      valid: false,
      error: 'Unable to validate discount code. Please try again.',
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get creator's communities for targeting dropdown
 */
export async function getCreatorCommunities(
  creatorId: string
): Promise<Array<{ id: string; name: string }>> {
  const { data, error } = await supabase
    .from('communities')
    .select('id, name')
    .eq('creator_id', creatorId)
    .order('name');

  if (error) {
    console.error('Error fetching communities:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get creator's courses for targeting dropdown
 */
export async function getCreatorCourses(
  creatorId: string
): Promise<Array<{ id: string; title: string }>> {
  const { data, error } = await supabase
    .from('courses')
    .select('id, title')
    .eq('creator_id', creatorId)
    .order('title');

  if (error) {
    console.error('Error fetching courses:', error);
    throw error;
  }

  return data || [];
}

/**
 * Check if a code is available (not already used by this creator)
 */
export async function isCodeAvailable(
  creatorId: string,
  code: string,
  excludeCodeId?: string
): Promise<boolean> {
  let query = supabase
    .from('discount_codes')
    .select('id')
    .eq('creator_id', creatorId)
    .ilike('code', code);

  if (excludeCodeId) {
    query = query.neq('id', excludeCodeId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error('Error checking code availability:', error);
    throw error;
  }

  return data === null;
}
