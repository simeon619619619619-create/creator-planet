import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getEventAttendeesWithAttendance, EventAttendeeWithProfile } from '../eventService';
import Avatar from '../../../shared/Avatar';

interface Props {
  eventId: string;
  attendeeCount: number;
}

const EventAttendeesPreview: React.FC<Props> = ({ eventId, attendeeCount }) => {
  const { t } = useTranslation();
  const [attendees, setAttendees] = useState<EventAttendeeWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (attendeeCount === 0) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const data = await getEventAttendeesWithAttendance(eventId);
      if (!cancelled) {
        setAttendees(data.filter(a => a.status === 'attending'));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [eventId, attendeeCount]);

  if (loading || attendeeCount === 0) return null;
  if (attendees.length === 0) return null;

  const MAX_AVATARS = 5;
  const visible = attendees.slice(0, MAX_AVATARS);
  const remaining = attendees.length - MAX_AVATARS;

  return (
    <div className="mt-3 pt-3 border-t border-[var(--fc-section-border,#1F1F1F)]">
      <button
        onClick={() => setExpanded(prev => !prev)}
        className="flex items-center gap-2 text-sm text-[var(--fc-section-muted,#A0A0A0)] hover:text-[var(--fc-section-text,#FAFAFA)] transition-colors w-full text-left"
      >
        <div className="flex -space-x-2">
          {visible.map(a => (
            <Avatar
              key={a.user_id}
              src={a.profile.avatar_url}
              name={a.profile.full_name}
              size="xs"
              className="ring-2 ring-[var(--fc-section,#0A0A0A)]"
            />
          ))}
          {remaining > 0 && (
            <div className="w-6 h-6 rounded-full bg-[var(--fc-section-hover,#1F1F1F)] flex items-center justify-center text-[10px] font-medium ring-2 ring-[var(--fc-section,#0A0A0A)]">
              +{remaining}
            </div>
          )}
        </div>
        <span>
          {t('calendar.attendeesPreview', { count: attendees.length })}
        </span>
        <svg
          className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto">
          {attendees.map(a => (
            <div key={a.user_id} className="flex items-center gap-2 py-1 px-1 rounded-lg">
              <Avatar
                src={a.profile.avatar_url}
                name={a.profile.full_name}
                size="xs"
              />
              <span className="text-sm text-[var(--fc-section-text,#FAFAFA)] truncate">
                {a.profile.full_name || a.profile.email}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EventAttendeesPreview;
