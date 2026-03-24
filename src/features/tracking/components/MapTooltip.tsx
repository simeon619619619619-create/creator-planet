import type { TrackingLocation } from '../../../data/tracking-locations';

interface MapTooltipProps {
  location: TrackingLocation
  position: { x: number; y: number }
  t: (key: string) => string
}

const MapTooltip: React.FC<MapTooltipProps> = ({ location, position, t }) => {
  return (
    <div
      className="absolute z-50 pointer-events-none"
      style={{
        left: position.x,
        top: position.y - 12,
        transform: 'translate(-50%, -100%)',
      }}
    >
      <div className="bg-[var(--fc-section-hover,#151515)] border border-[#333333] rounded-lg px-3 py-2 text-sm shadow-xl">
        <div className="font-semibold text-[var(--fc-section-text,#FAFAFA)]">{location.city}</div>
        <div className="text-[var(--fc-section-muted,#A0A0A0)] text-xs">{location.country}</div>
        <div className="text-[#22C55E] text-xs font-medium mt-1">
          {location.users} {t('tracking.usersInCity')}
        </div>
        {/* Triangle pointer */}
        <div
          className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-3 h-3 bg-[var(--fc-section-hover,#151515)] border-r border-b border-[#333333] rotate-45"
        />
      </div>
    </div>
  );
};

export default MapTooltip;
