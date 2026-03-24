import React from 'react';
import { EventWithDetails } from '../eventService';

interface DayCellProps {
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  events: EventWithDetails[];
  onDayClick: () => void;
  onEventClick: (event: EventWithDetails) => void;
  onEmptyClick?: () => void; // For quick create
  isCreator: boolean;
}

const DayCell: React.FC<DayCellProps> = ({
  day,
  isCurrentMonth,
  isToday,
  isSelected,
  events,
  onDayClick,
  onEventClick,
  onEmptyClick,
  isCreator,
}) => {
  const MAX_VISIBLE_EVENTS = 3;
  const visibleEvents = events.slice(0, MAX_VISIBLE_EVENTS);
  const hiddenCount = events.length - MAX_VISIBLE_EVENTS;

  // Format time as "12pm" or "3pm"
  const formatEventTime = (dateString: string): string => {
    const date = new Date(dateString);
    const hours = date.getHours();
    const ampm = hours >= 12 ? 'pm' : 'am';
    const displayHour = hours % 12 || 12;
    return `${displayHour}${ampm}`;
  };

  const handleCellClick = (e: React.MouseEvent) => {
    // If clicking on the cell background (not an event), trigger quick create for creators
    if ((e.target as HTMLElement).closest('.event-item')) {
      return; // Let event click handler handle it
    }

    if (isCurrentMonth) {
      onDayClick();
      // If clicking on empty area and is creator, also trigger create
      if (isCreator && onEmptyClick && events.length === 0) {
        onEmptyClick();
      }
    }
  };

  const handleEventClick = (e: React.MouseEvent, event: EventWithDetails) => {
    e.stopPropagation();
    onEventClick(event);
  };

  return (
    <div
      onClick={handleCellClick}
      className={`
        min-h-[100px] p-2 border-b border-r border-[var(--fc-section-border,#1F1F1F)] transition-colors
        ${isCurrentMonth ? 'bg-[var(--fc-section,#0A0A0A)] cursor-pointer hover:bg-[var(--fc-section-hover,#151515)]' : 'bg-[var(--fc-section,#0A0A0A)]'}
        ${isSelected && isCurrentMonth ? 'bg-[var(--fc-section-hover,#1F1F1F)] hover:bg-[var(--fc-section-hover,#1F1F1F)]' : ''}
      `}
    >
      {/* Day number */}
      <div className="flex justify-start mb-1">
        <span
          className={`
            inline-flex items-center justify-center w-7 h-7 text-sm font-medium rounded-full
            ${!isCurrentMonth ? 'text-[var(--fc-section-muted,#666666)]' : 'text-[var(--fc-section-muted,#A0A0A0)]'}
            ${isToday ? 'bg-[var(--fc-text,white)] text-[var(--fc-surface,black)]' : ''}
          `}
        >
          {day}
        </span>
      </div>

      {/* Events */}
      <div className="space-y-1">
        {visibleEvents.map((event) => (
          <div
            key={event.id}
            onClick={(e) => handleEventClick(e, event)}
            className="event-item text-xs text-[var(--fc-section-text,#FAFAFA)] hover:text-[var(--fc-section-text,#FAFAFA)] cursor-pointer truncate"
          >
            <span className="font-medium">{formatEventTime(event.start_time)}</span>
            <span className="mx-1">-</span>
            <span className="truncate">{event.title}</span>
          </div>
        ))}
        {hiddenCount > 0 && (
          <div className="text-xs text-[var(--fc-section-muted,#666666)] font-medium">
            +{hiddenCount} more
          </div>
        )}
      </div>
    </div>
  );
};

export default DayCell;
