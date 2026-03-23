// ============================================================================
// PLAN GATE COMPONENT
// A wrapper component for gating features based on plan access
// ============================================================================

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, Zap } from 'lucide-react';
import { usePlanLimits } from '../hooks/usePlanLimits';
import { UpgradePrompt } from './UpgradePrompt';
import type { UpgradeReason, PlanFeatures } from '../stripeTypes';

// ============================================================================
// TYPES
// ============================================================================

type GatedFeature = 'custom_branding' | 'white_label' | 'advanced_analytics' | 'api_access' | 'priority_support';

export interface PlanGateProps {
  /** The feature to check access for */
  feature: GatedFeature;
  /** Content to render if user has access */
  children: React.ReactNode;
  /** Fallback content to render if user doesn't have access (optional) */
  fallback?: React.ReactNode;
  /** Whether to show a locked badge/overlay instead of the fallback */
  showLockedOverlay?: boolean;
  /** Additional className for the wrapper */
  className?: string;
}

// ============================================================================
// FEATURE TO UPGRADE REASON MAP
// ============================================================================

const featureToReasonMap: Record<GatedFeature, UpgradeReason> = {
  custom_branding: 'custom_branding',
  white_label: 'white_label',
  advanced_analytics: 'advanced_analytics',
  api_access: 'api_access',
  priority_support: 'priority_support',
};

// ============================================================================
// FEATURE TO PLAN FEATURE MAP
// ============================================================================

const featureToPlanFeatureMap: Record<GatedFeature, keyof PlanFeatures> = {
  custom_branding: 'custom_branding',
  white_label: 'white_label',
  advanced_analytics: 'advanced_analytics',
  api_access: 'api_access',
  priority_support: 'priority_support',
};

// ============================================================================
// DEFAULT LOCKED FALLBACK
// ============================================================================

interface LockedFallbackProps {
  feature: GatedFeature;
  onUpgradeClick: () => void;
}

const LockedFallback: React.FC<LockedFallbackProps> = ({ feature, onUpgradeClick }) => {
  const { t } = useTranslation();

  const featureLabelKeys: Record<GatedFeature, string> = {
    custom_branding: 'billing.gate.features.customBranding',
    white_label: 'billing.gate.features.whiteLabel',
    advanced_analytics: 'billing.gate.features.advancedAnalytics',
    api_access: 'billing.gate.features.apiAccess',
    priority_support: 'billing.gate.features.prioritySupport',
  };

  return (
    <div className="bg-[#0A0A0A] border-2 border-dashed border-[#1F1F1F] rounded-xl p-6 text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 bg-[#1F1F1F] rounded-full mb-3">
        <Lock className="w-6 h-6 text-[#666666]" />
      </div>
      <h3 className="font-semibold text-[#A0A0A0] mb-1">
        {t(featureLabelKeys[feature])}
      </h3>
      <p className="text-sm text-[#666666] mb-4">
        {t('billing.gate.lockedMessage')}
      </p>
      <button
        onClick={onUpgradeClick}
        className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] text-sm font-medium rounded-lg hover:bg-[#E0E0E0] transition-colors"
      >
        <Zap size={16} />
        {t('billing.gate.unlockButton')}
      </button>
    </div>
  );
};

// ============================================================================
// LOCKED OVERLAY COMPONENT
// ============================================================================

interface LockedOverlayProps {
  children: React.ReactNode;
  feature: GatedFeature;
  onUpgradeClick: () => void;
}

const LockedOverlay: React.FC<LockedOverlayProps> = ({ children, feature, onUpgradeClick }) => {
  const { t } = useTranslation();

  const featureLabelKeys: Record<GatedFeature, string> = {
    custom_branding: 'billing.gate.features.customBranding',
    white_label: 'billing.gate.features.whiteLabel',
    advanced_analytics: 'billing.gate.features.advancedAnalytics',
    api_access: 'billing.gate.features.apiAccess',
    priority_support: 'billing.gate.features.prioritySupport',
  };

  return (
    <div className="relative">
      <div className="pointer-events-none select-none opacity-50 blur-[1px]">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-[#0A0A0A]/60 backdrop-blur-[2px] rounded-lg">
        <div className="text-center p-4">
          <div className="inline-flex items-center justify-center w-10 h-10 bg-[#1F1F1F] rounded-full mb-2">
            <Lock className="w-5 h-5 text-[#FAFAFA]" />
          </div>
          <p className="text-sm font-medium text-[#A0A0A0] mb-2">
            {t('billing.gate.lockedLabel', { feature: t(featureLabelKeys[feature]) })}
          </p>
          <button
            onClick={onUpgradeClick}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] text-xs font-medium rounded-lg hover:bg-[#E0E0E0] transition-colors"
          >
            <Zap size={12} />
            {t('billing.gate.upgradeButtonShort')}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const PlanGate: React.FC<PlanGateProps> = ({
  feature,
  children,
  fallback,
  showLockedOverlay = false,
  className,
}) => {
  const { checkFeature, currentTier, loading } = usePlanLimits();
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  // Check if user has access to the feature
  const hasAccess = checkFeature(featureToPlanFeatureMap[feature]);
  const upgradeReason = featureToReasonMap[feature];

  // While loading, show children with reduced opacity
  if (loading) {
    return (
      <div className={`opacity-50 ${className || ''}`}>
        {children}
      </div>
    );
  }

  // User has access - render children
  if (hasAccess) {
    return <div className={className}>{children}</div>;
  }

  // User doesn't have access
  const handleUpgradeClick = () => {
    setShowUpgradePrompt(true);
  };

  return (
    <div className={className}>
      {showLockedOverlay ? (
        <LockedOverlay feature={feature} onUpgradeClick={handleUpgradeClick}>
          {children}
        </LockedOverlay>
      ) : (
        fallback || <LockedFallback feature={feature} onUpgradeClick={handleUpgradeClick} />
      )}

      {showUpgradePrompt && (
        <UpgradePrompt
          reason={upgradeReason}
          onClose={() => setShowUpgradePrompt(false)}
          currentTier={currentTier}
        />
      )}
    </div>
  );
};

export default PlanGate;
