import React, { useState } from 'react';
import { Plus, Clock, Users, User, Video, Download, MapPin } from 'lucide-react';
import CalendarHeader, { CalendarViewMode } from './CalendarHeader';
import DayCell from './DayCell';
import { EventWithDetails, getMonthDays, getEventsForDay, formatEventTime, downloadICS, getEventLocationUrl } from '../eventService';

interface DayInfo {
  day: number;
  isCurrentMonth: boolean;
}

interface ExpandedMonthViewProps {
  events: EventWithDetails[];
  currentDate: Date;
  viewMode: CalendarViewMode;
  onDateChange: (date: Date) => void;
  onViewModeChange: (mode: CalendarViewMode) => void;
  onEventClick: (event: EventWithDetails) => void;
  onCreateEvent: (date: Date) => void;
  onRsvp: (eventId: string, isAttending: boolean) => void;
  isCreator: boolean;
}

const ExpandedMonthView: React.FC<ExpandedMonthViewProps> = ({
  events,
  currentDate,
  viewMode,
  onDateChange,
  onViewModeChange,
  onEventClick,
  onCreateEvent,
  onRsvp,
  isCreator,
}) => {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const today = new Date();
  const monthDays = getMonthDays(currentDate.getFullYear(), currentDate.getMonth());

  // Week days starting from Monday (like Skool)
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Reorder monthDays to start from Monday
  // getMonthDays returns Sunday-first, we need Monday-first
  const reorderedDays: DayInfo[] = [];
  for (let i = 0; i < monthDays.length; i += 7) {
    const week = monthDays.slice(i, i + 7);
    // Move Sunday to end: [Sun, Mon, Tue, Wed, Thu, Fri, Sat] -> [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
    reorderedDays.push(...week.slice(1), week[0]);
  }

  const goToPreviousMonth = () => {
    onDateChange(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    setSelectedDay(null);
  };

  const goToNextMonth = () => {
    onDateChange(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    setSelectedDay(null);
  };

  const goToToday = () => {
    onDateChange(new Date());
    setSelectedDay(today.getDate());
  };

  const handleDayClick = (day: number) => {
    setSelectedDay(selectedDay === day ? null : day);
  };

  const handleQuickCreate = (day: number) => {
    const createDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    onCreateEvent(createDate);
  };

  const selectedDayEvents = selectedDay
    ? getEventsForDay(events, currentDate.getFullYear(), currentDate.getMonth(), selectedDay)
    : [];

  const selectedDayDate = selectedDay
    ? new Date(currentDate.getFullYear(), currentDate.getMonth(), selectedDay)
    : null;

  const formatFullDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-100">
        <CalendarHeader
          currentDate={currentDate}
          viewMode={viewMode}
          onPreviousMonth={goToPreviousMonth}
          onNextMonth={goToNextMonth}
          onToday={goToToday}
          onViewModeChange={onViewModeChange}
        />
      </div>

      {/* Week day headers */}
      <div className="grid grid-cols-7 border-b border-slate-200">
        {weekDays.map((day) => (
          <div
            key={day}
            className="py-3 text-center text-sm font-medium text-slate-600 border-r border-slate-200 last:border-r-0"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {reorderedDays.slice(0, 42).map((dayInfo, index) => {
          const isToday =
            dayInfo.isCurrentMonth &&
            dayInfo.day === today.getDate() &&
            currentDate.getMonth() === today.getMonth() &&
            currentDate.getFullYear() === today.getFullYear();

          const dayEvents = dayInfo.isCurrentMonth
            ? getEventsForDay(events, currentDate.getFullYear(), currentDate.getMonth(), dayInfo.day)
            : [];

          return (
            <DayCell
              key={index}
              day={dayInfo.day}
              isCurrentMonth={dayInfo.isCurrentMonth}
              isToday={isToday}
              isSelected={selectedDay === dayInfo.day && dayInfo.isCurrentMonth}
              events={dayEvents}
              onDayClick={() => dayInfo.isCurrentMonth && handleDayClick(dayInfo.day)}
              onEventClick={onEventClick}
              onEmptyClick={isCreator ? () => handleQuickCreate(dayInfo.day) : undefined}
              isCreator={isCreator}
            />
          );
        })}
      </div>

      {/* Expandable day detail panel */}
      {selectedDay && selectedDayDate && (
        <div className="border-t border-slate-200 p-6 bg-slate-50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">
              {formatFullDate(selectedDayDate)}
            </h3>
            {isCreator && (
              <button
                onClick={() => handleQuickCreate(selectedDay)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Plus size={16} />
                Create Event
              </button>
            )}
          </div>

          {selectedDayEvents.length > 0 ? (
            <div className="space-y-3">
              {selectedDayEvents.map((event) => {
                const timeInfo = formatEventTime(event.start_time, event.end_time);
                const isAttending = event.user_status === 'attending';

                return (
                  <div
                    key={event.id}
                    className="bg-white rounded-lg p-4 border border-slate-200 flex flex-col sm:flex-row sm:items-center gap-4"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700">
                          {event.event_type.toUpperCase().replace('_', ' ')}
                        </span>
                      </div>
                      <h4 className="font-semibold text-slate-900">{event.title}</h4>
                      {event.description && (
                        <p className="text-sm text-slate-500 mt-1 line-clamp-2">{event.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                        <div className="flex items-center gap-1">
                          <Clock size={14} />
                          {timeInfo}
                        </div>
                        {event.event_type === 'one_on_one' && event.attendee ? (
                          <div className="flex items-center gap-1">
                            <User size={14} />
                            with {event.attendee.full_name}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Users size={14} />
                            {event.attendee_count} Attending
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {(() => {
                        const locationUrl = getEventLocationUrl(event);
                        const isInPerson = event.location_type === 'in_person';
                        if (locationUrl) {
                          return (
                            <a
                              href={locationUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
                            >
                              {isInPerson ? <MapPin size={14} /> : <Video size={14} />}
                              {isInPerson ? 'Location' : 'Join'}
                            </a>
                          );
                        }
                        return null;
                      })()}
                      <button
                        onClick={() => downloadICS(event)}
                        className="p-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
                        title="Add to Calendar"
                      >
                        <Download size={14} />
                      </button>
                      {!isCreator && event.event_type !== 'one_on_one' && (
                        <button
                          onClick={() => onRsvp(event.id, isAttending)}
                          className={`px-3 py-2 border rounded-lg text-sm font-medium ${
                            isAttending
                              ? 'border-rose-200 text-rose-600 hover:bg-rose-50'
                              : 'border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {isAttending ? 'Cancel' : 'RSVP'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-slate-500">No events scheduled for this day.</p>
              {isCreator && (
                <button
                  onClick={() => handleQuickCreate(selectedDay)}
                  className="mt-3 text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                >
                  + Create an event
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ExpandedMonthView;
