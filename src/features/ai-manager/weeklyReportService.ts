// ============================================================================
// WEEKLY REPORT SERVICE
// Service functions for fetching and managing weekly success reports
// ============================================================================

import { supabase } from '../../core/supabase/client';

// ============================================================================
// TYPES
// ============================================================================

export interface WeeklyReport {
  id: string;
  creator_id: string;
  report_content: string;
  generated_at: string;
  week_start: string;
  week_end: string;
  students_analyzed: number;
  at_risk_count: number;
  generation_source: 'manual' | 'automated';
  created_at: string;
  updated_at: string;
}

export interface GenerateReportResponse {
  success: boolean;
  report?: {
    id: string;
    generated_at: string;
    week_start: string;
    week_end: string;
    content: string;
  };
  error?: string;
  skipped?: boolean;
  message?: string;
}

// ============================================================================
// FETCH REPORTS
// ============================================================================

/**
 * Get all weekly reports for a creator, ordered by most recent first
 * @param creatorId - The profile.id of the creator (NOT auth.users.id)
 * @param limit - Maximum number of reports to fetch (default: 10)
 */
export async function getWeeklyReports(
  creatorId: string,
  limit: number = 10
): Promise<WeeklyReport[]> {
  const { data, error } = await supabase
    .from('weekly_success_reports')
    .select('*')
    .eq('creator_id', creatorId)
    .order('generated_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching weekly reports:', error);
    return [];
  }

  return data || [];
}

/**
 * Get the most recent weekly report for a creator
 * @param creatorId - The profile.id of the creator
 */
export async function getLatestWeeklyReport(
  creatorId: string
): Promise<WeeklyReport | null> {
  const { data, error } = await supabase
    .from('weekly_success_reports')
    .select('*')
    .eq('creator_id', creatorId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned - not an error, just no reports yet
      return null;
    }
    console.error('Error fetching latest report:', error);
    return null;
  }

  return data;
}

/**
 * Get a specific weekly report by ID
 * @param reportId - The UUID of the report
 */
export async function getWeeklyReportById(
  reportId: string
): Promise<WeeklyReport | null> {
  const { data, error } = await supabase
    .from('weekly_success_reports')
    .select('*')
    .eq('id', reportId)
    .single();

  if (error) {
    console.error('Error fetching report by ID:', error);
    return null;
  }

  return data;
}

/**
 * Get reports for a specific date range
 * @param creatorId - The profile.id of the creator
 * @param startDate - Start of the date range (ISO string or Date)
 * @param endDate - End of the date range (ISO string or Date)
 */
export async function getWeeklyReportsByDateRange(
  creatorId: string,
  startDate: string | Date,
  endDate: string | Date
): Promise<WeeklyReport[]> {
  const start = typeof startDate === 'string' ? startDate : startDate.toISOString();
  const end = typeof endDate === 'string' ? endDate : endDate.toISOString();

  const { data, error } = await supabase
    .from('weekly_success_reports')
    .select('*')
    .eq('creator_id', creatorId)
    .gte('generated_at', start)
    .lte('generated_at', end)
    .order('generated_at', { ascending: false });

  if (error) {
    console.error('Error fetching reports by date range:', error);
    return [];
  }

  return data || [];
}

// ============================================================================
// GENERATE REPORT
// ============================================================================

/**
 * Generate a new weekly report via the edge function
 * @param creatorId - The profile.id of the creator
 */
export async function generateWeeklyReport(
  creatorId: string
): Promise<GenerateReportResponse> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  const { data: session } = await supabase.auth.getSession();

  if (!session?.session?.access_token) {
    return {
      success: false,
      error: 'Not authenticated. Please log in and try again.',
    };
  }

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/generate-weekly-report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.session.access_token}`,
      },
      body: JSON.stringify({
        action: 'generate',
        creatorId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || `Failed to generate report (status: ${response.status})`,
      };
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error generating weekly report:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate report',
    };
  }
}

// ============================================================================
// DELETE REPORT
// ============================================================================

/**
 * Delete a weekly report
 * @param reportId - The UUID of the report to delete
 */
export async function deleteWeeklyReport(reportId: string): Promise<boolean> {
  const { error } = await supabase
    .from('weekly_success_reports')
    .delete()
    .eq('id', reportId);

  if (error) {
    console.error('Error deleting weekly report:', error);
    return false;
  }

  return true;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if a report already exists for the current week
 * @param creatorId - The profile.id of the creator
 */
export async function hasReportForCurrentWeek(creatorId: string): Promise<boolean> {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);
  weekStart.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('weekly_success_reports')
    .select('id')
    .eq('creator_id', creatorId)
    .gte('week_start', weekStart.toISOString().split('T')[0])
    .limit(1);

  if (error) {
    console.error('Error checking for existing report:', error);
    return false;
  }

  return data && data.length > 0;
}

/**
 * Format a report's date range for display
 * @param weekStart - ISO date string for week start
 * @param weekEnd - ISO date string for week end
 */
export function formatReportDateRange(weekStart: string, weekEnd: string): string {
  const start = new Date(weekStart);
  const end = new Date(weekEnd);

  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
  };

  const yearOptions: Intl.DateTimeFormatOptions = {
    ...options,
    year: 'numeric',
  };

  // If same month, format as "Jan 1 - 7, 2026"
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.getDate()}, ${end.getFullYear()}`;
  }

  // If different months but same year, format as "Jan 28 - Feb 3, 2026"
  if (start.getFullYear() === end.getFullYear()) {
    return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', yearOptions)}`;
  }

  // Different years (edge case)
  return `${start.toLocaleDateString('en-US', yearOptions)} - ${end.toLocaleDateString('en-US', yearOptions)}`;
}
