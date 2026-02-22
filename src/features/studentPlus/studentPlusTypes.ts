// =============================================================================
// Student Plus Types
// Phase 2: Student Monetization with Loyalty Points & Rewards
// =============================================================================

// Subscription status (aligned with Stripe)
export type StudentSubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused';

// Reward types
export type RewardType =
  | 'voucher'
  | 'template_pack'
  | 'fee_discount'
  | 'priority_support'
  | 'exclusive_content'
  | 'badge';

// Redemption status
export type RedemptionStatus =
  | 'pending'
  | 'active'
  | 'used'
  | 'expired'
  | 'revoked';

// Point transaction types
export type PointTransactionType =
  | 'subscription_payment'
  | 'milestone_bonus'
  | 'referral'
  | 'engagement'
  | 'redemption'
  | 'adjustment'
  | 'expiration';

// =============================================================================
// Database Models
// =============================================================================

export interface StudentSubscription {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  status: StudentSubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_start: string | null;
  trial_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  cancellation_reason: string | null;
  subscribed_since: string | null;
  consecutive_months: number;
  total_months_subscribed: number;
  created_at: string;
  updated_at: string;
}

export interface LoyaltyMilestone {
  id: string;
  name: string;
  description: string | null;
  months_required: number;
  bonus_points: number;
  reward_ids: string[];
  badge_emoji: string | null;
  badge_color: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoyaltyPointTransaction {
  id: string;
  user_id: string;
  subscription_id: string | null;
  transaction_type: PointTransactionType;
  points: number;
  balance_after: number;
  description: string | null;
  reference_id: string | null;
  reference_type: string | null;
  expires_at: string | null;
  expired: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface MilestoneAchievement {
  id: string;
  user_id: string;
  milestone_id: string;
  subscription_id: string | null;
  achieved_at: string;
  bonus_points_awarded: number;
  notified: boolean;
  notified_at: string | null;
  created_at: string;
  // Joined data
  milestone?: LoyaltyMilestone;
}

export interface Reward {
  id: string;
  name: string;
  description: string | null;
  reward_type: RewardType;
  point_cost: number;
  is_milestone_reward: boolean;
  value_config: RewardValueConfig;
  is_active: boolean;
  available_from: string | null;
  available_until: string | null;
  max_redemptions: number | null;
  current_redemptions: number;
  max_per_user: number | null;
  cooldown_days: number | null;
  image_url: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface RewardRedemption {
  id: string;
  user_id: string;
  reward_id: string;
  subscription_id: string | null;
  milestone_achievement_id: string | null;
  points_spent: number;
  status: RedemptionStatus;
  reward_type: RewardType;
  reward_value: RewardValueConfig;
  valid_from: string | null;
  valid_until: string | null;
  used_at: string | null;
  used_for_reference: string | null;
  voucher_code: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  reward?: Reward;
}

// =============================================================================
// Value Config Types
// =============================================================================

export interface VoucherConfig {
  discount_percent: number;
  max_discount_cents?: number;
  valid_days: number;
}

export interface TemplatePackConfig {
  pack_id: string;
  files?: string[];
  download_url?: string;
}

export interface FeeDiscountConfig {
  discount_percent: number;
  duration_days: number;
}

export interface PrioritySupportConfig {
  duration_days: number;
}

export interface BadgeConfig {
  badge_id: string;
  permanent: boolean;
}

export type RewardValueConfig =
  | VoucherConfig
  | TemplatePackConfig
  | FeeDiscountConfig
  | PrioritySupportConfig
  | BadgeConfig
  | Record<string, unknown>;

// =============================================================================
// UI/Service Types
// =============================================================================

export interface LoyaltyPointsBalance {
  user_id: string;
  total_points: number;
  total_spent: number;
  total_earned: number;
  last_transaction_at?: string;
}

export interface MilestoneWithProgress extends LoyaltyMilestone {
  achieved: boolean;
  achievement?: MilestoneAchievement;
  progress: number; // 0-100
}

export interface CheckoutSessionResponse {
  checkoutUrl: string;
  sessionId: string;
}

export interface PortalSessionResponse {
  portalUrl: string;
}

// =============================================================================
// Configuration
// =============================================================================

export const STUDENT_PLUS_CONFIG = {
  product: {
    productId: 'prod_student_plus',
    priceId: 'price_student_plus_990_eur_monthly',
    amount: 990, // EUR 9.90 in cents
    currency: 'eur',
    interval: 'month' as const,
  },
  points: {
    perPayment: 50, // Points earned per monthly payment
    expirationDays: null as number | null, // Points don't expire
  },
  milestones: [
    { months: 3, name: 'Bronze', emoji: '🥉', bonus: 100 },
    { months: 6, name: 'Silver', emoji: '🥈', bonus: 250 },
    { months: 9, name: 'Gold', emoji: '🥇', bonus: 500 },
    { months: 12, name: 'Diamond', emoji: '💎', bonus: 1000 },
  ],
} as const;

// Helper to format price
export function formatPrice(cents: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('en-EU', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}
