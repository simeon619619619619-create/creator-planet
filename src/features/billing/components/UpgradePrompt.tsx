// ============================================================================
// UPGRADE PROMPT COMPONENT
// Modal/popup component that shows when users hit plan limits
// ============================================================================

import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, Zap, ArrowRight, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  UpgradeReason,
  PlanTier,
  UPGRADE_MESSAGES,
  PLAN_LIMITS,
} from '../stripeTypes';

// ============================================================================
// TYPES
// ============================================================================

export interface UpgradePromptProps {
  /** The reason for showing the upgrade prompt */
  reason: UpgradeReason;
  /** Callback when the modal is closed */
  onClose: () => void;
  /** Callback when user clicks upgrade (optional, defaults to navigation) */
  onUpgrade?: () => void;
  /** Current usage info (for limit-based prompts) */
  currentUsage?: {
    current: number;
    max: number;
  };
  /** Current plan tier */
  currentTier?: PlanTier;
}

// ============================================================================
// HELPER: Get recommended plan for upgrade
// ============================================================================

function getRecommendedPlan(reason: UpgradeReason, currentTier: PlanTier): PlanTier {
  // Features only available on Scale
  const scaleOnlyFeatures: UpgradeReason[] = ['white_label', 'api_access'];

  if (scaleOnlyFeatures.includes(reason)) {
    return 'scale';
  }

  // For limits and pro features, recommend Pro if on Starter, Scale if on Pro
  if (currentTier === 'starter') {
    return 'pro';
  }

  return 'scale';
}

// ============================================================================
// HELPER: Get plan display name
// ============================================================================

function getPlanDisplayName(tier: PlanTier, t: (key: string) => string): string {
  return t(`billing.upgradePrompt.planNames.${tier}`);
}

// ============================================================================
// HELPER: Get limit info for plan
// ============================================================================

function getLimitForPlan(tier: PlanTier, limitType: 'students' | 'courses' | 'communities', t: (key: string) => string): string {
  const limits = PLAN_LIMITS[tier];
  const limitMap: Record<string, number> = {
    students: limits.max_students,
    courses: limits.max_courses,
    communities: limits.max_communities,
  };
  const limit = limitMap[limitType];
  return limit === -1 ? t('billing.upgradePrompt.limits.unlimited') : String(limit);
}

// ============================================================================
// COMPONENT
// ============================================================================

export const UpgradePrompt: React.FC<UpgradePromptProps> = ({
  reason,
  onClose,
  onUpgrade,
  currentUsage,
  currentTier = 'starter',
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const message = UPGRADE_MESSAGES[reason];
  const recommendedPlan = getRecommendedPlan(reason, currentTier);

  // Determine if this is a limit-based reason
  const isLimitBased = ['course_limit', 'student_limit', 'community_limit'].includes(reason);
  const limitType = isLimitBased
    ? reason.replace('_limit', 's') as 'students' | 'courses' | 'communities'
    : null;

  const handleUpgrade = () => {
    if (onUpgrade) {
      onUpgrade();
    } else {
      // Navigate to pricing page
      navigate('/pricing');
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#0A0A0A] rounded-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-[#151515] p-6 text-[#FAFAFA] relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 rounded-full hover:bg-[#0A0A0A]/20 transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>

          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-[#0A0A0A]/20 rounded-lg">
              {isLimitBased ? <Lock size={24} /> : <Zap size={24} />}
            </div>
            <h2 className="text-xl font-bold">{message.title}</h2>
          </div>

          {currentUsage && (
            <div className="bg-[#0A0A0A]/10 rounded-lg p-3 mt-3">
              <div className="flex justify-between items-center text-sm">
                <span>{t('billing.upgradePrompt.currentUsage')}</span>
                <span className="font-semibold">
                  {currentUsage.current} / {currentUsage.max}
                </span>
              </div>
              <div className="mt-2 h-2 bg-[#0A0A0A]/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#0A0A0A] rounded-full transition-all"
                  style={{ width: `${Math.min((currentUsage.current / currentUsage.max) * 100, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="text-[#A0A0A0] mb-6">{message.description}</p>

          {/* Recommendation */}
          <div className="bg-[#0A0A0A] rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2 text-sm text-[#666666] mb-2">
              <Zap size={14} className="text-[#EAB308]" />
              <span>{t('billing.upgradePrompt.recommendedUpgrade')}</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-[#FAFAFA]">
                  {getPlanDisplayName(recommendedPlan, t)}{t('billing.upgradePrompt.planSuffix')}
                </h3>
                {limitType && (
                  <p className="text-sm text-[#666666]">
                    {getLimitForPlan(recommendedPlan, limitType, t)}{t(`billing.upgradePrompt.limits.${limitType}`)}
                  </p>
                )}
              </div>
              <ArrowRight size={20} className="text-[#666666]" />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-[#1F1F1F] rounded-xl font-medium text-[#A0A0A0] hover:bg-[#0A0A0A] transition-colors"
            >
              {t('billing.upgradePrompt.maybeLaterButton')}
            </button>
            <button
              onClick={handleUpgrade}
              className="flex-1 px-4 py-3 bg-white text-black rounded-xl font-medium hover:bg-[#E0E0E0] transition-colors flex items-center justify-center gap-2"
            >
              <Zap size={18} />
              {t('billing.upgradePrompt.upgradeNowButton')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpgradePrompt;
