import React, { useCallback, useRef } from 'react';

interface FocalPointPickerProps {
  imageUrl: string;
  focalX: number;
  focalY: number;
  onChange: (x: number, y: number) => void;
}

const FocalPointPicker: React.FC<FocalPointPickerProps> = ({
  imageUrl,
  focalX,
  focalY,
  onChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

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
    <div className="space-y-2">
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
      <p className="text-xs text-[#A0A0A0]">
        Кликнете върху снимката, за да изберете фокусна точка
      </p>
    </div>
  );
};

export default FocalPointPicker;
