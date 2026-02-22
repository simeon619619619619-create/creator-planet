// =============================================================================
// DWY Packages Types
// Done-With-You premium services type definitions
// =============================================================================

export type DwyPackageTier = 'launch_system' | 'growth_partner';

export type DwyApplicationStatus =
  | 'pending'
  | 'under_review'
  | 'interview_scheduled'
  | 'approved'
  | 'rejected'
  | 'withdrawn'
  | 'converted';

export type DwyEngagementStatus =
  | 'onboarding'
  | 'active'
  | 'paused'
  | 'completed'
  | 'cancelled';

export interface DwyPackageFeature {
  title: string;
  description: string;
}

export interface DwyPackage {
  id: string;
  tier: DwyPackageTier;
  name: string;
  tagline: string | null;
  description: string | null;
  features: DwyPackageFeature[];
  price_display: string | null;
  price_note: string | null;
  is_active: boolean;
  slots_available: number | null;
  display_order: number;
  highlight_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface DwyApplicationFormData {
  business_name: string;
  business_type: string;
  current_revenue: string;
  goals: string;
  timeline: string;
  website_url?: string;
  social_links?: Record<string, string>;
  how_heard?: string;
  additional_notes?: string;
}

export interface DwyApplication {
  id: string;
  creator_id: string;
  package_id: string;
  status: DwyApplicationStatus;
  business_name: string | null;
  business_type: string | null;
  current_revenue: string | null;
  goals: string | null;
  timeline: string | null;
  website_url: string | null;
  social_links: Record<string, string>;
  how_heard: string | null;
  additional_notes: string | null;
  internal_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  interview_scheduled_at: string | null;
  interview_link: string | null;
  interview_notes: string | null;
  decision_reason: string | null;
  submitted_at: string;
  created_at: string;
  updated_at: string;
  // Joined data
  package?: DwyPackage;
}

export interface DwyEngagementMilestone {
  name: string;
  status: 'pending' | 'in_progress' | 'completed';
  due_at?: string;
  completed_at?: string;
}

export interface DwyEngagement {
  id: string;
  creator_id: string;
  package_id: string;
  application_id: string | null;
  status: DwyEngagementStatus;
  started_at: string;
  expected_end_at: string | null;
  completed_at: string | null;
  scope_document_url: string | null;
  project_folder_url: string | null;
  slack_channel: string | null;
  account_manager_id: string | null;
  milestones: DwyEngagementMilestone[];
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  package?: DwyPackage;
}

// Business type options for application form
export const BUSINESS_TYPES = [
  { value: 'course_creator', label: 'Course Creator' },
  { value: 'coach', label: 'Coach / Consultant' },
  { value: 'service_provider', label: 'Service Provider' },
  { value: 'community_builder', label: 'Community Builder' },
  { value: 'other', label: 'Other' },
] as const;

// Revenue range options
export const REVENUE_RANGES = [
  { value: '0-5k', label: '€0 - €5,000' },
  { value: '5k-20k', label: '€5,000 - €20,000' },
  { value: '20k-50k', label: '€20,000 - €50,000' },
  { value: '50k+', label: '€50,000+' },
] as const;

// Timeline options
export const TIMELINE_OPTIONS = [
  { value: 'asap', label: 'As soon as possible' },
  { value: '1_month', label: 'Within 1 month' },
  { value: '1_3_months', label: '1-3 months' },
  { value: 'exploring', label: 'Just exploring options' },
] as const;

// Status display configurations
export const APPLICATION_STATUS_CONFIG: Record<DwyApplicationStatus, { label: string; color: string }> = {
  pending: { label: 'Pending Review', color: 'bg-yellow-100 text-yellow-800' },
  under_review: { label: 'Under Review', color: 'bg-blue-100 text-blue-800' },
  interview_scheduled: { label: 'Interview Scheduled', color: 'bg-purple-100 text-purple-800' },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-800' },
  rejected: { label: 'Not Selected', color: 'bg-gray-100 text-gray-600' },
  withdrawn: { label: 'Withdrawn', color: 'bg-gray-100 text-gray-600' },
  converted: { label: 'Active Engagement', color: 'bg-green-100 text-green-800' },
};

export const ENGAGEMENT_STATUS_CONFIG: Record<DwyEngagementStatus, { label: string; color: string }> = {
  onboarding: { label: 'Onboarding', color: 'bg-blue-100 text-blue-800' },
  active: { label: 'Active', color: 'bg-green-100 text-green-800' },
  paused: { label: 'Paused', color: 'bg-yellow-100 text-yellow-800' },
  completed: { label: 'Completed', color: 'bg-gray-100 text-gray-600' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800' },
};
