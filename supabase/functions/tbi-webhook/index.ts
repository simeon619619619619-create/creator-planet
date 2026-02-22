// ============================================================================
// TBI WEBHOOK EDGE FUNCTION
// Handles TBI Bank status callbacks and grants access on approval
// ============================================================================
//
// Endpoints:
// POST /tbi-webhook
//   - Receives status updates from TBI Bank
//   - Updates application status
//   - Grants access on completion
//
// Security:
// - Verifies ResellerCode matches our config to prevent spoofed webhooks
// - Idempotent processing via tbi_webhook_events table
// - Service role access only (no JWT auth - TBI calls this externally)
// ============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { jsonResponse, errorResponse, serverErrorResponse } from '../_shared/response.ts';
import {
  parseWebhookPayload,
  mapTBIStatus,
  getTBIConfig,
  type TBIWebhookPayload,
} from '../_shared/tbi.ts';

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Only accept POST
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const config = getTBIConfig();
    const rawBody = await req.text();

    // Parse payload
    let rawPayload: TBIWebhookPayload;
    try {
      rawPayload = JSON.parse(rawBody);
    } catch {
      console.error('Invalid JSON payload');
      return errorResponse('Invalid JSON payload');
    }

    // Verify ResellerCode matches our config to prevent spoofed webhooks
    if (rawPayload.ResellerCode !== config.resellerCode) {
      console.error(`ResellerCode mismatch: received "${rawPayload.ResellerCode}", expected "${config.resellerCode}"`);
      return errorResponse('Invalid ResellerCode', 401);
    }

    // Normalize TBI's CamelCase payload to our snake_case format
    const normalized = parseWebhookPayload(rawPayload);

    // Validate required fields
    if (!normalized.order_id) {
      return errorResponse('Missing OrderId in webhook payload');
    }

    if (!normalized.status) {
      return errorResponse('Missing status (Message) in webhook payload');
    }

    // Initialize Supabase client
    const supabase = createServiceClient();

    // Generate event ID for idempotency
    const eventId = `${normalized.application_id || normalized.order_id}-${normalized.status}-${Date.now()}`;

    // Check if already processed (idempotency)
    const { data: existingEvent } = await supabase
      .from('tbi_webhook_events')
      .select('id, processing_result')
      .eq('tbi_event_id', eventId)
      .single();

    if (existingEvent) {
      console.log('Webhook event already processed:', eventId);
      return jsonResponse({
        success: true,
        message: 'Event already processed',
        result: existingEvent.processing_result,
      });
    }

    // Find the application by tbi_order_id
    const { data: application, error: appError } = await supabase
      .from('tbi_applications')
      .select('*')
      .eq('tbi_order_id', normalized.order_id)
      .single();

    if (appError || !application) {
      console.error('Application not found for order_id:', normalized.order_id);

      // Record event anyway for debugging
      await recordWebhookEvent(supabase, eventId, null, 'status_update', rawPayload, 'error', 'Application not found');

      return errorResponse('Application not found', 404);
    }

    // Map TBI status string to our status enum
    const newStatus = mapTBIStatus(normalized.status);
    const previousStatus = application.status;

    console.log(`Status update for ${application.id}: ${previousStatus} -> ${newStatus} (TBI: ${normalized.status})`);

    // Update application
    const updateData: Record<string, unknown> = {
      status: newStatus,
      tbi_status: normalized.status, // Store raw TBI status text
      callback_received_at: new Date().toISOString(),
      callback_payload: rawPayload,
    };

    if (normalized.contract_number) {
      updateData.contract_number = normalized.contract_number;
    }

    // Grant access if status maps to 'completed'
    // This covers: "approved & signed", "ContractSigned", "Paid"
    if (newStatus === 'completed') {
      updateData.access_granted = true;
      updateData.access_granted_at = new Date().toISOString();

      // Grant actual access (membership or enrollment)
      await grantAccess(supabase, application);
    }

    // Handle rejection/cancellation
    if (newStatus === 'rejected' || newStatus === 'cancelled') {
      updateData.rejection_reason = normalized.status;
      // Revert pending membership/enrollment
      await revertAccess(supabase, application);
    }

    // Update application
    const { error: updateError } = await supabase
      .from('tbi_applications')
      .update(updateData)
      .eq('id', application.id);

    if (updateError) {
      console.error('Error updating application:', updateError);
      await recordWebhookEvent(supabase, eventId, application.id, 'status_update', rawPayload, 'error', updateError.message);
      return serverErrorResponse('Failed to update application');
    }

    // Record webhook event
    await recordWebhookEvent(supabase, eventId, application.id, 'status_update', rawPayload, 'success', null);

    // Record creator sale if completed
    if (newStatus === 'completed') {
      await recordCreatorSale(supabase, application);
    }

    return jsonResponse({
      success: true,
      applicationId: application.id,
      previousStatus,
      newStatus,
    });
  } catch (error) {
    console.error('TBI Webhook error:', error);
    return serverErrorResponse(
      error instanceof Error ? error.message : 'Webhook processing failed'
    );
  }
});

