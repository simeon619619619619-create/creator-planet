/**
 * Waitlist Type Definitions
 * Shared types for waitlist functionality across the application
 */

/**
 * Interest types for waitlist signups
 */
export type WaitlistInterest = 'creator' | 'coach' | 'mentor' | 'student' | 'other';

/**
 * Source types for tracking where signups came from
 */
export type WaitlistSource =
  | 'landing_page'
  | 'referral'
  | 'social_media'
  | 'email_campaign'
  | 'organic'
  | 'paid_ad'
  | 'other';

/**
 * Database record for waitlist entry
 * Matches Supabase table schema
 */
export interface WaitlistEntry {
  id: string;
  email: string;
  name: string | null;
  interest: WaitlistInterest;
  source: WaitlistSource | string;
  created_at: string;
}

/**
 * Form data for submitting a new waitlist entry
 */
export interface WaitlistSubmission {
  email: string;
  name?: string;
  interest: WaitlistInterest;
  source?: WaitlistSource | string;
}

/**
 * API response from waitlist operations
 */
export interface WaitlistResult {
  success: boolean;
  message: string;
  data?: WaitlistEntry;
  error?: string;
}

/**
 * Error codes for waitlist operations
 */
export enum WaitlistErrorCode {
  INVALID_EMAIL = 'INVALID_EMAIL',
  EMAIL_EXISTS = 'EMAIL_EXISTS',
  DATABASE_ERROR = 'DATABASE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Statistics for waitlist analytics
 */
export interface WaitlistStats {
  total_count: number;
  by_interest: Record<WaitlistInterest, number>;
  by_source: Record<string, number>;
  recent_signups: number; // last 24h
  growth_rate: number; // percentage
}

/**
 * Filters for querying waitlist entries
 */
export interface WaitlistFilters {
  interest?: WaitlistInterest;
  source?: WaitlistSource | string;
  date_from?: string;
  date_to?: string;
  search?: string; // search by email or name
}

/**
 * Props for WaitlistSection component
 */
export interface WaitlistSectionProps {
  onSuccess?: (data: WaitlistResult) => void;
  onError?: (error: WaitlistResult) => void;
  className?: string;
  hidePrivacyText?: boolean;
  customTitle?: string;
  customSubtitle?: string;
}

/**
 * Type guard to check if a string is a valid WaitlistInterest
 */
export function isWaitlistInterest(value: string): value is WaitlistInterest {
  return ['creator', 'coach', 'mentor', 'student', 'other'].includes(value);
}

/**
 * Type guard to check if a result is successful
 */
export function isSuccessResult(result: WaitlistResult): result is WaitlistResult & { data: WaitlistEntry } {
  return result.success && result.data !== undefined;
}

/**
 * Type guard to check if a result is an error
 */
export function isErrorResult(result: WaitlistResult): result is WaitlistResult & { error: string } {
  return !result.success && result.error !== undefined;
}
