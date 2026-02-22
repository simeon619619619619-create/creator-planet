// ============================================================================
// TBI BANK SERVICE
// Client-side service for TBI Bank Fusion Pay integration
// ============================================================================
//
// SECURITY NOTE:
// All TBI API operations are performed via Supabase Edge Functions
// to keep TBI_RESELLER_KEY and encryption keys server-side only.
// The client only handles:
// - Calling Edge Functions for backend operations
// - Database reads for application status
// - UI state management
//
// IMPORTANT: Always use profile.id (NOT user.id) for all database queries.
// Database FK columns reference profiles.id, not auth.users.id.
// ============================================================================

import { supabase } from '../../core/supabase/client';
import {
  TBI_CONFIG,
  TBIApplication,
  TBIApplicationStatus,
  TBICalculatorRequest,
  TBICalculatorResult,
  TBICheckoutRequest,
  TBICheckoutResult,
  TBIStatusResult,
  TBICustomerData,
  TBIError,
} from './tbiTypes';

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate that a profile ID is present and non-empty
 * IMPORTANT: Always pass profile.id from useAuth(), NOT user.id
 */
function validateProfileId(profileId: string | undefined | null, context: string): void {
  if (!profileId || typeof profileId !== 'string' || profileId.trim() === '') {
    throw new Error(
      `Invalid profile ID in ${context}. ` +
        'Ensure you are passing profile.id from useAuth(), not user.id.'
    );
  }
}

/**
 * Validate amount meets TBI requirements
 */
function validateAmount(amountCents: number): void {
  if (!amountCents || amountCents <= 0) {
    throw new TBIError('Invalid amount', 'INVALID_AMOUNT');
  }
  if (amountCents < TBI_CONFIG.minAmountCents) {
    throw new TBIError(
      `Minimum amount for installments is ${TBI_CONFIG.minAmountCents / 100} ${TBI_CONFIG.currency}`,
      'BELOW_MINIMUM',
      { minAmount: TBI_CONFIG.minAmountCents }
    );
  }
  if (amountCents > TBI_CONFIG.maxAmountCents) {
    throw new TBIError(
      `Maximum amount for installments is ${TBI_CONFIG.maxAmountCents / 100} ${TBI_CONFIG.currency}`,
      'ABOVE_MAXIMUM',
      { maxAmount: TBI_CONFIG.maxAmountCents }
    );
  }
}

/**
 * Validate customer data for TBI application
 */
function validateCustomerData(customer: TBICustomerData): void {
  const required: (keyof TBICustomerData)[] = ['first_name', 'last_name', 'email', 'phone', 'egn'];
  const missing = required.filter((field) => !customer[field]?.trim());
  
  if (missing.length > 0) {
    throw new TBIError(
      `Missing required customer fields: ${missing.join(', ')}`,
      'CUSTOMER_DATA_MISSING'
    );
  }

  // Validate EGN format (Bulgarian personal ID - 10 digits)
  const egnRegex = /^\d{10}$/;
  if (!egnRegex.test(customer.egn)) {
    throw new TBIError('Invalid EGN format. Must be 10 digits.', 'CUSTOMER_DATA_MISSING');
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(customer.email)) {
    throw new TBIError('Invalid email format.', 'CUSTOMER_DATA_MISSING');
  }

  // Validate phone (Bulgarian format, 10-11 digits)
  const phoneRegex = /^0[0-9]{8,10}$/;
  if (!phoneRegex.test(customer.phone.replace(/[\s\-\(\)\.]/g, ''))) {
    throw new TBIError('Invalid phone format. Use Bulgarian format: 08/09XXXXXXXX', 'CUSTOMER_DATA_MISSING');
  }
}

// ============================================================================
// CALCULATOR OPERATIONS
// ============================================================================

/**
 * Get available installment schemes for an amount
 * Cached in database for performance
 */
