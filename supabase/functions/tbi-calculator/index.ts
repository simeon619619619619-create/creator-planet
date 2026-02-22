// ============================================================================
// TBI CALCULATOR EDGE FUNCTION
// Fetches and caches installment schemes from TBI Bank API
// ============================================================================
//
// Endpoints:
// POST /tbi-calculator
//   - Body: { amountCents: number }
//   - Returns: { success: boolean, schemes: TBICalculationScheme[] }
//
// Caching Strategy:
// - Schemes are cached in tbi_installment_schemes table
// - Cache expires after 24 hours
// - Returns cached schemes if available and not expired
// ============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { jsonResponse, errorResponse, serverErrorResponse } from '../_shared/response.ts';
import { getCalculations, validateAmount, getTBIConfig, TBICalculationScheme } from '../_shared/tbi.ts';

interface CalculatorRequest {
  amountCents: number;
}

const CACHE_DURATION_HOURS = 24;

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Only accept POST
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    // Parse request body
    const body: CalculatorRequest = await req.json();
    const { amountCents } = body;

    if (!amountCents) {
      return errorResponse('amountCents is required');
    }

    // Validate amount
    const amountValidation = validateAmount(amountCents);
    if (!amountValidation.valid) {
      return errorResponse(amountValidation.error || 'Invalid amount');
    }

    const config = getTBIConfig();

    // Initialize Supabase client
    const supabase = createServiceClient();

    // Check cache first
    const cachedSchemes = await getCachedSchemes(supabase, amountCents);
    if (cachedSchemes && cachedSchemes.length > 0) {
      return jsonResponse({
        success: true,
        schemes: cachedSchemes,
        cached: true,
      });
    }

    // Fetch from TBI API
    const response = await getCalculations(amountCents);

    if (!response.success || !response.schemes) {
      return errorResponse(response.error || 'Failed to get installment schemes');
    }

    // Cache schemes
    await cacheSchemes(supabase, response.schemes, config.resellerCode);

    return jsonResponse({
      success: true,
      schemes: response.schemes,
      cached: false,
    });
  } catch (error) {
    console.error('TBI Calculator error:', error);
    return serverErrorResponse(
      error instanceof Error ? error.message : 'Failed to calculate installments'
    );
  }
});

/**
 * Get cached schemes that are valid for the given amount
 */
async function getCachedSchemes(
  supabase: ReturnType<typeof createServiceClient>,
  amountCents: number
): Promise<TBICalculationScheme[] | null> {
  try {
    const amountEur = amountCents / 100;

    const { data, error } = await supabase
      .from('tbi_installment_schemes')
      .select('*')
      .lte('min_amount_cents', amountCents)
      .gte('max_amount_cents', amountCents)
      .gt('expires_at', new Date().toISOString())
      .order('installment_count', { ascending: true });

    if (error || !data || data.length === 0) {
      return null;
    }

    // Transform cached data to match expected response format
    // Recalculate monthly/total based on the actual amount and stored factors
    return data.map((scheme) => ({
      scheme_id: scheme.scheme_id,
      name: scheme.name || `${scheme.installment_count} вноски`,
      period: scheme.installment_count,
      installment_factor: scheme.installment_factor || 0,
      total_due_factor: scheme.total_due_factor || 0,
      monthly_amount_cents: Math.round(amountEur * (scheme.installment_factor || 0) * 100),
      total_amount_cents: Math.round(amountEur * (scheme.total_due_factor || 0) * 100),
      nir: scheme.interest_rate || 0,
      apr: scheme.apr || 0,
      amount_min: scheme.min_amount_cents ? scheme.min_amount_cents / 100 : 0,
      amount_max: scheme.max_amount_cents ? scheme.max_amount_cents / 100 : 0,
      currency: 'EUR',
    }));
  } catch (error) {
    console.error('Error fetching cached schemes:', error);
    return null;
  }
}

/**
 * Cache schemes to database
 */
async function cacheSchemes(
  supabase: ReturnType<typeof createServiceClient>,
  schemes: TBICalculationScheme[],
  resellerCode: string
): Promise<void> {
  try {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + CACHE_DURATION_HOURS);

    for (const scheme of schemes) {
      const { error } = await supabase
        .from('tbi_installment_schemes')
        .upsert(
          {
            scheme_id: scheme.scheme_id,
            name: scheme.name,
            installment_count: scheme.period,
            installment_factor: scheme.installment_factor,
            total_due_factor: scheme.total_due_factor,
            interest_rate: scheme.nir,
            apr: scheme.apr,
            min_amount_cents: Math.round(scheme.amount_min * 100),
            max_amount_cents: Math.round(scheme.amount_max * 100),
            is_promo: scheme.nir === 0,
            reseller_code: resellerCode,
            cached_at: new Date().toISOString(),
            expires_at: expiresAt.toISOString(),
          },
          {
            onConflict: 'scheme_id',
          }
        );

      if (error) {
        console.error('Error caching scheme:', error);
      }
    }
  } catch (error) {
    console.error('Error caching schemes:', error);
    // Don't throw - caching failure shouldn't fail the request
  }
}
