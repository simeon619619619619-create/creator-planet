import { supabase } from '../../core/supabase/client';

// Types
export interface WaitlistEntry {
  id: string;
  email: string;
  name: string | null;
  interest: 'creator' | 'coach' | 'mentor' | 'student' | 'other';
  source: string;
  created_at: string;
}

export interface WaitlistSubmission {
  email: string;
  name?: string;
  interest: 'creator' | 'coach' | 'mentor' | 'student' | 'other';
  source?: string;
}

export interface WaitlistResult {
  success: boolean;
  message: string;
  data?: WaitlistEntry;
  error?: string;
}

/**
 * Submit a new waitlist entry
 * Checks for existing email before inserting
 */
export async function submitWaitlist(
  submission: WaitlistSubmission
): Promise<WaitlistResult> {
  try {
    const { email, name, interest, source = 'landing_page' } = submission;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        success: false,
        message: 'Please enter a valid email address',
        error: 'INVALID_EMAIL',
      };
    }

    // Check if email already exists
    const { data: existingEntry, error: checkError } = await supabase
      .from('waitlist')
      .select('id, email')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (checkError) {
      console.error('Error checking existing email:', checkError);
      return {
        success: false,
        message: 'An error occurred. Please try again.',
        error: checkError.message,
      };
    }

    if (existingEntry) {
      return {
        success: false,
        message: 'This email is already on the waitlist!',
        error: 'EMAIL_EXISTS',
      };
    }

    // Insert new waitlist entry
    const { data, error: insertError } = await supabase
      .from('waitlist')
      .insert({
        email: email.toLowerCase(),
        name: name || null,
        interest,
        source,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting waitlist entry:', insertError);
      return {
        success: false,
        message: 'Failed to join waitlist. Please try again.',
        error: insertError.message,
      };
    }

    return {
      success: true,
      message: 'Successfully joined the waitlist!',
      data: data as WaitlistEntry,
    };
  } catch (error) {
    console.error('Unexpected error in submitWaitlist:', error);
    return {
      success: false,
      message: 'An unexpected error occurred. Please try again.',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get all waitlist entries (admin only)
 */
export async function getWaitlistEntries(): Promise<WaitlistEntry[]> {
  try {
    const { data, error } = await supabase
      .from('waitlist')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching waitlist entries:', error);
      return [];
    }

    return (data as WaitlistEntry[]) || [];
  } catch (error) {
    console.error('Unexpected error in getWaitlistEntries:', error);
    return [];
  }
}

/**
 * Get waitlist count
 */
export async function getWaitlistCount(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('waitlist')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('Error getting waitlist count:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('Unexpected error in getWaitlistCount:', error);
    return 0;
  }
}
