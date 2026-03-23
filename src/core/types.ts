export enum View {
  DASHBOARD = 'DASHBOARD',
  COMMUNITY = 'COMMUNITY',
  COURSES = 'COURSES',
  HOMEWORK = 'homework',
  AI_CHAT = 'ai_chat',
  CALENDAR = 'CALENDAR',
  AI_MANAGER = 'AI_MANAGER',
  STUDENT_MANAGER = 'student_manager',
  DISCOUNTS = 'discounts',
  SURVEYS = 'surveys',
  SETTINGS = 'SETTINGS',
  MESSAGES = 'messages',  // Team member inbox
  MEMBERS = 'members'     // Team member view of community members
}

export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface Student {
  id: string;
  name: string;
  avatar: string;
  email: string;
  joinDate: string;
  lastLogin: string;
  courseProgress: number; // 0-100
  communityEngagement: number; // Score 0-100
  riskLevel: RiskLevel;
  riskReason?: string;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  modules: Module[];
}

export interface Module {
  id: string;
  title: string;
  lessons: Lesson[];
}

export interface Lesson {
  id: string;
  title: string;
  type: 'video' | 'text' | 'file';
  duration?: string;
  isCompleted: boolean;
}

export interface Post {
  id: string;
  author: {
    name: string;
    avatar: string;
    role: 'Creator' | 'Student' | 'Admin';
  };
  content: string;
  likes: number;
  comments: number;
  timestamp: string;
  tags: string[];
}

export interface CalendarEvent {
  id: string;
  title: string;
  type: 'Live Call' | 'Workshop' | 'Meetup';
  date: string;
  time: string;
  attendees: number;
}

export interface AIMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

// Auth Types
export type UserRole = 'creator' | 'student' | 'member' | 'superadmin';

export interface Profile {
  id: string;
  user_id: string;
  role: UserRole;
  full_name: string | null;
  avatar_url: string | null;
  email: string;
  created_at: string;
  last_login_at: string | null;
}

// ============================================================================
// PUBLIC COMMUNITY TYPES (for landing pages)
// ============================================================================

