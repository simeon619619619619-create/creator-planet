// =============================================================================
// Student Plus Service
// Phase 2: Student Monetization with Loyalty Points & Rewards
// =============================================================================

import { supabase } from '../../core/supabase/client';
import type {
  StudentSubscription,
  LoyaltyPointsBalance,
  LoyaltyPointTransaction,
  LoyaltyMilestone,
  MilestoneAchievement,
  Reward,
  RewardRedemption,
  CheckoutSessionResponse,
  PortalSessionResponse,
} from './studentPlusTypes';

export const studentPlusService = {
  // ===========================================================================
  // Subscription Management
  // ===========================================================================

  /**
   * Get the current user's Student Plus subscription
   */
  async getSubscription(): Promise<StudentSubscription | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('student_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // PGRST116 = no rows found, which is valid (user has no subscription)
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  /**
   * Check if the current user has an active Student Plus subscription
   */
  async isSubscribed(): Promise<boolean> {
    const sub = await this.getSubscription();
    return sub?.status === 'active' || sub?.status === 'trialing';
  },

  /**
   * Create a Stripe Checkout session for Student Plus subscription
   */
  async createCheckoutSession(
    successUrl: string,
    cancelUrl: string
  ): Promise<CheckoutSessionResponse> {
    const { data, error } = await supabase.functions.invoke('student-plus-checkout', {
      body: { successUrl, cancelUrl },
    });

    if (error) throw error;
    return data as CheckoutSessionResponse;
  },

  /**
   * Create a Stripe Customer Portal session for subscription management
   */
  async createPortalSession(returnUrl: string): Promise<PortalSessionResponse> {
    const { data, error } = await supabase.functions.invoke('student-plus-portal', {
      body: { returnUrl },
    });

    if (error) throw error;
    return data as PortalSessionResponse;
  },

  // ===========================================================================
  // Loyalty Points
  // ===========================================================================

  /**
   * Get the current user's points balance
   */
  async getPointsBalance(): Promise<LoyaltyPointsBalance> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Call the database function for accurate balance
    const { data: balance, error: balanceError } = await supabase
      .rpc('get_student_point_balance', { p_user_id: user.id });

    if (balanceError) throw balanceError;

    // Get totals from transactions
    const { data: transactions, error: txError } = await supabase
      .from('loyalty_points')
      .select('points, transaction_type')
      .eq('user_id', user.id);

    if (txError) throw txError;

    let totalEarned = 0;
    let totalSpent = 0;

    for (const tx of transactions || []) {
      if (tx.transaction_type === 'redemption' || tx.transaction_type === 'expiration') {
        totalSpent += Math.abs(tx.points);
      } else if (tx.points > 0) {
        totalEarned += tx.points;
      }
    }

    return {
      user_id: user.id,
      total_points: balance || 0,
      total_spent: totalSpent,
      total_earned: totalEarned,
    };
  },

  /**
   * Get the user's point transaction history
   */
  async getPointsHistory(limit = 20, offset = 0): Promise<LoyaltyPointTransaction[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('loyalty_points')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return data || [];
  },

  // ===========================================================================
  // Milestones
  // ===========================================================================

  /**
   * Get all active milestones
   */
  async getMilestones(): Promise<LoyaltyMilestone[]> {
    const { data, error } = await supabase
      .from('loyalty_milestones')
      .select('*')
      .eq('is_active', true)
      .order('months_required');

    if (error) throw error;
    return data || [];
  },

  /**
   * Get the current user's milestone achievements
   */
  async getMyAchievements(): Promise<MilestoneAchievement[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('student_milestone_achievements')
      .select('*, milestone:loyalty_milestones(*)')
      .eq('user_id', user.id)
      .order('achieved_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // ===========================================================================
  // Rewards
  // ===========================================================================

  /**
   * Get all available rewards (excludes milestone-only rewards)
   */
  async getAvailableRewards(): Promise<Reward[]> {
    const { data, error } = await supabase
      .from('rewards')
      .select('*')
      .eq('is_active', true)
      .eq('is_milestone_reward', false)
      .order('display_order');

    if (error) throw error;
    return data || [];
  },

  /**
   * Get all rewards including milestone rewards
   */
  async getAllRewards(): Promise<Reward[]> {
    const { data, error } = await supabase
      .from('rewards')
      .select('*')
      .eq('is_active', true)
      .order('display_order');

    if (error) throw error;
    return data || [];
  },

  /**
   * Redeem a reward using points
   */
  async redeemReward(rewardId: string): Promise<RewardRedemption> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Call the database function to handle redemption
    const { data: redemptionId, error: redeemError } = await supabase
      .rpc('redeem_reward', {
        p_user_id: user.id,
        p_reward_id: rewardId,
      });

    if (redeemError) throw redeemError;

    // Fetch the created redemption
    const { data: redemption, error: fetchError } = await supabase
      .from('reward_redemptions')
      .select('*, reward:rewards(*)')
      .eq('id', redemptionId)
      .single();

    if (fetchError) throw fetchError;
    return redemption;
  },

  /**
   * Get the current user's redemptions
   */
  async getMyRedemptions(): Promise<RewardRedemption[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('reward_redemptions')
      .select('*, reward:rewards(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Get active redemptions (vouchers, priority support, etc.)
   */
  async getActiveRedemptions(): Promise<RewardRedemption[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('reward_redemptions')
      .select('*, reward:rewards(*)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Validate a voucher code
   */
  async validateVoucherCode(code: string): Promise<RewardRedemption | null> {
    const { data, error } = await supabase
      .from('reward_redemptions')
      .select('*')
      .eq('voucher_code', code)
      .eq('status', 'active')
      .single();

    if (error) return null;

    // Check if voucher is still valid
    if (data.valid_until && new Date(data.valid_until) < new Date()) {
      return null;
    }

    return data;
  },

  /**
   * Mark a voucher as used
   */
  async useVoucher(redemptionId: string, usedForReference: string): Promise<void> {
    const { error } = await supabase
      .from('reward_redemptions')
      .update({
        status: 'used',
        used_at: new Date().toISOString(),
        used_for_reference: usedForReference,
      })
      .eq('id', redemptionId);

    if (error) throw error;
  },

  // ===========================================================================
  // Priority Support Check
  // ===========================================================================

  /**
   * Check if the current user has active priority support
   */
  async hasPrioritySupport(): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase
      .from('reward_redemptions')
      .select('id')
      .eq('user_id', user.id)
      .eq('reward_type', 'priority_support')
      .eq('status', 'active')
      .gt('valid_until', new Date().toISOString())
      .limit(1)
      .single();

    if (error) return false;
    return !!data;
  },
};

export default studentPlusService;
