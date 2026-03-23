import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Hash, Eye, Crosshair } from 'lucide-react';

interface FocalPointPickerProps {
  imageUrl: string;
  focalX: number;
  focalY: number;
  communityName?: string;
  themeColor?: string;
  onChange: (x: number, y: number) => void;
}

const FocalPointPicker: React.FC<FocalPointPickerProps> = ({
  imageUrl,
  focalX,
  focalY,
  communityName,
  themeColor,
  onChange,
}) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'adjust' | 'preview'>('adjust');

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      onChange(
        Math.round(x * 100) / 100,
        Math.round(y * 100) / 100,
      );
    },
    [onChange],
  );

  const leftPercent = `${focalX * 100}%`;
  const topPercent = `${focalY * 100}%`;

  return (
    <div className="space-y-3">
      {/* Tab switcher */}
      <div className="flex gap-1 bg-[#0A0A0A] rounded-lg p-0.5 w-fit border border-[#1F1F1F]">
        <button
          onClick={() => setActiveTab('adjust')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            activeTab === 'adjust'
              ? 'bg-[#1F1F1F] text-[#FAFAFA]'
              : 'text-[#666666] hover:text-[#A0A0A0]'
          }`}
        >
          <Crosshair size={12} />
          {t('communityHub.pricing.focalPoint.adjust')}
        </button>
        <button
          onClick={() => setActiveTab('preview')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            activeTab === 'preview'
              ? 'bg-[#1F1F1F] text-[#FAFAFA]'
              : 'text-[#666666] hover:text-[#A0A0A0]'
          }`}
        >
          <Eye size={12} />
          {t('communityHub.pricing.focalPoint.preview')}
        </button>
      </div>

      {activeTab === 'adjust' ? (
        /* Focal Point Adjuster */
        <div>
          <div
            ref={containerRef}
            onClick={handleClick}
            className="relative aspect-video w-full max-w-[400px] rounded-lg overflow-hidden border border-[#1F1F1F] cursor-crosshair"
          >
            <img
              src={imageUrl}
              alt="Thumbnail preview"
              className="w-full h-full object-cover"
              draggable={false}
            />

            {/* Crosshair lines */}
            <div
              className="absolute top-0 bottom-0 w-px bg-white/30 pointer-events-none"
              style={{ left: leftPercent }}
            />
            <div
              className="absolute left-0 right-0 h-px bg-white/30 pointer-events-none"
              style={{ top: topPercent }}
            />

            {/* Focal point indicator */}
            <div
              className="absolute w-6 h-6 rounded-full border-2 border-white shadow-lg pointer-events-none"
              style={{
                left: leftPercent,
                top: topPercent,
                transform: 'translate(-50%, -50%)',
                backgroundColor: 'rgba(255, 255, 255, 0.25)',
                boxShadow: '0 0 0 1px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3)',
              }}
            />
          </div>
          <p className="text-xs text-[#A0A0A0] mt-2">
            {t('communityHub.pricing.focalPoint.clickHint')}
          </p>
        </div>
      ) : (
        /* Live Preview — simulates page with theme color background */
        <div
          className="w-full max-w-[500px] rounded-lg overflow-hidden border border-[#1F1F1F]"
          style={{ backgroundColor: themeColor || '#0A0A0A' }}
        >
          {/* Hero image */}
          <div className="relative h-36 overflow-hidden">
            <img
              src={imageUrl}
              alt="Preview"
              className="w-full h-full object-cover"
              draggable={false}
              style={{
                objectPosition: `${focalX * 100}% ${focalY * 100}%`,
              }}
            />
            <div className="absolute inset-0 bg-black/60" />

            {/* Hero content */}
            <div className="absolute inset-0 flex items-end">
              <div className="px-4 pb-4 w-full">
                <div className="text-white font-bold text-lg truncate">
                  {communityName || 'Community Name'}
                </div>
                <div className="mt-1.5 flex items-center gap-3 text-white/70 text-xs">
                  <span className="inline-flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    3 {t('publicCommunities.landing.stats.members', { defaultValue: 'члена' })}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Hash className="w-3 h-3" />
                    5 {t('publicCommunities.landing.stats.channels', { defaultValue: 'канала' })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Simulated page content area */}
          <div className="p-4 space-y-2">
            <div className="bg-black/40 rounded-lg border border-white/10 p-3">
              <div className="text-white/80 text-xs font-medium">{t('publicCommunities.landing.about.title', { defaultValue: 'За нас' })}</div>
              <div className="mt-1 h-2 w-3/4 bg-white/10 rounded" />
              <div className="mt-1 h-2 w-1/2 bg-white/10 rounded" />
            </div>
            <div className="bg-black/40 rounded-lg border border-white/10 p-3">
              <div className="text-white/80 text-xs font-medium">{t('publicCommunities.landing.channels.title', { defaultValue: 'Канали' })}</div>
              <div className="mt-1 h-2 w-2/3 bg-white/10 rounded" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FocalPointPicker;