export interface CommunityListItem {
  id: string;
  name: string;
  description: string | null;
  thumbnail_url: string | null;
  memberCount: number;
  pricing_type: 'free' | 'one_time' | 'monthly';
  price_cents: number;
  category: import('./supabase/database.types').ContentCategory | null;
  thumbnail_focal_x?: number | null;
  thumbnail_focal_y?: number | null;
  creator: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

export interface ChannelPreview {
  id: string;
  name: string;
  description: string | null;
  postCount: number;
}

export interface PostPreview {
  id: string;
  content: string;
  author: {
    full_name: string;
    avatar_url: string | null;
  };
  created_at: string;
  likes_count: number;
  comments_count: number;
}

export interface CreatorPublicProfile {
  full_name: string;
  avatar_url: string | null;
  brand_name: string | null;
  bio: string | null;
}

export interface CommunityPublicData {
  community: {
    id: string;
    name: string;
    description: string | null;
    thumbnail_url: string | null;
    is_public: boolean;
    created_at: string;
    pricing_type: 'free' | 'one_time' | 'monthly' | 'both';
    price_cents: number;
    monthly_price_cents?: number;
    currency: string;
    vsl_url: string | null;
    access_type: 'open' | 'gated';
    tbi_enabled?: boolean;
    thumbnail_focal_x?: number | null;
    thumbnail_focal_y?: number | null;
    theme_color?: string | null;
    text_color?: string | null;
    accent_color?: string | null;
    background_elements?: import('./supabase/database.types').BackgroundElement[] | null;
    slug?: string | null;
  };
  memberCount: number;
  channelPreviews: ChannelPreview[];
  recentPosts: PostPreview[];
  creator: CreatorPublicProfile;
}

// ============================================================================
// BILLING & SUBSCRIPTION TYPES (Phase 1: Creator Plans)
// ============================================================================

// Plan tier types (Starter/Pro/Scale)
export type PlanTier = 'starter' | 'pro' | 'scale';

// Billing/subscription status
export type BillingStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused';

// Transaction types for billing ledger
export type TransactionType =
  | 'activation_fee'
  | 'subscription'
  | 'platform_fee'
  | 'refund'
  | 'payout'
  | 'adjustment';

// Transaction status
export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'refunded';

// Plan feature flags (stored in billing_plans.features JSONB)
export interface PlanFeatures {
  max_students: number;          // -1 = unlimited
  max_courses: number;           // -1 = unlimited
  max_communities: number;       // -1 = unlimited
  ai_enabled: boolean;
  custom_branding: boolean;
  priority_support: boolean;
  white_label: boolean;
  advanced_analytics: boolean;
  api_access: boolean;
}

// Billing plan configuration (Starter/Pro/Scale)
export interface BillingPlan {
  id: string;
  tier: PlanTier;
  name: string;
  description: string | null;
  price_monthly_cents: number;
  platform_fee_percent: number;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  features: PlanFeatures;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Creator billing state (per-creator)
export interface CreatorBilling {
  id: string;
  creator_id: string;
  plan_id: string;
  status: BillingStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_account_id: string | null;
  stripe_account_status: string | null;
  has_first_sale: boolean;
  first_sale_at: string | null;
  monthly_fee_active: boolean;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  activation_fee_paid: boolean;
  activation_fee_paid_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  plan?: BillingPlan;
}

// Billing transaction record (immutable ledger)
export interface BillingTransaction {
  id: string;
  creator_id: string;
  type: TransactionType;
  status: TransactionStatus;
  amount_cents: number;
  currency: string;
  description: string | null;
  stripe_payment_intent_id: string | null;
  stripe_invoice_id: string | null;
  stripe_charge_id: string | null;
  stripe_transfer_id: string | null;
  related_sale_id: string | null;
  related_subscription_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  processed_at: string | null;
}

// Creator sale record (for platform fee tracking)
export interface CreatorSale {
  id: string;
  creator_id: string;
  buyer_id: string | null;
  product_type: 'course' | 'membership' | 'product';
  product_id: string | null;
  product_name: string;
  sale_amount_cents: number;
  platform_fee_cents: number;
  stripe_fee_cents: number;
  net_amount_cents: number;
  currency: string;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  stripe_transfer_id: string | null;
  status: TransactionStatus;
  refunded_at: string | null;
  created_at: string;
  completed_at: string | null;
}

// Convenience types for UI

// Plan display info for pricing page
export interface PlanDisplayInfo {
  tier: PlanTier;
  name: string;
  priceMonthly: string;           // Formatted: "EUR 30"
  platformFee: string;            // Formatted: "3.9%"
  features: string[];             // Human-readable feature list
  recommended?: boolean;
  breakEvenRevenue?: string;      // "EUR 750/month"
}

// Billing dashboard data
export interface BillingDashboardData {
  currentPlan: BillingPlan;
  billing: CreatorBilling;
  currentPeriodRevenue: number;   // This month's sales in cents
  platformFeesThisPeriod: number; // Fees taken this period in cents
  totalRevenue: number;           // All-time revenue in cents
  recentTransactions: BillingTransaction[];
  nextInvoiceDate: string | null;
  nextInvoiceAmount: number | null;
}

// Plan limits for feature gating
export interface PlanLimitsInfo {
  canAddStudent: boolean;
  canAddCourse: boolean;
  canAddCommunity: boolean;
  hasAiAccess: boolean;
  hasCustomBranding: boolean;
  hasPrioritySupport: boolean;
  hasWhiteLabel: boolean;
  hasAdvancedAnalytics: boolean;
  hasApiAccess: boolean;
  usage: {
    students: { current: number; max: number };
    courses: { current: number; max: number };
    communities: { current: number; max: number };
  };
}

// Legacy types for backward compatibility (deprecated, use BillingPlan/CreatorBilling)
/** @deprecated Use PlanTier instead */
export type PlanType = 'creator' | 'business' | 'elite';
/** @deprecated Use BillingStatus instead */
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete';

/** @deprecated Use BillingPlan instead */
export interface PaymentPlan {
  id: string;
  name: string;
  plan_type: PlanType;
  price_monthly: number;           // Price in cents
  price_yearly: number | null;     // Price in cents
  platform_fee_percent: number;
  transaction_fee_percent: number;
  features: PlanFeatures;
  is_active: boolean;
  created_at: string;
}

/** @deprecated Use CreatorBilling instead */
export interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  trial_end: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  plan?: PaymentPlan;
}

// ============================================================================
// AI CONVERSATION TYPES
// ============================================================================

export type AIContextType = 'course' | 'community' | 'support' | 'success_manager';

export interface AIMessageRecord {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

export interface AIConversation {
  id: string;
  user_id: string;
  context_type: AIContextType;
  context_id: string | null;
  title: string | null;
  messages: AIMessageRecord[];
  tokens_used: number;
  cost_usd: number | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}
