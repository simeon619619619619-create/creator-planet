// ============================================================================
// TBI STATUS CHECK EDGE FUNCTION
// Polls TBI Bank API for application status updates
// ============================================================================
//
// Endpoints:
// POST /tbi-status-check
//   - Body: { applicationId: string } (our internal application ID)
//   - Returns updated application status
//
// Use Cases:
// - Manual status refresh by user
// - Background polling for pending applications
// ============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { getUserFromToken, createServiceClient } from '../_shared/supabase.ts';
import { jsonResponse, errorResponse, unauthorizedResponse, serverErrorResponse } from '../_shared/response.ts';
import { checkApplicationStatus, mapTBIStatus } from '../_shared/tbi.ts';

interface StatusCheckRequest {
  applicationId: string;
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
    const body: StatusCheckRequest = await req.json();
    const { applicationId } = body;

    if (!applicationId) {
      return errorResponse('applicationId is required');
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

    // Get application by our internal ID
    const { data: application, error: appError } = await supabase
      .from('tbi_applications')
      .select('*')
      .eq('id', applicationId)
      .single();

    if (appError || !application) {
      return errorResponse('Application not found', 404);
    }

    // Verify user owns this application (buyer or creator)
    if (application.buyer_id !== profile.id && application.creator_id !== profile.id) {
      return errorResponse('Access denied', 403);
    }

    // If application is already in a terminal state, return cached status
    const terminalStates = ['completed', 'rejected', 'cancelled', 'expired'];
    if (terminalStates.includes(application.status)) {
      return jsonResponse({
        success: true,
        application: formatApplication(application),
        fromCache: true,
      });
    }

    // Check if we should poll (rate limiting - max once per minute)
    const lastCheck = application.last_status_check_at;
    if (lastCheck) {
      const lastCheckTime = new Date(lastCheck).getTime();
      const now = Date.now();
      const minInterval = 60 * 1000; // 1 minute

      if (now - lastCheckTime < minInterval) {
        return jsonResponse({
          success: true,
          application: formatApplication(application),
          fromCache: true,
          message: 'Status checked recently, returning cached value',
        });
      }
    }

    // Poll TBI API using the application's TBI IDs
    const tbiResponse = await checkApplicationStatus(
      application.tbi_application_id || undefined,
      application.tbi_order_id || undefined
    );

    // Update last check time regardless of result
    await supabase
      .from('tbi_applications')
      .update({ last_status_check_at: new Date().toISOString() })
      .eq('id', applicationId);

    if (!tbiResponse.success) {
      // Return cached status on API error
      return jsonResponse({
        success: true,
        application: formatApplication(application),
        fromCache: true,
        warning: 'Could not refresh status from TBI',
      });
    }

    // checkApplicationStatus already calls mapTBIStatus internally,
    // so tbiResponse.status is already our mapped status.
    // But if TBI returned a raw status string we need to map, use tbi_status.
    const newStatus = tbiResponse.status || application.status;
    const statusChanged = newStatus !== application.status;

    if (statusChanged) {
      // Update application with new status
      const updateData: Record<string, unknown> = {
        status: newStatus,
        tbi_status: tbiResponse.tbi_status, // Raw TBI status string
      };

      // Grant access if completed
      if (newStatus === 'completed') {
        updateData.access_granted = true;
        updateData.access_granted_at = new Date().toISOString();

        // Grant actual access
        await grantAccess(supabase, application);
      }

      const { data: updatedApp, error: updateError } = await supabase
        .from('tbi_applications')
        .update(updateData)
        .eq('id', applicationId)
        .select('*')
        .single();

      if (updateError) {
        console.error('Error updating application status:', updateError);
      }

      return jsonResponse({
        success: true,
        application: formatApplication(updatedApp || application),
        statusChanged: true,
        previousStatus: application.status,
        newStatus,
      });
    }

    return jsonResponse({
      success: true,
      application: formatApplication(application),
      fromCache: false,
      statusChanged: false,
    });
  } catch (error) {
    console.error('TBI Status Check error:', error);
    return serverErrorResponse(
      error instanceof Error ? error.message : 'Failed to check status'
    );
  }
});

/**
 * Format application for response (hide sensitive data)
 */
function formatApplication(app: Record<string, unknown>) {
  return {
    id: app.id,
    communityId: app.community_id,
    courseId: app.course_id,
    status: app.status,
    tbiStatus: app.tbi_status,
    amountCents: app.amount_cents,
    currency: app.currency,
    monthlyInstallmentCents: app.monthly_installment_cents,
    installmentCount: app.installment_count,
    accessGranted: app.access_granted,
    accessGrantedAt: app.access_granted_at,
    rejectionReason: app.rejection_reason,
    createdAt: app.created_at,
    updatedAt: app.updated_at,
    expiresAt: app.expires_at,
  };
}

/**
 * Grant access to community or course
 */
async function grantAccess(
  supabase: ReturnType<typeof createServiceClient>,
  application: Record<string, unknown>
): Promise<void> {
  try {
    if (application.community_id && application.membership_id) {
      await supabase
        .from('memberships')
        .update({
          payment_status: 'paid',
          paid_at: new Date().toISOString(),
        })
        .eq('id', application.membership_id);
    }

    if (application.course_id && application.enrollment_id) {
      await supabase
        .from('enrollments')
        .update({
          status: 'active',
          enrolled_at: new Date().toISOString(),
        })
        .eq('id', application.enrollment_id);
    }
  } catch (error) {
    console.error('Error granting access:', error);
  }
}