/**
 * Record webhook event for idempotency
 */
async function recordWebhookEvent(
  supabase: ReturnType<typeof createServiceClient>,
  eventId: string,
  applicationId: string | null,
  eventType: string,
  payload: TBIWebhookPayload,
  result: string,
  errorMessage: string | null
): Promise<void> {
  try {
    await supabase
      .from('tbi_webhook_events')
      .insert({
        tbi_event_id: eventId,
        application_id: applicationId,
        event_type: eventType,
        payload,
        processing_result: result,
        error_message: errorMessage,
      });
  } catch (error) {
    console.error('Error recording webhook event:', error);
  }
}

/**
 * Grant access to community or course
 */
async function grantAccess(
  supabase: ReturnType<typeof createServiceClient>,
  application: Record<string, unknown>
): Promise<void> {
  try {
    if (application.community_id) {
      if (application.membership_id) {
        // Update existing pending membership to paid
        await supabase
          .from('memberships')
          .update({
            payment_status: 'paid',
            paid_at: new Date().toISOString(),
          })
          .eq('id', application.membership_id);
      } else {
        // Create membership if one wasn't created at checkout time
        await supabase
          .from('memberships')
          .insert({
            community_id: application.community_id,
            user_id: application.buyer_id,
            role: 'member',
            payment_status: 'paid',
            paid_at: new Date().toISOString(),
          });
      }

      console.log(`Granted community access for buyer ${application.buyer_id} to community ${application.community_id}`);
    }

    if (application.course_id) {
      if (application.enrollment_id) {
        // Update existing pending enrollment to active
        await supabase
          .from('enrollments')
          .update({
            status: 'active',
            enrolled_at: new Date().toISOString(),
          })
          .eq('id', application.enrollment_id);
      } else {
        // Create enrollment if one wasn't created at checkout time
        await supabase
          .from('enrollments')
          .insert({
            course_id: application.course_id,
            user_id: application.buyer_id,
            status: 'active',
            enrolled_at: new Date().toISOString(),
            progress_percent: 0,
          });
      }

      console.log(`Granted course access for buyer ${application.buyer_id} to course ${application.course_id}`);
    }
  } catch (error) {
    console.error('Error granting access:', error);
    throw error;
  }
}

/**
 * Revert pending membership/enrollment on rejection
 */
async function revertAccess(
  supabase: ReturnType<typeof createServiceClient>,
  application: Record<string, unknown>
): Promise<void> {
  try {
    if (application.membership_id) {
      // Delete pending membership (not yet paid)
      await supabase
        .from('memberships')
        .delete()
        .eq('id', application.membership_id)
        .eq('payment_status', 'pending');

      console.log(`Reverted pending membership ${application.membership_id}`);
    }

    if (application.enrollment_id) {
      // Delete pending enrollment
      await supabase
        .from('enrollments')
        .delete()
        .eq('id', application.enrollment_id)
        .eq('status', 'pending');

      console.log(`Reverted pending enrollment ${application.enrollment_id}`);
    }
  } catch (error) {
    console.error('Error reverting access:', error);
    // Don't throw - this is cleanup
  }
}

/**
 * Record sale in creator_sales table for balance tracking
 */
async function recordCreatorSale(
  supabase: ReturnType<typeof createServiceClient>,
  application: Record<string, unknown>
): Promise<void> {
  try {
    // Get creator billing info for platform fee
    const { data: creatorBilling } = await supabase
      .from('creator_billing')
      .select('plan:billing_plans(platform_fee_percent)')
      .eq('creator_id', application.creator_id)
      .single();

    const feePercent = creatorBilling?.plan?.platform_fee_percent || 6.9;
    const amountCents = application.amount_cents as number;
    const platformFeeCents = Math.round(amountCents * (feePercent / 100));
    const creatorAmountCents = amountCents - platformFeeCents;

    // Record the sale
    await supabase.from('creator_sales').insert({
      creator_id: application.creator_id,
      buyer_id: application.buyer_id,
      community_id: application.community_id || null,
      course_id: application.course_id || null,
      sale_type: 'tbi_installment',
      gross_amount_cents: amountCents,
      platform_fee_cents: platformFeeCents,
      net_amount_cents: creatorAmountCents,
      currency: 'EUR',
      payment_provider: 'tbi_bank',
      payment_reference: application.tbi_application_id || application.tbi_order_id,
      status: 'completed',
    });

    // Update creator pending balance (TBI payments go to pending first)
    await supabase.rpc('add_to_pending_balance', {
      p_creator_id: application.creator_id,
      p_amount_cents: creatorAmountCents,
    });

    console.log(`Recorded TBI sale for creator ${application.creator_id}: ${creatorAmountCents} cents`);
  } catch (error) {
    console.error('Error recording creator sale:', error);
    // Don't throw - sale recording failure shouldn't fail webhook
  }
}
