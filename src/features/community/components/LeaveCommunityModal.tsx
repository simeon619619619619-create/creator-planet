import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Loader2, AlertTriangle, ExternalLink, LogOut } from 'lucide-react';
import { leaveCommunity, getMembershipDetails, MembershipDetails } from '../communityService';
import { getCommunityPortalUrl } from '../communityPaymentService';

interface LeaveCommunityModalProps {
  isOpen: boolean;
  onClose: () => void;
  communityId: string;
  communityName: string;
  userId: string;
  onLeaveSuccess: () => void;
}

const LeaveCommunityModal: React.FC<LeaveCommunityModalProps> = ({
  isOpen,
  onClose,
  communityId,
  communityName,
  userId,
  onLeaveSuccess,
}) => {
  const { t } = useTranslation();
  const [membershipDetails, setMembershipDetails] = useState<MembershipDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load membership details when modal opens
  useEffect(() => {
    if (isOpen && communityId && userId) {
      loadMembershipDetails();
    }
  }, [isOpen, communityId, userId]);

  const loadMembershipDetails = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const details = await getMembershipDetails(userId, communityId);
      setMembershipDetails(details);
    } catch (err) {
      setError(t('community.leave.errorLoading'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeave = async () => {
    setIsLeaving(true);
    setError(null);

    try {
      const result = await leaveCommunity(userId, communityId);

      if (result.requiresSubscriptionCancel) {
        // Redirect to Stripe portal to cancel subscription
        setError(t('community.leave.cancelSubscriptionFirst'));
        setIsLeaving(false);
        return;
      }

      if (!result.success) {
        setError(result.error || t('community.leave.errorLeaving'));
        setIsLeaving(false);
        return;
      }

      // Success - close modal and notify parent
      onLeaveSuccess();
      onClose();
    } catch (err) {
      setError(t('community.leave.errorLeaving'));
      setIsLeaving(false);
    }
  };

  const handleManageSubscription = async () => {
    setIsOpeningPortal(true);
    setError(null);

    try {
      const result = await getCommunityPortalUrl(communityId);

      if (result.success && result.portalUrl) {
        window.location.href = result.portalUrl;
      } else {
        setError(result.error || t('community.leave.errorPortal'));
        setIsOpeningPortal(false);
      }
    } catch (err) {
      setError(t('community.leave.errorPortal'));
      setIsOpeningPortal(false);
    }
  };

  if (!isOpen) return null;

  const hasActiveSubscription =
    membershipDetails?.stripe_subscription_id && membershipDetails?.payment_status === 'paid';
  const isPaidCommunity = membershipDetails?.pricing_type !== 'free';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative bg-[#0A0A0A] rounded-2xl border border-[#1F1F1F] max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#1F1F1F]">
          <div className="flex items-center gap-2 text-[#EF4444]">
            <LogOut size={20} />
            <h2 className="text-lg font-semibold">{t('community.leave.title')}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#666666] hover:text-[#FAFAFA] hover:bg-[#151515] rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 text-[#FAFAFA] animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Warning message */}
              <div className="bg-[#EAB308]/5 border border-[#EAB308]/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-[#EAB308] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[#FAFAFA] font-medium">
                      {t('community.leave.warningTitle')}
                    </p>
                    <p className="text-[#A0A0A0] text-sm mt-1">
                      {t('community.leave.warningMessage', { community: communityName })}
                    </p>
                  </div>
                </div>
              </div>

              {/* What will happen */}
              <div className="text-sm text-[#A0A0A0] space-y-2">
                <p className="font-medium text-[#FAFAFA]">{t('community.leave.whatHappens')}</p>
                <ul className="list-disc list-inside space-y-1 text-[#A0A0A0]">
                  <li>{t('community.leave.loseAccess')}</li>
                  <li>{t('community.leave.pointsLost')}</li>
                  <li>{t('community.leave.postsRemain')}</li>
                  {isPaidCommunity && <li>{t('community.leave.noRefund')}</li>}
                </ul>
              </div>

              {/* Active subscription warning */}
              {hasActiveSubscription && (
                <div className="bg-[#151515] border border-[#1F1F1F] rounded-lg p-4">
                  <p className="text-[#FAFAFA] font-medium mb-2">
                    {t('community.leave.activeSubscription')}
                  </p>
                  <p className="text-[#A0A0A0] text-sm mb-3">
                    {t('community.leave.cancelFirst')}
                  </p>
                  <button
                    onClick={handleManageSubscription}
                    disabled={isOpeningPortal}
                    className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#E0E0E0] disabled:opacity-50"
                  >
                    {isOpeningPortal ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ExternalLink size={16} />
                    )}
                    {t('community.leave.manageSubscription')}
                  </button>
                </div>
              )}

              {/* Error message */}
              {error && (
                <div className="bg-[#EF4444]/5 border border-[#EF4444]/20 rounded-lg p-3">
                  <p className="text-[#EF4444] text-sm">{error}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-[#1F1F1F] rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[#A0A0A0] hover:bg-[#151515] rounded-lg text-sm font-medium transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleLeave}
            disabled={isLeaving || isLoading || hasActiveSubscription}
            className="px-4 py-2 bg-[#EF4444] text-white rounded-lg text-sm font-medium hover:bg-[#DC2626] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLeaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('community.leave.leaving')}
              </>
            ) : (
              <>
                <LogOut size={16} />
                {t('community.leave.confirmButton')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LeaveCommunityModal;
