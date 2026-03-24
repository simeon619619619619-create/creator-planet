import React from 'react';
import { useTranslation } from 'react-i18next';
import type { TimeRange } from '../types';

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}

const ranges: { value: TimeRange; labelKey: string }[] = [
  { value: '7d', labelKey: 'admin.timeRange.7d' },
  { value: '30d', labelKey: 'admin.timeRange.30d' },
  { value: '90d', labelKey: 'admin.timeRange.90d' },
  { value: 'all', labelKey: 'admin.timeRange.all' },
];

const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({ value, onChange }) => {
  const { t } = useTranslation();

  return (
    <div className="inline-flex rounded-lg border border-[var(--fc-section-border,#1F1F1F)] bg-[var(--fc-section,#0A0A0A)] p-1">
      {ranges.map((range) => (
        <button
          key={range.value}
          onClick={() => onChange(range.value)}
          className={`
            px-3.5 py-1.5 text-sm font-medium rounded-md transition-colors
            ${value === range.value
              ? 'bg-[#FAFAFA] text-[#0A0A0A]'
              : 'text-[var(--fc-section-muted,#A0A0A0)] hover:text-[var(--fc-section-text,#FAFAFA)]'}
          `}
        >
          {t(range.labelKey)}
        </button>
      ))}
    </div>
  );
};

export default TimeRangeSelector;