export async function getInstallmentSchemes(
  request: TBICalculatorRequest
): Promise<TBICalculatorResult> {
  try {
    validateAmount(request.amountCents);

    // Call Edge Function to get schemes
    const { data, error } = await supabase.functions.invoke('tbi-calculator', {
      body: {
        amountCents: request.amountCents,
      },
    });

    if (error) {
      throw new TBIError(error.message || 'Failed to get installment schemes', 'API_ERROR');
    }

    if (data?.error) {
      throw new TBIError(data.error, 'API_ERROR');
    }

    return {
      success: true,
      schemes: data.schemes,
    };
  } catch (error) {
    console.error('Error getting installment schemes:', error);
    return {
      success: false,
      error: error instanceof TBIError ? error.message : 'Failed to get installment options',
    };
  }
}

/**
 * Calculate monthly installment using TBI's installment_factor
 * Returns amount in cents
 */
export function calculateMonthlyInstallment(
  amountCents: number,
  installmentFactor: number
): number {
  const amountEur = amountCents / 100;
  return Math.round(amountEur * installmentFactor * 100);
}

// ============================================================================
// CHECKOUT OPERATIONS
// ============================================================================

/**
 * Create TBI application and get checkout URL
 * This initiates the installment loan application process
 */
export async function createTBICheckout(
  request: TBICheckoutRequest
): Promise<TBICheckoutResult> {
  try {
    // Validate inputs
    validateAmount(request.amountCents);
    validateCustomerData(request.customer);

    // Call Edge Function to create application
    const { data, error } = await supabase.functions.invoke('tbi-checkout', {
      body: {
        productType: request.productType,
        productId: request.productId,
        productName: request.productName,
        amountCents: request.amountCents,
        schemeId: request.schemeId,
        customer: request.customer,
        successUrl: request.successUrl,
        cancelUrl: request.cancelUrl,
      },
    });

    if (error) {
      throw new TBIError(error.message || 'Failed to create checkout', 'API_ERROR');
    }

    if (data?.error) {
      throw new TBIError(data.error, 'API_ERROR');
    }

    return {
      success: true,
      applicationId: data.applicationId,
      redirectUrl: data.redirectUrl,
      iframeUrl: data.iframeUrl,
    };
  } catch (error) {
    console.error('Error creating TBI checkout:', error);
    return {
      success: false,
      error: error instanceof TBIError ? error.message : 'Failed to create checkout',
    };
  }
}

// ============================================================================
// APPLICATION STATUS OPERATIONS
// ============================================================================

/**
 * Get TBI application by ID
 */
export async function getTBIApplication(applicationId: string): Promise<TBIApplication | null> {
  try {
    const { data, error } = await supabase
      .from('tbi_applications')
      .select(`
        *,
        community:communities(id, name),
        course:courses(id, title)
      `)
      .eq('id', applicationId)
      .single();

    if (error) {
      console.error('Error fetching TBI application:', error);
      return null;
    }

    return data as TBIApplication;
  } catch (error) {
    console.error('Error in getTBIApplication:', error);
    return null;
  }
}

/**
 * Get user's TBI applications
 */
export async function getUserTBIApplications(
  buyerId: string,
  options?: { limit?: number; status?: TBIApplicationStatus }
): Promise<TBIApplication[]> {
  try {
    validateProfileId(buyerId, 'getUserTBIApplications');

    let query = supabase
      .from('tbi_applications')
      .select(`
        *,
        community:communities(id, name),
        course:courses(id, title)
      `)
      .eq('buyer_id', buyerId)
      .order('created_at', { ascending: false });

    if (options?.status) {
      query = query.eq('status', options.status);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching user TBI applications:', error);
      return [];
    }

    return (data || []) as TBIApplication[];
  } catch (error) {
    console.error('Error in getUserTBIApplications:', error);
    return [];
  }
}

/**
 * Poll TBI application status
 * Returns current status from database (updated by webhook)
 */
export async function pollApplicationStatus(applicationId: string): Promise<TBIStatusResult> {
  try {
    const application = await getTBIApplication(applicationId);
    
    if (!application) {
      throw new TBIError('Application not found', 'APPLICATION_NOT_FOUND');
    }

    // If still pending, trigger a status refresh via Edge Function
    if (application.status === 'pending' || application.status === 'processing') {
      const { data, error } = await supabase.functions.invoke('tbi-status-check', {
        body: { applicationId },
      });

      if (error) {
        console.warn('Failed to refresh status:', error);
        // Return cached status rather than failing
      } else if (data?.application) {
        return {
          success: true,
          application: data.application,
        };
      }
    }

    return {
      success: true,
      application,
    };
  } catch (error) {
    console.error('Error polling application status:', error);
    return {
      success: false,
      error: error instanceof TBIError ? error.message : 'Failed to check status',
    };
  }
}

