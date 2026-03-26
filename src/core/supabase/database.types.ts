// Database types generated from Supabase schema
// These types match the Phase 2 database tables

export interface BackgroundElement {
  id: string;
  image_url: string;
  x: number;       // % from left (0-100)
  y: number;       // % from top (0-100)
  size: number;    // px width
  opacity: number; // 0-1
  rotation: number; // degrees
}

export interface DbWallet {
  id: string;
  user_id: string;
  community_id: string;
  balance_cents: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface DbWalletTransaction {
  id: string;
  wallet_id: string;
  type: 'cashback' | 'spend' | 'topup' | 'refund';
  amount_cents: number;
  description: string | null;
  reference_id: string | null;
  created_at: string;
}

export interface DbProduct {
  id: string;
  community_id: string;
  creator_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price_cents: number;
  currency: string;
  is_active: boolean;
  stock: number | null;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbProductPurchase {
  id: string;
  product_id: string;
  buyer_id: string;
  community_id: string;
  amount_cents: number;
  currency: string;
  status: 'pending' | 'completed' | 'refunded';
  stripe_payment_intent_id: string | null;
  created_at: string;
}

export type ContentCategory = 'marketing' | 'business' | 'design' | 'video_photo' | 'personal_development' | 'finance' | 'technology' | 'health_fitness';
export type UserRole = 'creator' | 'student' | 'member' | 'superadmin';
export type MembershipRole = 'admin' | 'moderator' | 'member';
export type LessonType = 'video' | 'text' | 'file' | 'quiz';
export type UnlockType = 'immediate' | 'date' | 'progress' | 'quiz';
export type EnrollmentStatus = 'active' | 'completed' | 'dropped';
export type EventType = 'group' | 'one_on_one';
export type LocationType = 'online' | 'in_person';
export type AttendeeStatus = 'attending' | 'maybe' | 'declined';
export type StudentStatus = 'at_risk' | 'stable' | 'top_member';
export type TaskStatus = 'todo' | 'in_progress' | 'done';

// Profiles (from Phase 1)
export interface DbProfile {
  id: string;
  user_id: string;
  role: UserRole;
  full_name: string | null;
  avatar_url: string | null;
  email: string;
  created_at: string;
  last_login_at: string | null;
}

// Creator Profiles
export interface DbCreatorProfile {
  id: string;
  creator_id: string;
  brand_name: string | null;
  bio: string | null;
  timezone: string;
  ai_prompt: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  updated_at: string;
}

// Communities
export interface DbCommunity {
  id: string;
  creator_id: string;
  name: string;
  description: string | null;
  thumbnail_url: string | null;
  is_public: boolean;
  category: ContentCategory | null;
  created_at: string;
  updated_at: string;
  // Pricing fields
  pricing_type?: 'free' | 'one_time' | 'monthly' | 'both';
  price_cents?: number;
  monthly_price_cents?: number;
  currency?: string;
  stripe_product_id?: string | null;
  stripe_price_id?: string | null;
  stripe_monthly_price_id?: string | null;
  // VSL video
  vsl_url?: string | null;
  // Access control
  access_type?: 'open' | 'gated';
  // TBI BNPL
  tbi_enabled?: boolean;
  tbi_min_amount_cents?: number;
  // Thumbnail focal point
  thumbnail_focal_x?: number | null;
  thumbnail_focal_y?: number | null;
  // Page theme color
  theme_color?: string | null;
  // Page text color
  text_color?: string | null;
  // Card/surface accent color
  accent_color?: string | null;
  // Secondary/muted text color
  secondary_color?: string | null;
  // Section/content panel color (settings panels, content cards)
  section_color?: string | null;
  // Button color
  button_color?: string | null;
  // Background decorative elements (JSON array)
  background_elements?: BackgroundElement[] | null;
  // Shop
  shop_enabled?: boolean;
  // Cashback
  cashback_enabled?: boolean;
  cashback_percent?: number;
  // Friendly URL slug
  slug?: string | null;
  // Community logo (shown in sidebar when viewing this community)
  logo_url?: string | null;
}

// Community Channels
export interface DbCommunityChannel {
  id: string;
  community_id: string;
  name: string;
  description: string | null;
  position: number;
  group_id: string | null;
  created_at: string;
}

// Memberships
export interface DbMembership {
  id: string;
  user_id: string;
  community_id: string;
  role: MembershipRole;
  joined_at: string;
}

// Posts
export interface DbPost {
  id: string;
  channel_id: string;
  author_id: string;
  content: string;
  image_url: string | null;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

// Post with relations (for querying)
export interface DbPostWithAuthor extends DbPost {
  author: DbProfile;
  channel?: DbCommunityChannel;
  likes_count?: number;
  comments_count?: number;
  user_has_liked?: boolean;
}

// Post Comments
export interface DbPostComment {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  created_at: string;
}

export interface DbPostCommentWithAuthor extends DbPostComment {
  author: DbProfile;
}

// Post Likes
export interface DbPostLike {
  id: string;
  post_id: string;
  user_id: string;
  created_at: string;
}

// Courses
export interface DbCourse {
  id: string;
  creator_id: string;
  community_id: string | null;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  is_published: boolean;
  category: ContentCategory | null;
  created_at: string;
  updated_at: string;
}

// Modules
export interface DbModule {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  position: number;
  unlock_type: UnlockType;
  unlock_value: string | null;
  created_at: string;
}

// Lessons
export interface DbLesson {
  id: string;
  module_id: string;
  title: string;
  description: string | null;
  type: LessonType;
  content_url: string | null;
  position: number;
  duration_minutes: number | null;
  created_at: string;
}

// Enrollments
export interface DbEnrollment {
  id: string;
  user_id: string;
  course_id: string;
  enrolled_at: string;
  status: EnrollmentStatus;
  completed_at: string | null;
}

// Lesson Progress
export interface DbLessonProgress {
  id: string;
  user_id: string;
  lesson_id: string;
  completed_at: string | null;
  progress_percent: number;
  created_at: string;
  updated_at: string;
}

// Events
export interface DbEvent {
  id: string;
  creator_id: string;
  community_id: string | null;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  event_type: EventType;
  location_type: LocationType;
  meeting_link: string | null;
  address: string | null;
  max_attendees: number | null;
  group_id: string | null;
  created_at: string;
  updated_at: string;
}

// Event Attendees
export interface DbEventAttendee {
  id: string;
  event_id: string;
  user_id: string;
  status: AttendeeStatus;
  responded_at: string;
  attended?: boolean;        // Whether the member actually attended (marked by creator)
  attended_at?: string | null; // Timestamp when attendance was marked
}

// Points
export interface DbPoints {
  id: string;
  user_id: string;
  community_id: string;
  total_points: number;
  level: number;
  updated_at: string;
}

// Point Transactions
export interface DbPointTransaction {
  id: string;
  user_id: string;
  community_id: string;
  points: number;
  reason: string;
  created_at: string;
}

// Student Health
export interface DbStudentHealth {
  id: string;
  user_id: string;
  course_id: string;
  risk_score: number;
  status: StudentStatus;
  last_activity_at: string | null;
  updated_at: string;
}

// Tasks
export interface DbTask {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: TaskStatus;
  linked_type: string | null;
  linked_id: string | null;
  created_at: string;
  updated_at: string;
}

// Community Chatbots
export interface DbCommunityChatbot {
  id: string;
  community_id: string;
  name: string;
  role: 'qa' | 'motivation' | 'support';
  system_prompt: string | null;
  personality: string | null;
  greeting_message: string | null;
  avatar_url: string | null;
  show_avatar: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbChatbotConversation {
  id: string;
  chatbot_id: string;
  user_id: string;
  messages: { role: 'user' | 'model'; text: string; timestamp: string }[];
  created_at: string;
  updated_at: string;
}

// Homework System
export interface DbHomeworkAssignment {
  id: string;
  community_id: string;
  creator_id: string;
  title: string;
  description: string | null;
  max_points: number;
  due_date: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbHomeworkSubmission {
  id: string;
  assignment_id: string;
  student_id: string;
  text_response: string | null;
  file_urls: string[];
  status: 'pending' | 'graded';
  points_awarded: number | null;
  feedback: string | null;
  submitted_at: string;
  graded_at: string | null;
  graded_by: string | null;
}

export interface DbHomeworkSubmissionWithStudent extends DbHomeworkSubmission {
  student: DbProfile;
}

export interface DbHomeworkAssignmentWithStats extends DbHomeworkAssignment {
  total_submissions: number;
  pending_count: number;
}

// ============================================================================
// BILLING SYSTEM TYPES
// ============================================================================

export type PlanTier = 'starter' | 'pro' | 'scale';

export type BillingStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused';

export type TransactionType =
  | 'activation_fee'
  | 'subscription'
  | 'platform_fee'
  | 'refund'
  | 'payout'
  | 'adjustment';

export type TransactionStatusType = 'pending' | 'completed' | 'failed' | 'refunded';

// Plan Features (stored as JSONB in billing_plans)
export interface DbPlanFeatures {
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

// Billing Plans
export interface DbBillingPlan {
  id: string;
  tier: PlanTier;
  name: string;
  description: string | null;
  price_monthly_cents: number;
  platform_fee_percent: number;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  features: DbPlanFeatures;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Creator Billing
export interface DbCreatorBilling {
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
}

// Creator Billing with joined plan
export interface DbCreatorBillingWithPlan extends DbCreatorBilling {
  plan?: DbBillingPlan;
}

// Billing Transactions
export interface DbBillingTransaction {
  id: string;
  creator_id: string | null;
  type: TransactionType;
  status: TransactionStatusType;
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

// Creator Sales
export interface DbCreatorSale {
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
  status: TransactionStatusType;
  refunded_at: string | null;
  created_at: string;
  completed_at: string | null;
}

// Creator Sale with buyer info
export interface DbCreatorSaleWithBuyer extends DbCreatorSale {
  buyer?: DbProfile;
}

// Webhook Events
export interface DbWebhookEvent {
  id: string;
  stripe_event_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  processed: boolean;
  processed_at: string | null;
  error: string | null;
  created_at: string;
}

// ============================================================================
// STUDENT PLUS TYPES (Phase 2: Student Monetization)
// ============================================================================

export type StudentSubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused';

export type RewardType =
  | 'voucher'
  | 'template_pack'
  | 'fee_discount'
  | 'priority_support'
  | 'exclusive_content'
  | 'badge';

export type RedemptionStatus =
  | 'pending'
  | 'active'
  | 'used'
  | 'expired'
  | 'revoked';

export type PointTransactionType =
  | 'subscription_payment'
  | 'milestone_bonus'
  | 'referral'
  | 'engagement'
  | 'redemption'
  | 'adjustment'
  | 'expiration';

// Student Subscriptions
export interface DbStudentSubscription {
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

// Loyalty Milestones
export interface DbLoyaltyMilestone {
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

// Loyalty Points (transaction ledger)
export interface DbLoyaltyPoint {
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

// Student Milestone Achievements
export interface DbStudentMilestoneAchievement {
  id: string;
  user_id: string;
  milestone_id: string;
  subscription_id: string | null;
  achieved_at: string;
  bonus_points_awarded: number;
  notified: boolean;
  notified_at: string | null;
  created_at: string;
}

export interface DbStudentMilestoneAchievementWithMilestone extends DbStudentMilestoneAchievement {
  milestone?: DbLoyaltyMilestone;
}

// Rewards
export interface DbReward {
  id: string;
  name: string;
  description: string | null;
  reward_type: RewardType;
  point_cost: number;
  is_milestone_reward: boolean;
  value_config: Record<string, unknown>;
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

// Reward Redemptions
export interface DbRewardRedemption {
  id: string;
  user_id: string;
  reward_id: string;
  subscription_id: string | null;
  milestone_achievement_id: string | null;
  points_spent: number;
  status: RedemptionStatus;
  reward_type: RewardType;
  reward_value: Record<string, unknown>;
  valid_from: string | null;
  valid_until: string | null;
  used_at: string | null;
  used_for_reference: string | null;
  voucher_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbRewardRedemptionWithReward extends DbRewardRedemption {
  reward?: DbReward;
}

// ============================================================================
// DWY PACKAGES TYPES (Phase 3: Done-With-You Premium Services)
// ============================================================================

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

// DWY Package Feature (stored in JSONB)
export interface DwyPackageFeature {
  title: string;
  description: string;
}

// DWY Packages
export interface DbDwyPackage {
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

// DWY Applications
export interface DbDwyApplication {
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
}

export interface DbDwyApplicationWithPackage extends DbDwyApplication {
  package?: DbDwyPackage;
}

// DWY Engagement Milestone (stored in JSONB)
export interface DwyEngagementMilestone {
  name: string;
  status: 'pending' | 'in_progress' | 'completed';
  due_at?: string;
  completed_at?: string;
}

// DWY Engagements
export interface DbDwyEngagement {
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
}

export interface DbDwyEngagementWithPackage extends DbDwyEngagement {
  package?: DbDwyPackage;
}

// ============================================================================
// QUIZ SYSTEM TYPES
// ============================================================================

// Quiz Questions
export interface DbQuizQuestion {
  id: string;
  lesson_id: string;
  question_text: string;
  question_type: 'multiple_choice' | 'free_answer';
  correct_answer: string | null;
  position: number;
  created_at: string;
}

// Quiz Options
export interface DbQuizOption {
  id: string;
  question_id: string;
  option_text: string;
  is_correct: boolean;
  position: number;
}

// Quiz Question with Options (for querying)
export interface DbQuizQuestionWithOptions extends DbQuizQuestion {
  options: DbQuizOption[];
}

// Quiz Attempts
export interface DbQuizAttempt {
  id: string;
  user_id: string;
  lesson_id: string;
  score_percent: number;
  passed: boolean;
  answers: Record<string, string>; // {question_id: selected_option_id or free_answer}
  completed_at: string;
}

// Quiz data for a lesson (for creators)
export interface DbQuizData {
  lesson_id: string;
  questions: DbQuizQuestionWithOptions[];
}

// Quiz attempt result (for students)
export interface DbQuizResult {
  score_percent: number;
  passed: boolean;
  total_questions: number;
  correct_answers: number;
  question_results: {
    question_id: string;
    question_text: string;
    question_type: 'multiple_choice' | 'free_answer';
    selected_option_id: string | null;
    correct_option_id: string;
    selected_answer_text: string | null;
    correct_answer_text: string | null;
    is_correct: boolean;
  }[];
}

// ============================================================================
// COMMUNITY GROUPS TYPES
// ============================================================================

// Community Groups
export interface DbCommunityGroup {
  id: string;
  community_id: string;
  name: string;
  description: string | null;
  position: number;
  created_at: string;
}

// Group Members
export interface DbCommunityGroupMember {
  id: string;
  group_id: string;
  user_id: string;
  assigned_at: string;
  assigned_by: string | null;
}

// Group with member count (for UI)
export interface DbCommunityGroupWithCount extends DbCommunityGroup {
  member_count: number;
}

// Group with members list (for assignment UI)
export interface DbCommunityGroupWithMembers extends DbCommunityGroup {
  members: DbProfile[];
}

// Extended channel type with group info
export interface DbCommunityChannelWithGroup extends DbCommunityChannel {
  group?: DbCommunityGroup | null;
}

// Extended event type with group info
export interface DbEventWithGroup extends DbEvent {
  group?: DbCommunityGroup | null;
}

// Channels organized by group (for sidebar)
export interface ChannelsByGroup {
  global: DbCommunityChannel[];
  groups: {
    group: DbCommunityGroup;
    channels: DbCommunityChannel[];
  }[];
}

// ============================================================================
// GHOST WRITER TYPES (AI Ghost Writer Feature)
// ============================================================================

export type GhostWriterApprovalMode = 'preview' | 'auto';
export type GhostWriterPostType = 'motivation' | 'tip' | 'question' | 'recap' | 'custom';
export type GhostWriterDraftStatus = 'pending' | 'approved' | 'rejected' | 'published';
export type GhostWriterDmTriggerType =
  | 'auto_reply'
  | 'proactive_new_student'
  | 'proactive_inactive'
  | 'proactive_at_risk'
  | 'proactive_scheduled';

// Ghost Writer Config (one per community)
export interface DbGhostWriterConfig {
  id: string;
  community_id: string;
  creator_id: string;
  persona_prompt: string;
  persona_answers: unknown[];
  data_collection_fields: unknown[];
  auto_reply_enabled: boolean;
  approval_mode: GhostWriterApprovalMode;
  post_schedule_description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Ghost Writer Schedules
export interface DbGhostWriterSchedule {
  id: string;
  community_id: string;
  config_id: string;
  schedule_cron: string;
  channel_id: string;
  post_type: GhostWriterPostType;
  topic_hints: string;
  is_active: boolean;
  last_run_at: string | null;
  created_at: string;
}

// Ghost Writer Drafts
export interface DbGhostWriterDraft {
  id: string;
  community_id: string;
  schedule_id: string | null;
  content: string;
  image_url: string | null;
  channel_id: string;
  status: GhostWriterDraftStatus;
  created_at: string;
  published_at: string | null;
}

// Student Data Points
export interface DbStudentDataPoint {
  id: string;
  student_id: string;
  community_id: string;
  field_name: string;
  value: string;
  collected_at: string;
  source_conversation_id: string | null;
  created_at: string;
}

// Ghost Writer DM Log
export interface DbGhostWriterDmLog {
  id: string;
  community_id: string;
  student_id: string;
  conversation_id: string;
  trigger_type: GhostWriterDmTriggerType;
  message_content: string;
  data_extracted: Record<string, unknown> | null;
  created_at: string;
}
