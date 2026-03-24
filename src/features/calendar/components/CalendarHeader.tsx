import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, List, CalendarDays } from 'lucide-react';

export type CalendarViewMode = 'list' | 'expanded';

interface CalendarHeaderProps {
  currentDate: Date;
  viewMode: CalendarViewMode;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  onViewModeChange: (mode: CalendarViewMode) => void;
}

const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  currentDate,
  viewMode,
  onPreviousMonth,
  onNextMonth,
  onToday,
  onViewModeChange,
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Format time as "3:14pm"
  const formattedTime = currentTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).toLowerCase();

  // Get timezone name (e.g., "Sofia time")
  const timezoneName = new Intl.DateTimeFormat('en-US', { timeZoneName: 'long' })
    .formatToParts(currentTime)
    .find(part => part.type === 'timeZoneName')?.value || '';

  // Simplify timezone name (extract city if possible)
  const simplifiedTimezone = timezoneName.includes('/')
    ? timezoneName.split('/').pop()?.replace(/_/g, ' ') + ' time'
    : timezoneName.split(' ').slice(-2).join(' ') || 'local time';

  return (
    <div className="flex items-center justify-between mb-6">
      {/* Left: Today button */}
      <button
        onClick={onToday}
        className="px-4 py-2 text-sm font-medium text-[var(--fc-section-text,#FAFAFA)] bg-[var(--fc-section,#0A0A0A)] border border-[var(--fc-section-border,#1F1F1F)] rounded-full hover:bg-[var(--fc-section-hover,#151515)] hover:border-[#333333] transition-colors"
      >
        Today
      </button>

      {/* Center: Month navigation and time */}
      <div className="flex flex-col items-center">
        <div className="flex items-center gap-4">
          <button
            onClick={onPreviousMonth}
            className="p-2 text-[var(--fc-section-muted,#666666)] hover:text-[var(--fc-section-muted,#A0A0A0)] hover:bg-[var(--fc-section-hover,#1F1F1F)] rounded-full transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-lg font-semibold text-[var(--fc-section-text,#FAFAFA)] min-w-[180px] text-center">
            {monthName}
          </h2>
          <button
            onClick={onNextMonth}
            className="p-2 text-[var(--fc-section-muted,#666666)] hover:text-[var(--fc-section-muted,#A0A0A0)] hover:bg-[var(--fc-section-hover,#1F1F1F)] rounded-full transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>
        <span className="text-sm text-[var(--fc-section-muted,#666666)] mt-1">
          {formattedTime} {simplifiedTimezone}
        </span>
      </div>

      {/* Right: View toggle */}
      <div className="flex items-center bg-[var(--fc-section-hover,#1F1F1F)] rounded-lg p-1">
        <button
          onClick={() => onViewModeChange('list')}
          className={`p-2 rounded-md transition-colors ${
            viewMode === 'list'
              ? 'bg-[var(--fc-section,#0A0A0A)] text-[var(--fc-section-text,#FAFAFA)]'
              : 'text-[var(--fc-section-muted,#666666)] hover:text-[var(--fc-section-muted,#A0A0A0)]'
          }`}
          title="List view"
        >
          <List size={18} />
        </button>
        <button
          onClick={() => onViewModeChange('expanded')}
          className={`p-2 rounded-md transition-colors ${
            viewMode === 'expanded'
              ? 'bg-[var(--fc-section,#0A0A0A)] text-[var(--fc-section-text,#FAFAFA)]'
              : 'text-[var(--fc-section-muted,#666666)] hover:text-[var(--fc-section-muted,#A0A0A0)]'
          }`}
          title="Calendar view"
        >
          <CalendarDays size={18} />
        </button>
      </div>
    </div>
  );
};

export default CalendarHeader;
