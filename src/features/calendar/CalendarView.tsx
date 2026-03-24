import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar as CalendarIcon, Clock, Users, Video, Plus, ChevronLeft, ChevronRight, Loader2, X, Download, User, Pencil, Trash2, AlertTriangle, List, CalendarDays, Building2, MapPin, UserCheck, History } from 'lucide-react';
import { useAuth } from '../../core/contexts/AuthContext';
// Team permission checks are handled by canManageCalendar computed value
import {
  getCreatorEvents,
  getUpcomingEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  rsvpToEvent,
  cancelRsvp,
  formatEventDate,
  formatEventTime,
  getMonthDays,
  getEventsForDay,
  EventWithDetails,
  downloadICS,
  getCommunityMembers,
  CommunityMember,
  updateEventAttendee,
  addOneOnOneAttendee,
  getEventLocationUrl,
} from './eventService';
import { getCreatorCommunities } from '../community/communityService';
import { EventType, LocationType, DbCommunity } from '../../core/supabase/database.types';
import ExpandedMonthView from './components/ExpandedMonthView';
import AttendanceModal from './components/AttendanceModal';
import { CalendarViewMode } from './components/CalendarHeader';

const CalendarView: React.FC = () => {
  const { t } = useTranslation();
  const { user, profile, role, teamMemberships } = useAuth();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventWithDetails[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<CalendarViewMode>('list');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventWithDetails | null>(null);
  const [updating, setUpdating] = useState(false);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [attendanceEvent, setAttendanceEvent] = useState<EventWithDetails | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Creator's communities for event assignment
  const [communities, setCommunities] = useState<DbCommunity[]>([]);
  const [communityMembers, setCommunityMembers] = useState<CommunityMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Form state
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDescription, setNewEventDescription] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventStartTime, setNewEventStartTime] = useState('');
  const [newEventEndTime, setNewEventEndTime] = useState('');
  const [newEventType, setNewEventType] = useState<EventType>('group');
  const [newEventLocationType, setNewEventLocationType] = useState<LocationType>('online');
  const [newEventLink, setNewEventLink] = useState('');
  const [newEventAddress, setNewEventAddress] = useState('');
  const [newEventCommunityId, setNewEventCommunityId] = useState<string>('');
  const [newEventAttendeeId, setNewEventAttendeeId] = useState<string>('');

  const isCreator = role === 'creator' || role === 'superadmin';

  // Team members (lecturers, assistants) can also manage calendar
  const isTeamMemberWithCalendarAccess = teamMemberships?.some(
    tm => tm.role === 'lecturer' || tm.role === 'assistant'
  ) ?? false;
  const canManageCalendar = isCreator || isTeamMemberWithCalendarAccess;

  useEffect(() => {
    if (profile?.id) {
      loadEvents();
    }
  }, [profile?.id, canManageCalendar, showHistory]);

  // Load communities when modal opens (for creators: their communities, for team members: their assigned communities)
  useEffect(() => {
    async function loadCommunities() {
      if (!user?.id || !canManageCalendar || (!showCreateModal && !editingEvent)) return;

      if (isCreator) {
        // Creators load their owned communities
        const data = await getCreatorCommunities(user.id);
        setCommunities(data);
      } else if (teamMemberships && teamMemberships.length > 0) {
        // Team members load their team communities
        // Only id and name are needed for the community dropdown
        const teamCommunities: Pick<DbCommunity, 'id' | 'name'>[] = teamMemberships
          .filter(tm => tm.role === 'lecturer' || tm.role === 'assistant')
          .map(tm => ({
            id: tm.communityId,
            name: tm.communityName,
          }));
        setCommunities(teamCommunities as DbCommunity[]);
      }
    }
    loadCommunities();
  }, [user?.id, canManageCalendar, isCreator, teamMemberships, showCreateModal, editingEvent]);

  // Load community members when a community is selected for 1:1 events
  useEffect(() => {
    async function loadMembers() {
      if (!newEventCommunityId || newEventType !== 'one_on_one') {
        setCommunityMembers([]);
        return;
      }
      setLoadingMembers(true);
      const members = await getCommunityMembers(newEventCommunityId);
      setCommunityMembers(members);
      setLoadingMembers(false);
    }
    loadMembers();
  }, [newEventCommunityId, newEventType]);

  const loadEvents = async () => {
    if (!profile?.id) return;

    setLoading(true);
    try {
      let data: EventWithDetails[];
      if (canManageCalendar) {
        // Creators and team members see events they created
        // Use profile.id because events.creator_id references profiles.id
        // Filter by upcoming or past based on showHistory toggle
        const filter = showHistory ? 'past' : 'upcoming';
        data = await getCreatorEvents(profile.id, filter);
      } else {
        // Students see only upcoming events where they're attendees
        // Use profile.id because event_attendees.user_id references profiles.id
        data = await getUpcomingEvents(profile.id);
      }
      setEvents(data);
    } catch {
      // Events load failed - empty state will be shown
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEvent = async () => {
    if (!profile?.id || !newEventTitle || !newEventDate || !newEventStartTime || !newEventEndTime) return;

    // For 1:1 events with a community, require selecting an attendee
    if (newEventType === 'one_on_one' && newEventCommunityId && !newEventAttendeeId) {
      return;
    }

    setCreating(true);
    try {
      const startDateTime = new Date(`${newEventDate}T${newEventStartTime}`);
      const endDateTime = new Date(`${newEventDate}T${newEventEndTime}`);

      // Use profile.id because events.creator_id references profiles.id
      const event = await createEvent(
        profile.id,
        newEventTitle,
        startDateTime,
        endDateTime,
        newEventType,
        newEventDescription || undefined,
        newEventLocationType === 'online' ? (newEventLink || undefined) : undefined,
        newEventType === 'one_on_one' ? 1 : undefined, // Max 1 attendee for 1:1
        newEventCommunityId || undefined,
        undefined, // groupId
        newEventLocationType,
        newEventLocationType === 'in_person' ? (newEventAddress || undefined) : undefined
      );

      if (event) {
        // Add the selected attendee for 1:1 events using SECURITY DEFINER function
        if (newEventType === 'one_on_one' && newEventAttendeeId && profile?.id) {
          const attendeeAdded = await addOneOnOneAttendee(event.id, newEventAttendeeId, profile.id);
          if (!attendeeAdded) {
            // Fallback to rsvpToEvent (standard RLS-based approach)
            const rsvpResult = await rsvpToEvent(newEventAttendeeId, event.id, 'attending');
            if (!rsvpResult) {
              // Final fallback to updateEventAttendee
              await updateEventAttendee(event.id, newEventAttendeeId);
            }
          }
        }

        await loadEvents();
        setShowCreateModal(false);
        resetForm();
      }
    } catch (error) {
      // Event creation failed - modal stays open for retry
    } finally {
      setCreating(false);
    }
  };

  const handleRsvp = async (eventId: string, isAttending: boolean) => {
    if (!profile?.id) return;

    try {
      // Use profile.id because event_attendees.user_id references profiles.id
      if (isAttending) {
        await cancelRsvp(profile.id, eventId);
      } else {
        await rsvpToEvent(profile.id, eventId, 'attending');
      }
      await loadEvents();
    } catch {
      // RSVP update failed silently - user can retry
    }
  };

  const handleEditEvent = async (event: EventWithDetails) => {
    // Parse the event data into form fields
    const startDate = new Date(event.start_time);
    const endDate = new Date(event.end_time);

    setNewEventTitle(event.title);
    setNewEventDescription(event.description || '');
    setNewEventDate(startDate.toISOString().split('T')[0]);
    setNewEventStartTime(startDate.toTimeString().slice(0, 5));
    setNewEventEndTime(endDate.toTimeString().slice(0, 5));
    setNewEventType(event.event_type);
    setNewEventLocationType(event.location_type || 'online');
    setNewEventLink(event.meeting_link || '');
    setNewEventAddress(event.address || '');
    setNewEventCommunityId(event.community_id || '');
    // Set the current attendee for 1:1 events
    setNewEventAttendeeId(event.attendee?.id || '');
    setEditingEvent(event);

    // Load community members for 1:1 events with a community
    if (event.event_type === 'one_on_one' && event.community_id) {
      setLoadingMembers(true);
      const members = await getCommunityMembers(event.community_id);
      setCommunityMembers(members);
      setLoadingMembers(false);
    }
  };

  const handleUpdateEvent = async () => {
    if (!editingEvent || !newEventTitle || !newEventDate || !newEventStartTime || !newEventEndTime) return;

    setUpdating(true);
    try {
      const startDateTime = new Date(`${newEventDate}T${newEventStartTime}`);
      const endDateTime = new Date(`${newEventDate}T${newEventEndTime}`);

      const success = await updateEvent(editingEvent.id, {
        title: newEventTitle,
        description: newEventDescription || undefined,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        location_type: newEventLocationType,
        meeting_link: newEventLocationType === 'online' ? (newEventLink || null) : null,
        address: newEventLocationType === 'in_person' ? (newEventAddress || null) : null,
      });

      // Update attendee for 1:1 events if changed
      if (editingEvent.event_type === 'one_on_one' && newEventAttendeeId && profile?.id) {
        const currentAttendeeId = editingEvent.attendee?.id || '';
        if (newEventAttendeeId !== currentAttendeeId) {
          await updateEventAttendee(editingEvent.id, newEventAttendeeId, profile.id);
        }
      }

      if (success) {
        await loadEvents();
        setEditingEvent(null);
        resetForm();
      }
    } catch {
      // Event update failed - modal stays open for retry
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    setDeleting(true);
    try {
      const success = await deleteEvent(eventId);
      if (success) {
        await loadEvents();
        setDeletingEventId(null);
      }
    } catch {
      // Delete failed - modal stays open for retry
    } finally {
      setDeleting(false);
    }
  };

  const resetForm = () => {
    setNewEventTitle('');
    setNewEventDescription('');
    setNewEventDate('');
    setNewEventStartTime('');
    setNewEventEndTime('');
    setNewEventType('group');
    setNewEventLocationType('online');
    setNewEventLink('');
    setNewEventAddress('');
    setNewEventCommunityId('');
    setNewEventAttendeeId('');
    setCommunityMembers([]);
  };

  // Quick create handler - opens modal with date pre-filled
  const handleQuickCreate = (date: Date) => {
    const formattedDate = date.toISOString().split('T')[0];
    setNewEventDate(formattedDate);
    setShowCreateModal(true);
  };

  // Handler for event click in expanded view
  const handleEventClick = (event: EventWithDetails) => {
    // Allow editing for creators (any event) or team members (their own events)
    if (isCreator || (isTeamMemberWithCalendarAccess && event.creator_id === profile?.id)) {
      handleEditEvent(event);
    }
    // For students, we could show a detail modal in the future
  };

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const monthDays = getMonthDays(currentDate.getFullYear(), currentDate.getMonth());
  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const today = new Date();

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--fc-section-text,#FAFAFA)]" />
      </div>
    );
  }

  return (
    <div className={viewMode === 'expanded' ? 'max-w-7xl mx-auto p-6 bg-[var(--fc-section,#0A0A0A)] min-h-screen' : 'max-w-5xl mx-auto p-6 bg-[var(--fc-section,#0A0A0A)] min-h-screen'}>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--fc-section-text,#FAFAFA)]">{t('calendar.title')}</h1>
          <p className="text-[var(--fc-section-muted,#666666)]">
            {canManageCalendar ? t('calendar.subtitleCreator') : t('calendar.subtitleStudent')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* History toggle for creators */}
          {canManageCalendar && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                showHistory
                  ? 'bg-[#333333] text-[var(--fc-section-text,#FAFAFA)]'
                  : 'bg-[var(--fc-section-hover,#1F1F1F)] text-[var(--fc-section-muted,#A0A0A0)] hover:bg-[var(--fc-section-hover,#1F1F1F)]'
              }`}
              title={showHistory ? t('calendar.showUpcomingTooltip') : t('calendar.showHistoryTooltip')}
            >
              <History size={16} />
              <span className="hidden sm:inline">
                {showHistory ? t('calendar.showUpcomingButton') : t('calendar.historyButton')}
              </span>
            </button>
          )}
          {/* View mode toggle */}
          <div className="flex items-center bg-[var(--fc-section-hover,#1F1F1F)] rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'list'
                  ? 'bg-[var(--fc-section,#0A0A0A)] text-[var(--fc-section-text,#FAFAFA)]'
                  : 'text-[var(--fc-section-muted,#666666)] hover:text-[var(--fc-section-muted,#A0A0A0)]'
              }`}
              title={t('calendar.listViewTooltip')}
            >
              <List size={18} />
            </button>
            <button
              onClick={() => setViewMode('expanded')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'expanded'
                  ? 'bg-[var(--fc-section,#0A0A0A)] text-[var(--fc-section-text,#FAFAFA)]'
                  : 'text-[var(--fc-section-muted,#666666)] hover:text-[var(--fc-section-muted,#A0A0A0)]'
              }`}
              title={t('calendar.calendarViewTooltip')}
            >
              <CalendarDays size={18} />
            </button>
          </div>
          {canManageCalendar && viewMode === 'list' && !showHistory && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[var(--fc-button-hover,#E0E0E0)] flex items-center gap-2"
            >
              <Plus size={16} /> {t('calendar.newEventButton')}
            </button>
          )}
        </div>
      </div>

      {/* Expanded Calendar View */}
      {viewMode === 'expanded' ? (
        <ExpandedMonthView
          events={events}
          currentDate={currentDate}
          viewMode={viewMode}
          onDateChange={setCurrentDate}
          onViewModeChange={setViewMode}
          onEventClick={handleEventClick}
          onCreateEvent={handleQuickCreate}
          onRsvp={handleRsvp}
          isCreator={canManageCalendar}
        />
      ) : (
      /* List View */
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="font-bold text-[var(--fc-section-text,#FAFAFA)] mb-4">
            {showHistory
              ? (events.length > 0 ? t('calendar.pastEventsHeading') : t('calendar.noPastEventsHeading'))
              : (events.length > 0 ? t('calendar.upcomingEventsHeading') : t('calendar.noUpcomingEventsHeading'))}
          </h2>
          {events.length > 0 ? (
            events.map(event => {
              const dateInfo = formatEventDate(event.start_time);
              const timeInfo = formatEventTime(event.start_time, event.end_time);
              const isAttending = event.user_status === 'attending';

              return (
                <div key={event.id} className="bg-[var(--fc-section,#0A0A0A)] p-6 rounded-xl border border-[var(--fc-section-border,#1F1F1F)] flex flex-col md:flex-row gap-6">
                  <div className="bg-[var(--fc-section-hover,#1F1F1F)] rounded-lg p-4 flex flex-col items-center justify-center min-w-[100px] text-[var(--fc-section-text,#FAFAFA)]">
                    <span className="text-xs font-bold uppercase">{dateInfo.month}</span>
                    <span className="text-2xl font-bold">{dateInfo.day}</span>
                  </div>

                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--fc-section-hover,#1F1F1F)] text-[var(--fc-section-muted,#A0A0A0)] mb-2">
                          {event.event_type.toUpperCase().replace('_', ' ')}
                        </span>
                        <h3 className="text-lg font-bold text-[var(--fc-section-text,#FAFAFA)]">{event.title}</h3>
                        {event.description && (
                          <p className="text-sm text-[var(--fc-section-muted,#666666)] mt-1">{event.description}</p>
                        )}
                      </div>
                      {/* Show edit/delete for creators (all events) or team members (their own events) */}
                      {(isCreator || (isTeamMemberWithCalendarAccess && event.creator_id === profile?.id)) && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleEditEvent(event)}
                            className="p-2 text-[var(--fc-section-muted,#666666)] hover:text-[var(--fc-section-text,#FAFAFA)] hover:bg-[var(--fc-section-hover,#1F1F1F)] rounded-lg transition-colors"
                            title={t('calendar.editEventTooltip')}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => setDeletingEventId(event.id)}
                            className="p-2 text-[var(--fc-section-muted,#666666)] hover:text-[#EF4444] hover:bg-[#EF4444]/10 rounded-lg transition-colors"
                            title={t('calendar.deleteEventTooltip')}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-[var(--fc-section-muted,#666666)]">
                      <div className="flex items-center gap-1">
                        <Clock size={16} /> {timeInfo}
                      </div>
                      {event.event_type === 'one_on_one' && event.attendee ? (
                        <div className="flex items-center gap-1">
                          <User size={16} /> {t('calendar.withAttendeeText', { name: event.attendee.full_name })}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Users size={16} /> {t('calendar.attendingText', { count: event.attendee_count })}
                        </div>
                      )}
                      {/* Show community name for students (not for creators or team members managing) */}
                      {!canManageCalendar && event.community && (
                        <div className="flex items-center gap-1 text-[var(--fc-section-text,#FAFAFA)]">
                          <Building2 size={16} /> {event.community.name}
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {(() => {
                        const locationUrl = getEventLocationUrl(event);
                        const isInPerson = event.location_type === 'in_person';

                        if (locationUrl) {
                          return (
                            <a
                              href={locationUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] text-sm font-medium px-4 py-2 rounded-lg hover:bg-[var(--fc-button-hover,#E0E0E0)] flex items-center gap-2 whitespace-nowrap"
                            >
                              {isInPerson ? <MapPin size={16} /> : <Video size={16} />}
                              {isInPerson ? t('calendar.viewLocationButton') : t('calendar.joinOnlineButton')}
                            </a>
                          );
                        }
                        return (
                          <button className="bg-[#333333] text-[var(--fc-section-muted,#666666)] text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2 whitespace-nowrap cursor-not-allowed" disabled>
                            {isInPerson ? <MapPin size={16} /> : <Video size={16} />}
                            {t('calendar.linkComingSoonButton')}
                          </button>
                        );
                      })()}
                      <button
                        onClick={() => downloadICS(event)}
                        className="px-3 py-2 border border-[var(--fc-section-border,#1F1F1F)] text-[var(--fc-section-muted,#A0A0A0)] rounded-lg text-sm font-medium hover:bg-[var(--fc-section,#0A0A0A)] flex items-center gap-2 whitespace-nowrap"
                        title={t('calendar.addToCalendarButton')}
                      >
                        <Download size={16} />
                        <span className="hidden sm:inline">{t('calendar.addToCalendarButton')}</span>
                      </button>
                      {/* Mark Attendance button for creators on group events */}
                      {canManageCalendar && event.event_type === 'group' && (
                        <button
                          onClick={() => setAttendanceEvent(event)}
                          className="px-3 py-2 border border-[#22C55E]/20 text-[#22C55E] rounded-lg text-sm font-medium hover:bg-[#22C55E]/10 flex items-center gap-2 whitespace-nowrap"
                          title={t('calendar.markAttendanceTooltip')}
                        >
                          <UserCheck size={16} />
                          <span className="hidden sm:inline">{t('calendar.markAttendanceButton')}</span>
                        </button>
                      )}
                      {!canManageCalendar && (
                        event.event_type === 'one_on_one' ? (
                          // 1:1 events: student is scheduled, show confirmation status
                          <div className="px-4 py-2 bg-[#22C55E]/10 border border-[#22C55E]/30 text-[#22C55E] rounded-lg text-sm font-medium flex items-center gap-2 whitespace-nowrap">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            {t('calendar.scheduledStatus')}
                          </div>
                        ) : (
                          // Group events: allow RSVP toggle
                          <button
                            onClick={() => handleRsvp(event.id, isAttending)}
                            className={`px-4 py-2 border rounded-lg text-sm font-medium whitespace-nowrap ${
                              isAttending
                                ? 'border-[#EF4444]/20 text-[#EF4444] hover:bg-[#EF4444]/10'
                                : 'border-[var(--fc-section-border,#1F1F1F)] hover:bg-[var(--fc-section,#0A0A0A)]'
                            }`}
                          >
                            {isAttending ? t('calendar.cancelRsvpButton') : t('calendar.rsvpButton')}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="bg-[var(--fc-section,#0A0A0A)] p-12 rounded-xl border border-[var(--fc-section-border,#1F1F1F)] text-center">
              <CalendarIcon className="w-12 h-12 mx-auto text-[var(--fc-section-muted,#666666)] mb-4" />
              <p className="text-[var(--fc-section-muted,#666666)]">
                {canManageCalendar
                  ? t('calendar.emptyStateCreator')
                  : t('calendar.emptyStateStudent')}
              </p>
            </div>
          )}
        </div>

        <div className="bg-[var(--fc-section,#0A0A0A)] p-6 rounded-xl border border-[var(--fc-section-border,#1F1F1F)] h-fit">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[var(--fc-section-text,#FAFAFA)] flex items-center gap-2">
              <CalendarIcon size={20} className="text-[var(--fc-section-muted,#666666)]" />
              {monthName}
            </h3>
            <div className="flex gap-1">
              <button
                onClick={goToPreviousMonth}
                className="p-1 hover:bg-[var(--fc-section-hover,#1F1F1F)] rounded"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={goToNextMonth}
                className="p-1 hover:bg-[var(--fc-section-hover,#1F1F1F)] rounded"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-sm mb-2">
            {(t('calendar.miniCalendar.dayAbbreviations', { returnObjects: true }) as string[]).map(d => (
              <div key={d} className="text-[var(--fc-section-muted,#666666)] font-medium py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-sm">
            {monthDays.slice(0, 35).map((dayInfo, index) => {
              const isToday = dayInfo.isCurrentMonth &&
                dayInfo.day === today.getDate() &&
                currentDate.getMonth() === today.getMonth() &&
                currentDate.getFullYear() === today.getFullYear();

              const dayEvents = dayInfo.isCurrentMonth
                ? getEventsForDay(events, currentDate.getFullYear(), currentDate.getMonth(), dayInfo.day)
                : [];

              const hasEvents = dayEvents.length > 0;

              return (
                <div
                  key={index}
                  onClick={() => dayInfo.isCurrentMonth && setSelectedDay(dayInfo.day)}
                  className={`py-2 rounded-full cursor-pointer relative
                    ${!dayInfo.isCurrentMonth ? 'text-[var(--fc-section-muted,#666666)]' : 'text-[var(--fc-section-muted,#A0A0A0)] hover:bg-[var(--fc-section,#0A0A0A)]'}
                    ${isToday ? 'bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] hover:bg-[var(--fc-button-hover,#E0E0E0)] font-bold' : ''}
                    ${selectedDay === dayInfo.day && dayInfo.isCurrentMonth && !isToday ? 'bg-[var(--fc-section-hover,#1F1F1F)]' : ''}
                  `}
                >
                  {dayInfo.day}
                  {hasEvents && !isToday && (
                    <div className="absolute bottom-0.5 left-1/2 transform -translate-x-1/2 w-1 h-1 rounded-full bg-white" />
                  )}
                </div>
              );
            })}
          </div>

          {selectedDay && (
            <div className="mt-4 pt-4 border-t border-[var(--fc-section-border,#1F1F1F)]">
              <h4 className="text-sm font-semibold text-[var(--fc-section-muted,#A0A0A0)] mb-2">
                {t('calendar.miniCalendar.eventsOnDayText', { month: currentDate.toLocaleDateString('en-US', { month: 'short' }), day: selectedDay })}
              </h4>
              {getEventsForDay(events, currentDate.getFullYear(), currentDate.getMonth(), selectedDay).length > 0 ? (
                <div className="space-y-2">
                  {getEventsForDay(events, currentDate.getFullYear(), currentDate.getMonth(), selectedDay).map(event => (
                    <div key={event.id} className="text-xs bg-[var(--fc-section-hover,#1F1F1F)] text-[var(--fc-section-text,#FAFAFA)] p-2 rounded">
                      {event.title}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[var(--fc-section-muted,#666666)]">{t('calendar.miniCalendar.noEventsOnDay')}</p>
              )}
            </div>
          )}
        </div>
      </div>
      )}

      {/* Create Event Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--fc-section,#0A0A0A)] rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-[var(--fc-section-border,#1F1F1F)] flex justify-between items-center">
              <h2 className="text-lg font-bold text-[var(--fc-section-text,#FAFAFA)]">{t('calendar.createEventModal.title')}</h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                className="text-[var(--fc-section-muted,#666666)] hover:text-[var(--fc-section-muted,#A0A0A0)]"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--fc-section-muted,#A0A0A0)] mb-1">
                  {t('calendar.createEventModal.eventTitleLabel')}
                </label>
                <input
                  type="text"
                  value={newEventTitle}
                  onChange={e => setNewEventTitle(e.target.value)}
                  placeholder={t('calendar.createEventModal.eventTitlePlaceholder')}
                  className="w-full border border-[var(--fc-section-border,#1F1F1F)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white/10"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--fc-section-muted,#A0A0A0)] mb-1">
                  {t('calendar.createEventModal.descriptionLabel')}
                </label>
                <textarea
                  value={newEventDescription}
                  onChange={e => setNewEventDescription(e.target.value)}
                  placeholder={t('calendar.createEventModal.descriptionPlaceholder')}
                  rows={3}
                  className="w-full border border-[var(--fc-section-border,#1F1F1F)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white/10"
                />
              </div>

              {/* Community Selector */}
              {communities.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-[var(--fc-section-muted,#A0A0A0)] mb-1">
                    {t('calendar.createEventModal.communityLabel')}
                  </label>
                  <select
                    value={newEventCommunityId}
                    onChange={e => {
                      setNewEventCommunityId(e.target.value);
                      setNewEventAttendeeId(''); // Reset attendee when community changes
                    }}
                    className="w-full border border-[var(--fc-section-border,#1F1F1F)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white/10"
                  >
                    <option value="">{t('calendar.createEventModal.communitySelectPlaceholder')}</option>
                    {communities.map(community => (
                      <option key={community.id} value={community.id}>
                        {community.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-[var(--fc-section-muted,#666666)] mt-1">
                    {t('calendar.createEventModal.communityHelpText')}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-[var(--fc-section-muted,#A0A0A0)] mb-1">
                  {t('calendar.createEventModal.eventTypeLabel')}
                </label>
                <select
                  value={newEventType}
                  onChange={e => {
                    setNewEventType(e.target.value as EventType);
                    setNewEventAttendeeId(''); // Reset attendee when type changes
                  }}
                  className="w-full border border-[var(--fc-section-border,#1F1F1F)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white/10"
                >
                  <option value="group">{t('calendar.createEventModal.eventTypeGroup')}</option>
                  <option value="one_on_one">{t('calendar.createEventModal.eventTypeOneOnOne')}</option>
                </select>
              </div>

              {/* User Selector for 1:1 events */}
              {newEventType === 'one_on_one' && newEventCommunityId && (
                <div>
                  <label className="block text-sm font-medium text-[var(--fc-section-muted,#A0A0A0)] mb-1">
                    {t('calendar.createEventModal.scheduleWithLabel')}
                  </label>
                  {loadingMembers ? (
                    <div className="flex items-center gap-2 text-[var(--fc-section-muted,#666666)] text-sm py-2">
                      <Loader2 size={14} className="animate-spin" />
                      {t('calendar.createEventModal.loadingMembers')}
                    </div>
                  ) : communityMembers.length > 0 ? (
                    <select
                      value={newEventAttendeeId}
                      onChange={e => setNewEventAttendeeId(e.target.value)}
                      className="w-full border border-[var(--fc-section-border,#1F1F1F)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white/10"
                    >
                      <option value="">{t('calendar.createEventModal.scheduleWithPlaceholder')}</option>
                      {communityMembers.map(member => (
                        <option key={member.id} value={member.id}>
                          {member.display_name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="bg-[#EAB308]/10 border border-[#EAB308]/20 rounded-lg p-3">
                      <p className="text-sm text-[#EAB308]">
                        {t('calendar.createEventModal.noMembersMessage')}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {newEventType === 'one_on_one' && !newEventCommunityId && (
                <div className="bg-[var(--fc-section-hover,#1F1F1F)] border border-[#333333] rounded-lg p-3">
                  <p className="text-sm text-[var(--fc-section-text,#FAFAFA)] flex items-center gap-2">
                    <User size={16} />
                    {t('calendar.createEventModal.selectCommunityFirst')}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-[var(--fc-section-muted,#A0A0A0)] mb-1">
                  {t('calendar.createEventModal.dateLabel')}
                </label>
                <input
                  type="date"
                  value={newEventDate}
                  onChange={e => setNewEventDate(e.target.value)}
                  onClick={e => (e.target as HTMLInputElement).showPicker()}
                  className="w-full border border-[var(--fc-section-border,#1F1F1F)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white/10 cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--fc-section-muted,#A0A0A0)] mb-1">
                    {t('calendar.createEventModal.startTimeLabel')}
                  </label>
                  <input
                    type="time"
                    value={newEventStartTime}
                    onChange={e => setNewEventStartTime(e.target.value)}
                    onClick={e => (e.target as HTMLInputElement).showPicker()}
                    className="w-full border border-[var(--fc-section-border,#1F1F1F)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white/10 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--fc-section-muted,#A0A0A0)] mb-1">
                    {t('calendar.createEventModal.endTimeLabel')}
                  </label>
                  <input
                    type="time"
                    value={newEventEndTime}
                    onChange={e => setNewEventEndTime(e.target.value)}
                    onClick={e => (e.target as HTMLInputElement).showPicker()}
                    className="w-full border border-[var(--fc-section-border,#1F1F1F)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white/10 cursor-pointer"
                  />
                </div>
              </div>

              {/* Location Type Toggle */}
              <div>
                <label className="block text-sm font-medium text-[var(--fc-section-muted,#A0A0A0)] mb-2">
                  {t('calendar.createEventModal.locationTypeLabel')}
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNewEventLocationType('online')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border text-sm font-medium transition-colors ${
                      newEventLocationType === 'online'
                        ? 'bg-[var(--fc-section-hover,#1F1F1F)] border-[#555555] text-[var(--fc-section-text,#FAFAFA)]'
                        : 'border-[var(--fc-section-border,#1F1F1F)] text-[var(--fc-section-muted,#A0A0A0)] hover:bg-[var(--fc-section,#0A0A0A)]'
                    }`}
                  >
                    <Video size={16} />
                    {t('calendar.createEventModal.locationTypeOnline')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewEventLocationType('in_person')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border text-sm font-medium transition-colors ${
                      newEventLocationType === 'in_person'
                        ? 'bg-[var(--fc-section-hover,#1F1F1F)] border-[#555555] text-[var(--fc-section-text,#FAFAFA)]'
                        : 'border-[var(--fc-section-border,#1F1F1F)] text-[var(--fc-section-muted,#A0A0A0)] hover:bg-[var(--fc-section,#0A0A0A)]'
                    }`}
                  >
                    <MapPin size={16} />
                    {t('calendar.createEventModal.locationTypeInPerson')}
                  </button>
                </div>
              </div>

              {/* Conditional Location Input */}
              {newEventLocationType === 'online' ? (
                <div>
                  <label className="block text-sm font-medium text-[var(--fc-section-muted,#A0A0A0)] mb-1">
                    {t('calendar.createEventModal.meetingLinkLabel')}
                  </label>
                  <input
                    type="url"
                    value={newEventLink}
                    onChange={e => setNewEventLink(e.target.value)}
                    placeholder={t('calendar.createEventModal.meetingLinkPlaceholder')}
                    className="w-full border border-[var(--fc-section-border,#1F1F1F)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white/10"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-[var(--fc-section-muted,#A0A0A0)] mb-1">
                    {t('calendar.createEventModal.addressLabel')}
                  </label>
                  <input
                    type="text"
                    value={newEventAddress}
                    onChange={e => setNewEventAddress(e.target.value)}
                    placeholder={t('calendar.createEventModal.addressPlaceholder')}
                    className="w-full border border-[var(--fc-section-border,#1F1F1F)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white/10"
                  />
                  <p className="text-xs text-[var(--fc-section-muted,#666666)] mt-1">
                    {t('calendar.createEventModal.addressHelpText')}
                  </p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-[var(--fc-section-border,#1F1F1F)] flex gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                className="flex-1 border border-[var(--fc-section-border,#1F1F1F)] text-[var(--fc-section-muted,#A0A0A0)] py-2 rounded-lg text-sm font-medium hover:bg-[var(--fc-section,#0A0A0A)]"
              >
                {t('calendar.createEventModal.cancelButton')}
              </button>
              <button
                onClick={handleCreateEvent}
                disabled={creating || !newEventTitle || !newEventDate || !newEventStartTime || !newEventEndTime || (newEventType === 'one_on_one' && newEventCommunityId && !newEventAttendeeId)}
                className="flex-1 bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] py-2 rounded-lg text-sm font-medium hover:bg-[var(--fc-button-hover,#E0E0E0)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {creating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> {t('calendar.createEventModal.creatingButton')}
                  </>
                ) : (
                  t('calendar.createEventModal.createButton')
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Event Modal */}
      {editingEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--fc-section,#0A0A0A)] rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-[var(--fc-section-border,#1F1F1F)] flex justify-between items-center">
              <h2 className="text-lg font-bold text-[var(--fc-section-text,#FAFAFA)]">{t('calendar.editEventModal.title')}</h2>
              <button
                onClick={() => {
                  setEditingEvent(null);
                  resetForm();
                }}
                className="text-[var(--fc-section-muted,#666666)] hover:text-[var(--fc-section-muted,#A0A0A0)]"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Attendee selector for 1:1 events */}
              {editingEvent.event_type === 'one_on_one' && editingEvent.community_id && (
                <div className="bg-[var(--fc-section-hover,#1F1F1F)] border border-[#333333] rounded-lg p-4">
                  <label className="block text-sm font-medium text-[var(--fc-section-text,#FAFAFA)] mb-2">
                    {t('calendar.editEventModal.scheduledWithLabel')}
                  </label>
                  {loadingMembers ? (
                    <div className="flex items-center gap-2 text-[var(--fc-section-text,#FAFAFA)] text-sm">
                      <Loader2 size={14} className="animate-spin" />
                      {t('calendar.editEventModal.loadingMembers')}
                    </div>
                  ) : communityMembers.length > 0 ? (
                    <select
                      value={newEventAttendeeId}
                      onChange={e => setNewEventAttendeeId(e.target.value)}
                      className="w-full border border-[#555555] rounded-lg px-3 py-2 text-sm bg-[var(--fc-section,#0A0A0A)] focus:outline-none focus:ring-1 focus:ring-white/10"
                    >
                      <option value="">{t('calendar.editEventModal.scheduledWithPlaceholder')}</option>
                      {communityMembers.map(member => (
                        <option key={member.id} value={member.id}>
                          {member.display_name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex items-center gap-2 text-[var(--fc-section-text,#FAFAFA)] text-sm">
                      <User size={16} />
                      {editingEvent.attendee?.full_name || t('calendar.editEventModal.noAttendeeAssigned')}
                    </div>
                  )}
                </div>
              )}
              {/* Show read-only for 1:1 events without community */}
              {editingEvent.event_type === 'one_on_one' && !editingEvent.community_id && (
                <div className="bg-[var(--fc-section-hover,#1F1F1F)] border border-[#333333] rounded-lg p-4">
                  <label className="block text-sm font-medium text-[var(--fc-section-text,#FAFAFA)] mb-1">
                    {t('calendar.editEventModal.scheduledWithLabel')}
                  </label>
                  <div className="flex items-center gap-2">
                    <User size={16} className="text-[var(--fc-section-text,#FAFAFA)]" />
                    <span className="text-sm font-medium text-[var(--fc-section-text,#FAFAFA)]">
                      {editingEvent.attendee?.full_name || t('calendar.editEventModal.noAttendeeAssigned')}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-[var(--fc-section-muted,#A0A0A0)] mb-1">
                  {t('calendar.editEventModal.eventTitleLabel')}
                </label>
                <input
                  type="text"
                  value={newEventTitle}
                  onChange={e => setNewEventTitle(e.target.value)}
                  placeholder={t('calendar.editEventModal.eventTitlePlaceholder')}
                  className="w-full border border-[var(--fc-section-border,#1F1F1F)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white/10"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--fc-section-muted,#A0A0A0)] mb-1">
                  {t('calendar.editEventModal.descriptionLabel')}
                </label>
                <textarea
                  value={newEventDescription}
                  onChange={e => setNewEventDescription(e.target.value)}
                  placeholder={t('calendar.editEventModal.descriptionPlaceholder')}
                  rows={3}
                  className="w-full border border-[var(--fc-section-border,#1F1F1F)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white/10"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--fc-section-muted,#A0A0A0)] mb-1">
                  {t('calendar.editEventModal.dateLabel')}
                </label>
                <input
                  type="date"
                  value={newEventDate}
                  onChange={e => setNewEventDate(e.target.value)}
                  onClick={e => (e.target as HTMLInputElement).showPicker()}
                  className="w-full border border-[var(--fc-section-border,#1F1F1F)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white/10 cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--fc-section-muted,#A0A0A0)] mb-1">
                    {t('calendar.editEventModal.startTimeLabel')}
                  </label>
                  <input
                    type="time"
                    value={newEventStartTime}
                    onChange={e => setNewEventStartTime(e.target.value)}
                    onClick={e => (e.target as HTMLInputElement).showPicker()}
                    className="w-full border border-[var(--fc-section-border,#1F1F1F)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white/10 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--fc-section-muted,#A0A0A0)] mb-1">
                    {t('calendar.editEventModal.endTimeLabel')}
                  </label>
                  <input
                    type="time"
                    value={newEventEndTime}
                    onChange={e => setNewEventEndTime(e.target.value)}
                    onClick={e => (e.target as HTMLInputElement).showPicker()}
                    className="w-full border border-[var(--fc-section-border,#1F1F1F)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white/10 cursor-pointer"
                  />
                </div>
              </div>

              {/* Location Type Toggle */}
              <div>
                <label className="block text-sm font-medium text-[var(--fc-section-muted,#A0A0A0)] mb-2">
                  {t('calendar.editEventModal.locationTypeLabel')}
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNewEventLocationType('online')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border text-sm font-medium transition-colors ${
                      newEventLocationType === 'online'
                        ? 'bg-[var(--fc-section-hover,#1F1F1F)] border-[#555555] text-[var(--fc-section-text,#FAFAFA)]'
                        : 'border-[var(--fc-section-border,#1F1F1F)] text-[var(--fc-section-muted,#A0A0A0)] hover:bg-[var(--fc-section,#0A0A0A)]'
                    }`}
                  >
                    <Video size={16} />
                    {t('calendar.editEventModal.locationTypeOnline')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewEventLocationType('in_person')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border text-sm font-medium transition-colors ${
                      newEventLocationType === 'in_person'
                        ? 'bg-[var(--fc-section-hover,#1F1F1F)] border-[#555555] text-[var(--fc-section-text,#FAFAFA)]'
                        : 'border-[var(--fc-section-border,#1F1F1F)] text-[var(--fc-section-muted,#A0A0A0)] hover:bg-[var(--fc-section,#0A0A0A)]'
                    }`}
                  >
                    <MapPin size={16} />
                    {t('calendar.editEventModal.locationTypeInPerson')}
                  </button>
                </div>
              </div>

              {/* Conditional Location Input */}
              {newEventLocationType === 'online' ? (
                <div>
                  <label className="block text-sm font-medium text-[var(--fc-section-muted,#A0A0A0)] mb-1">
                    {t('calendar.editEventModal.meetingLinkLabel')}
                  </label>
                  <input
                    type="url"
                    value={newEventLink}
                    onChange={e => setNewEventLink(e.target.value)}
                    placeholder={t('calendar.editEventModal.meetingLinkPlaceholder')}
                    className="w-full border border-[var(--fc-section-border,#1F1F1F)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white/10"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-[var(--fc-section-muted,#A0A0A0)] mb-1">
                    {t('calendar.editEventModal.addressLabel')}
                  </label>
                  <input
                    type="text"
                    value={newEventAddress}
                    onChange={e => setNewEventAddress(e.target.value)}
                    placeholder={t('calendar.editEventModal.addressPlaceholder')}
                    className="w-full border border-[var(--fc-section-border,#1F1F1F)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white/10"
                  />
                  <p className="text-xs text-[var(--fc-section-muted,#666666)] mt-1">
                    {t('calendar.editEventModal.addressHelpText')}
                  </p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-[var(--fc-section-border,#1F1F1F)] flex gap-3">
              <button
                onClick={() => {
                  setEditingEvent(null);
                  resetForm();
                }}
                className="flex-1 border border-[var(--fc-section-border,#1F1F1F)] text-[var(--fc-section-muted,#A0A0A0)] py-2 rounded-lg text-sm font-medium hover:bg-[var(--fc-section,#0A0A0A)]"
              >
                {t('calendar.editEventModal.cancelButton')}
              </button>
              <button
                onClick={handleUpdateEvent}
                disabled={updating || !newEventTitle || !newEventDate || !newEventStartTime || !newEventEndTime}
                className="flex-1 bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] py-2 rounded-lg text-sm font-medium hover:bg-[var(--fc-button-hover,#E0E0E0)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {updating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> {t('calendar.editEventModal.savingButton')}
                  </>
                ) : (
                  t('calendar.editEventModal.saveButton')
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingEventId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--fc-section,#0A0A0A)] rounded-xl max-w-sm w-full">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[#EF4444]/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-[#EF4444]" />
                </div>
                <h2 className="text-lg font-bold text-[var(--fc-section-text,#FAFAFA)]">{t('calendar.deleteEventModal.title')}</h2>
              </div>
              <p className="text-[var(--fc-section-muted,#A0A0A0)] text-sm">
                {t('calendar.deleteEventModal.confirmationText')}
              </p>
            </div>

            <div className="p-4 border-t border-[var(--fc-section-border,#1F1F1F)] flex gap-3">
              <button
                onClick={() => setDeletingEventId(null)}
                disabled={deleting}
                className="flex-1 border border-[var(--fc-section-border,#1F1F1F)] text-[var(--fc-section-muted,#A0A0A0)] py-2 rounded-lg text-sm font-medium hover:bg-[var(--fc-section,#0A0A0A)] disabled:opacity-50"
              >
                {t('calendar.deleteEventModal.cancelButton')}
              </button>
              <button
                onClick={() => handleDeleteEvent(deletingEventId)}
                disabled={deleting}
                className="flex-1 bg-[#EF4444] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#EF4444]/80 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> {t('calendar.deleteEventModal.deletingButton')}
                  </>
                ) : (
                  t('calendar.deleteEventModal.deleteButton')
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attendance Modal */}
      {attendanceEvent && profile?.id && (
        <AttendanceModal
          eventId={attendanceEvent.id}
          eventTitle={attendanceEvent.title}
          communityId={attendanceEvent.community_id}
          creatorId={profile.id}
          onClose={() => setAttendanceEvent(null)}
          onSaved={() => loadEvents()}
        />
      )}
    </div>
  );
};

export default CalendarView;