// ============================================================================
// ACCESS CONTROL OPERATIONS
// ============================================================================

/**
 * Check if user has access via TBI application
 * Used alongside regular membership checks
 */
export async function hasTBIAccess(
  productType: 'community' | 'course',
  productId: string,
  buyerId: string
): Promise<boolean> {
  try {
    validateProfileId(buyerId, 'hasTBIAccess');

    const column = productType === 'community' ? 'community_id' : 'course_id';
    
    const { data, error } = await supabase
      .from('tbi_applications')
      .select('id, status, access_granted, expires_at')
      .eq(column, productId)
      .eq('buyer_id', buyerId)
      .eq('access_granted', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return false;
    }

    // Check if access has expired
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error checking TBI access:', error);
    return false;
  }
}

/**
 * Get active TBI access for a product
 */
export async function getActiveTBIAccess(
  productType: 'community' | 'course',
  productId: string,
  buyerId: string
): Promise<TBIApplication | null> {
  try {
    validateProfileId(buyerId, 'getActiveTBIAccess');

    const column = productType === 'community' ? 'community_id' : 'course_id';
    
    const { data, error } = await supabase
      .from('tbi_applications')
      .select('*')
      .eq(column, productId)
      .eq('buyer_id', buyerId)
      .eq('access_granted', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    // Check expiration
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return null;
    }

    return data as TBIApplication;
  } catch (error) {
    console.error('Error getting active TBI access:', error);
    return null;
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format installment display
 * e.g., "6 вноски по 85.50 EUR/мес."
 */
export function formatInstallmentDisplay(
  installmentCount: number,
  monthlyAmountCents: number,
  currency: string = 'EUR'
): string {
  const amount = (monthlyAmountCents / 100).toFixed(2);
  return `${installmentCount} вноски по ${amount} ${currency}/мес.`;
}

/**
 * Format short installment display for buttons
 * e.g., "6 x 85.50 EUR"
 */
export function formatShortInstallment(
  installmentCount: number,
  monthlyAmountCents: number,
  currency: string = 'EUR'
): string {
  const amount = (monthlyAmountCents / 100).toFixed(2);
  return `${installmentCount} x ${amount} ${currency}`;
}

/**
 * Check if amount qualifies for TBI financing
 */
export function qualifiesForTBI(amountCents: number): boolean {
  return amountCents >= TBI_CONFIG.minAmountCents && amountCents <= TBI_CONFIG.maxAmountCents;
}

/**
 * Get TBI status label
 */
export function getTBIStatusLabel(status: TBIApplicationStatus): string {
  const labels: Record<TBIApplicationStatus, string> = {
    pending: 'В очакване',
    processing: 'В обработка',
    approved: 'Одобрена',
    rejected: 'Отказана',
    cancelled: 'Отказана',
    completed: 'Завършена',
    expired: 'Изтекла',
  };
  return labels[status] || status;
}

/**
 * Cancel a pending TBI application
 */
export async function cancelTBIApplication(
  applicationId: string,
  buyerId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    validateProfileId(buyerId, 'cancelTBIApplication');

    // First verify ownership
    const { data: app } = await supabase
      .from('tbi_applications')
      .select('id, status, buyer_id')
      .eq('id', applicationId)
      .single();

    if (!app || app.buyer_id !== buyerId) {
      return { success: false, error: 'Application not found' };
    }

    if (app.status !== 'pending' && app.status !== 'processing') {
      return { success: false, error: 'Can only cancel pending applications' };
    }

    // Call Edge Function to cancel
    const { data, error } = await supabase.functions.invoke('tbi-cancel', {
      body: { applicationId },
    });

    if (error || data?.error) {
      throw new Error(error?.message || data?.error || 'Failed to cancel');
    }

    return { success: true };
  } catch (error) {
    console.error('Error cancelling TBI application:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel application',
    };
  }
}
