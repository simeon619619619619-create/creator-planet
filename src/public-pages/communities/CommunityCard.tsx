import React from 'react';
import { useTranslation } from 'react-i18next';
import { Users, ArrowRight, Gift, CreditCard, Repeat } from 'lucide-react';
import type { CommunityListItem } from '../../core/types';

interface CommunityCardProps {
  community: CommunityListItem;
  onClick?: () => void;
}

export const CommunityCard: React.FC<CommunityCardProps> = ({ community, onClick }) => {
  const { t } = useTranslation();
  const placeholderImage = `https://ui-avatars.com/api/?name=${encodeURIComponent(community.name)}&background=1F1F1F&color=FAFAFA&size=400`;

  const isFree = community.pricing_type === 'free' || community.price_cents === 0;
  const isMonthly = community.pricing_type === 'monthly';
  const priceDisplay = isFree
    ? t('publicCommunities.card.price.free')
    : `€${(community.price_cents / 100).toFixed(2)}${isMonthly ? t('publicCommunities.card.price.perMonth') : ''}`;

  return (
    <button
      onClick={onClick}
      className="group block w-full text-left bg-[#0A0A0A] rounded-xl border border-[#1F1F1F] overflow-hidden hover:border-[#333333] hover:bg-[#151515] transition-all duration-150"
    >
      {/* Thumbnail */}
      <div className="aspect-[4/3] relative overflow-hidden">
        <img
          src={community.thumbnail_url || placeholderImage}
          alt={community.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          style={{ objectPosition: `${community.thumbnail_focal_x != null ? community.thumbnail_focal_x * 100 : 50}% ${community.thumbnail_focal_y != null ? community.thumbnail_focal_y * 100 : 50}%` }}
        />
        <div className="absolute inset-0 bg-black/50" />

        {/* Member Count Badge */}
        <div className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 bg-black/40 backdrop-blur-sm rounded-full text-white text-xs font-medium">
          <Users className="w-3.5 h-3.5" />
          {t('publicCommunities.card.member', { count: community.memberCount })}
        </div>

        {/* Pricing Badge */}
        <div className={`absolute top-3 right-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
          isFree
            ? 'bg-[#22C55E] text-white'
            : 'bg-white text-black'
        }`}>
          {isFree ? (
            <Gift className="w-3 h-3" />
          ) : isMonthly ? (
            <Repeat className="w-3 h-3" />
          ) : (
            <CreditCard className="w-3 h-3" />
          )}
          {priceDisplay}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-[var(--fc-text,#FAFAFA)] group-hover:text-white transition-colors duration-150 line-clamp-1">
          {community.name}
        </h3>

        {community.description && (
          <p className="mt-1 text-sm text-[var(--fc-muted,#A0A0A0)] line-clamp-2">
            {community.description}
          </p>
        )}

        {/* Creator */}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              src={community.creator.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(community.creator.full_name)}&background=1F1F1F&color=FAFAFA&size=32`}
              alt={community.creator.full_name}
              className="w-6 h-6 rounded-full object-cover"
            />
            <span className="text-xs text-[var(--fc-muted,#666666)]">
              {t('publicCommunities.card.creator.by')} <span className="font-medium text-[var(--fc-muted,#A0A0A0)]">{community.creator.full_name}</span>
            </span>
          </div>

          <ArrowRight className="w-4 h-4 text-[var(--fc-muted,#666666)] group-hover:text-[var(--fc-text,#FAFAFA)] group-hover:translate-x-1 transition-all duration-150" />
        </div>
      </div>
    </button>
  );
};
