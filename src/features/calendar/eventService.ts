import { supabase } from '../../core/supabase/client';
import {
  DbEvent,
  DbEventAttendee,
  DbEventWithGroup,
  DbProfile,
  EventType,
  LocationType,
  AttendeeStatus,
} from '../../core/supabase/database.types';

// ============================================================================
// TYPES
// ============================================================================

export interface EventAttendeeInfo {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

export interface CommunityInfo {
  id: string;
  name: string;
}

export interface EventWithDetails extends DbEvent {
  attendee_count: number;
  user_status?: AttendeeStatus | null;
  creator?: DbProfile;
  // For 1:1 events, the scheduled attendee
  attendee?: EventAttendeeInfo | null;
  // Community info for student view
  community?: CommunityInfo | null;
}

// ============================================================================
// EVENTS
// ============================================================================

export async function getEvents(communityId?: string): Promise<EventWithDetails[]> {
  let query = supabase
    .from('events')
    .select('*')
    .gte('start_time', new Date().toISOString())
    .order('start_time', { ascending: true });

  if (communityId) {
    query = query.eq('community_id', communityId);
  }

  const { data: events, error } = await query;

  if (error) {
    console.error('Error fetching events:', error);
    return [];
  }

  if (!events || events.length === 0) return [];

  // Batch query all attendee counts in ONE query
  const eventIds = events.map(e => e.id);
  const { data: attendees } = await supabase
    .from('event_attendees')
    .select('event_id')
    .in('event_id', eventIds)
    .eq('attended', true)
    .limit(10000);

  // Count in memory
  const countMap = new Map<string, number>();
  (attendees || []).forEach(a => {
    countMap.set(a.event_id, (countMap.get(a.event_id) || 0) + 1);
  });

  return events.map(event => ({
    ...event,
    attendee_count: countMap.get(event.id) || 0,
  }));
}

export async function getCreatorEvents(
  creatorId: string,
  filter: 'upcoming' | 'past' | 'all' = 'upcoming'
): Promise<EventWithDetails[]> {
  const now = new Date().toISOString();

  let query = supabase
    .from('events')
    .select('*')
    .eq('creator_id', creatorId);

  if (filter === 'upcoming') {
    query = query.gte('start_time', now);
  } else if (filter === 'past') {
    query = query.lt('start_time', now);
  }

  const { data: events, error } = await query.order('start_time', { ascending: filter !== 'past' });

  if (error) {
    console.error('Error fetching creator events:', error);
    return [];
  }

  if (!events || events.length === 0) return [];

  const eventIds = events.map(e => e.id);

  // Batch query: all attendee counts
  const { data: attendees } = await supabase
    .from('event_attendees')
    .select('event_id')
    .in('event_id', eventIds)
    .eq('attended', true)
    .limit(10000);

  const countMap = new Map<string, number>();
  (attendees || []).forEach(a => {
    countMap.set(a.event_id, (countMap.get(a.event_id) || 0) + 1);
  });

  // Batch query: 1:1 event attendee profiles
  const oneOnOneIds = events.filter(e => e.event_type === 'one_on_one').map(e => e.id);
  const attendeeMap = new Map<string, EventAttendeeInfo>();

  if (oneOnOneIds.length > 0) {
    const { data: oneOnOneAttendees } = await supabase
      .from('event_attendees')
      .select(`
        event_id,
        user_id,
        profile:profiles!user_id(id, full_name, avatar_url)
      `)
      .in('event_id', oneOnOneIds)
      .eq('status', 'attending');

    (oneOnOneAttendees || []).forEach((a: any) => {
      if (a.profile) {
        const profile = a.profile as { id: string; full_name: string; avatar_url: string | null };
        attendeeMap.set(a.event_id, {
          id: profile.id,
          full_name: profile.full_name || 'Unknown',
          avatar_url: profile.avatar_url,
        });
      }
    });
  }

  return events.map(event => ({
    ...event,
    attendee_count: countMap.get(event.id) || 0,
    attendee: attendeeMap.get(event.id) || null,
  }));
}

/**
 * Get creator events with group info
 */
export async function getCreatorEventsWithGroups(
  creatorId: string
): Promise<(EventWithDetails & { group_id: string | null; group?: any })[]> {
  const { data: events, error } = await supabase
    .from('events')
    .select(`
      *,
      group:community_groups(id, name)
    `)
    .eq('creator_id', creatorId)
    .order('start_time', { ascending: true });

  if (error) {
    console.error('Error fetching creator events:', error);
    return [];
  }

  if (!events || events.length === 0) return [];

  // Batch query attendee counts
  const eventIds = events.map(e => e.id);
  const { data: attendees } = await supabase
    .from('event_attendees')
    .select('event_id')
    .in('event_id', eventIds)
    .eq('attended', true)
    .limit(10000);

  const countMap = new Map<string, number>();
  (attendees || []).forEach(a => {
    countMap.set(a.event_id, (countMap.get(a.event_id) || 0) + 1);
  });

  return events.map(event => ({
    ...event,
    attendee_count: countMap.get(event.id) || 0,
    group: event.group || null,
  }));
}

export async function getUpcomingEvents(userId: string): Promise<EventWithDetails[]> {
  // First, get all creators the student is enrolled with (via enrollments)
  const { data: enrollments, error: enrollmentError } = await supabase
    .from('enrollments')
    .select('course:courses(creator_id)')
    .eq('user_id', userId);

  if (enrollmentError) {
    console.error('Error fetching enrollments:', enrollmentError);
  }

  // Extract unique creator IDs from enrollments
  const creatorIds = new Set<string>();
  for (const enrollment of enrollments || []) {
    const course = enrollment.course as { creator_id: string } | null;
    if (course?.creator_id) {
      creatorIds.add(course.creator_id);
    }
  }

  // Also check community memberships to get creators
  const { data: memberships, error: membershipError } = await supabase
    .from('memberships')
    .select('community:communities(creator_id)')
    .eq('user_id', userId);

  if (membershipError) {
    console.error('Error fetching memberships:', membershipError);
  }

  for (const membership of memberships || []) {
    const community = membership.community as { creator_id: string } | null;
    if (community?.creator_id) {
      creatorIds.add(community.creator_id);
    }
  }

  const now = new Date().toISOString();

  // Get events where user is specifically an attendee (e.g., 1:1 sessions)
  const { data: attendeeRecords, error: attendeeError } = await supabase
    .from('event_attendees')
    .select('event_id')
    .eq('user_id', userId);

  if (attendeeError) {
    console.error('Error fetching attendee records:', attendeeError);
  }

  const attendingEventIds = new Set((attendeeRecords || []).map(a => a.event_id));

  // Build query for GROUP events from creators the user follows
  // 1:1 events will be added separately (only where user is attendee)
  const events: EventWithDetails[] = [];

  // Get GROUP events from creators (with community info)
  if (creatorIds.size > 0) {
    const { data: groupEvents, error: groupError } = await supabase
      .from('events')
      .select(`
        *,
        community:communities(id, name)
      `)
      .in('creator_id', Array.from(creatorIds))
      .eq('event_type', 'group')
      .gte('start_time', now)
      .order('start_time', { ascending: true });

    if (groupError) {
      console.error('Error fetching group events:', groupError);
    }

    if (groupEvents && groupEvents.length > 0) {
      const groupEventIds = groupEvents.map(e => e.id);

      // Batch RSVP counts
      const { data: rsvpData } = await supabase
        .from('event_attendees')
        .select('event_id')
        .in('event_id', groupEventIds)
        .eq('status', 'attending')
        .limit(10000);

      const rsvpCountMap = new Map<string, number>();
      (rsvpData || []).forEach(a => {
        rsvpCountMap.set(a.event_id, (rsvpCountMap.get(a.event_id) || 0) + 1);
      });

      // Batch user statuses
      const { data: userStatuses } = await supabase
        .from('event_attendees')
        .select('event_id, status')
        .in('event_id', groupEventIds)
        .eq('user_id', userId);

      const userStatusMap = new Map<string, string>();
      (userStatuses || []).forEach(a => {
        userStatusMap.set(a.event_id, a.status);
      });

      for (const event of groupEvents) {
        const communityData = event.community as { id: string; name: string } | null;
        events.push({
          ...event,
          attendee_count: rsvpCountMap.get(event.id) || 0,
          user_status: (userStatusMap.get(event.id) as AttendeeStatus) || null,
          community: communityData ? { id: communityData.id, name: communityData.name } : null,
        });
      }
    }
  }

  // Get 1:1 events ONLY where user is the attendee (with community info)
  if (attendingEventIds.size > 0) {
    const { data: oneOnOneEvents, error: oneOnOneError } = await supabase
      .from('events')
      .select(`
        *,
        community:communities(id, name)
      `)
      .in('id', Array.from(attendingEventIds))
      .eq('event_type', 'one_on_one')
      .gte('start_time', now)
      .order('start_time', { ascending: true });

    if (oneOnOneError) {
      console.error('Error fetching 1:1 events:', oneOnOneError);
    }

    if (oneOnOneEvents && oneOnOneEvents.length > 0) {
      const oneOnOneEventIds = oneOnOneEvents.map(e => e.id);

      // Batch user statuses for 1:1 events
      const { data: oneOnOneStatuses } = await supabase
        .from('event_attendees')
        .select('event_id, status')
        .in('event_id', oneOnOneEventIds)
        .eq('user_id', userId);

      const oneOnOneStatusMap = new Map<string, string>();
      (oneOnOneStatuses || []).forEach(a => {
        oneOnOneStatusMap.set(a.event_id, a.status);
      });

      for (const event of oneOnOneEvents) {
        const communityData = event.community as { id: string; name: string } | null;
        events.push({
          ...event,
          attendee_count: 1,
          user_status: (oneOnOneStatusMap.get(event.id) as AttendeeStatus) || null,
          attendee: null,
          community: communityData ? { id: communityData.id, name: communityData.name } : null,
        });
      }
    }
  }

  // Sort all events by start_time
  events.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  return events;
}

export async function getEventById(eventId: string, userId?: string): Promise<EventWithDetails | null> {
  const { data: event, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single();

  if (error || !event) {
    console.error('Error fetching event:', error);
    return null;
  }

  const { count } = await supabase
    .from('event_attendees')
    .select('id', { count: 'exact' })
    .eq('event_id', eventId)
    .eq('attended', true);

  let userStatus: AttendeeStatus | null = null;
  if (userId) {
    const { data: attendance } = await supabase
      .from('event_attendees')
      .select('status')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .single();

    userStatus = attendance?.status as AttendeeStatus | null;
  }

  return {
    ...event,
    attendee_count: count || 0,
    user_status: userStatus,
  };
}

export async function uploadEventCoverImage(file: File, eventId?: string): Promise<string | null> {
  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const fileName = `events/${eventId || crypto.randomUUID()}/cover-${Date.now()}.${fileExt}`;

  const { data, error } = await supabase.storage.from('avatars').upload(fileName, file, {
    cacheControl: '3600',
    upsert: true,
  });

  if (error) {
    console.error('Error uploading event cover image:', error);
    return null;
  }

  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(data.path);
  return urlData.publicUrl;
}

export async function createEvent(
  creatorId: string,
  title: string,
  startTime: Date,
  endTime: Date,
  eventType: EventType = 'group',
  description?: string,
  meetingLink?: string,
  maxAttendees?: number,
  communityId?: string,
  groupId?: string | null,
  locationType: LocationType = 'online',
  address?: string,
  coverImageUrl?: string
): Promise<DbEvent | null> {
  const { data, error } = await supabase
    .from('events')
    .insert({
      creator_id: creatorId,
      community_id: communityId,
      group_id: groupId || null,
      title,
      description,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      event_type: eventType,
      location_type: locationType,
      meeting_link: locationType === 'online' ? meetingLink : null,
      address: locationType === 'in_person' ? address : null,
      max_attendees: maxAttendees,
      cover_image_url: coverImageUrl || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating event:', error);
    return null;
  }
  return data;
}

export async function updateEvent(
  eventId: string,
  updates: Partial<{
    title: string;
    description: string;
    start_time: string;
    end_time: string;
    location_type: LocationType;
    meeting_link: string | null;
    address: string | null;
    max_attendees: number;
    group_id: string | null;
    cover_image_url: string | null;
  }>
): Promise<boolean> {
  const { error } = await supabase
    .from('events')
    .update(updates)
    .eq('id', eventId);

  if (error) {
    console.error('Error updating event:', error);
    return false;
  }
  return true;
}

export async function deleteEvent(eventId: string): Promise<boolean> {
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId);

  if (error) {
    console.error('Error deleting event:', error);
    return false;
  }
  return true;
}

// ============================================================================
// COMMUNITY MEMBERS (for 1:1 event scheduling)
// ============================================================================

export interface CommunityMember {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

export async function getCommunityMembers(communityId: string): Promise<CommunityMember[]> {
  const { data, error } = await supabase
    .from('memberships')
    .select(`
      user_id,
      profile:profiles!user_id(id, full_name, avatar_url)
    `)
    .eq('community_id', communityId);

  if (error) {
    console.error('Error fetching community members:', error);
    return [];
  }

  return (data || []).map((m: any) => ({
    id: m.profile?.id || m.user_id,
    display_name: m.profile?.full_name || 'Unknown',
    avatar_url: m.profile?.avatar_url || null,
  }));
}

// ============================================================================
// RSVP / ATTENDANCE
// ============================================================================

export async function rsvpToEvent(
  userId: string,
  eventId: string,
  status: AttendeeStatus = 'attending'
): Promise<DbEventAttendee | null> {
  console.log('rsvpToEvent called:', { userId, eventId, status });

  const { data, error } = await supabase
    .from('event_attendees')
    .upsert({
      user_id: userId,
      event_id: eventId,
      status,
      responded_at: new Date().toISOString(),
    }, {
      onConflict: 'event_id,user_id',
    })
    .select()
    .single();

  if (error) {
    console.error('Error RSVPing to event:', {
      error,
      errorMessage: error.message,
      errorCode: error.code,
      errorDetails: error.details,
      userId,
      eventId
    });
    return null;
  }
  console.log('rsvpToEvent success:', data);
  return data;
}

/**
 * Add an attendee to a 1:1 event (for creator use when scheduling)
 * Uses a SECURITY DEFINER database function to bypass RLS issues
 */
export async function addOneOnOneAttendee(
  eventId: string,
  attendeeId: string,
  creatorId: string
): Promise<boolean> {
  console.log('addOneOnOneAttendee called:', { eventId, attendeeId, creatorId });

  // Use the SECURITY DEFINER function to add attendee (bypasses RLS)
  const { data, error } = await supabase
    .rpc('add_event_attendee_for_creator', {
      p_event_id: eventId,
      p_attendee_id: attendeeId,
      p_creator_id: creatorId
    });

  if (error) {
    console.error('Error adding 1:1 attendee via RPC:', {
      error,
      errorMessage: error.message,
      errorCode: error.code,
      errorDetails: error.details,
      eventId,
      attendeeId,
      creatorId
    });
    return false;
  }

  console.log('addOneOnOneAttendee RPC result:', data);
  return data === true;
}

export async function cancelRsvp(userId: string, eventId: string): Promise<boolean> {
  const { error } = await supabase
    .from('event_attendees')
    .delete()
    .eq('user_id', userId)
    .eq('event_id', eventId);

  if (error) {
    console.error('Error canceling RSVP:', error);
    return false;
  }
  return true;
}

/**
 * Update the attendee for a 1:1 event (creator use only)
 * Uses the SECURITY DEFINER function for reliable updates
 */
export async function updateEventAttendee(
  eventId: string,
  newAttendeeId: string,
  creatorId?: string
): Promise<boolean> {
  console.log('updateEventAttendee called:', { eventId, newAttendeeId, creatorId });

  // If creatorId is provided, use the RPC function (more reliable)
  if (creatorId) {
    const { data, error } = await supabase
      .rpc('add_event_attendee_for_creator', {
        p_event_id: eventId,
        p_attendee_id: newAttendeeId,
        p_creator_id: creatorId
      });

    if (error) {
      console.error('Error updating attendee via RPC:', {
        error,
        errorMessage: error.message,
        errorCode: error.code,
        eventId,
        newAttendeeId,
        creatorId
      });
      return false;
    }

    console.log('updateEventAttendee RPC success:', data);
    return data === true;
  }

  // Fallback: Direct database operations (may fail due to RLS)
  // Remove all existing attendees for this event
  const { error: deleteError } = await supabase
    .from('event_attendees')
    .delete()
    .eq('event_id', eventId);

  if (deleteError) {
    console.error('Error removing old attendees:', {
      error: deleteError,
      errorMessage: deleteError.message,
      errorCode: deleteError.code,
      eventId
    });
    return false;
  }
  console.log('Old attendees removed successfully');

  // Add the new attendee
  const { data, error: insertError } = await supabase
    .from('event_attendees')
    .insert({
      user_id: newAttendeeId,
      event_id: eventId,
      status: 'attending',
      responded_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertError) {
    console.error('Error adding new attendee:', {
      error: insertError,
      errorMessage: insertError.message,
      errorCode: insertError.code,
      eventId,
      newAttendeeId
    });
    return false;
  }

  console.log('updateEventAttendee success:', data);
  return true;
}

export async function getEventAttendees(eventId: string): Promise<(DbEventAttendee & { profile: DbProfile })[]> {
  const { data, error } = await supabase
    .from('event_attendees')
    .select(`
      *,
      profile:profiles!user_id(*)
    `)
    .eq('event_id', eventId)
    .eq('status', 'attending');

  if (error) {
    console.error('Error fetching attendees:', error);
    return [];
  }

  return (data || []).map(a => ({
    ...a,
    profile: a.profile as DbProfile,
  }));
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function formatEventDate(date: string): { month: string; day: string; full: string } {
  const d = new Date(date);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return {
    month: months[d.getMonth()],
    day: d.getDate().toString(),
    full: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
  };
}

export function formatEventTime(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);

  const startTime = startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const endTime = endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  return `${startTime} - ${endTime}`;
}

export function getMonthDays(year: number, month: number): { day: number; isCurrentMonth: boolean }[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay();

  const days: { day: number; isCurrentMonth: boolean }[] = [];

  // Add days from previous month
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    days.push({ day: prevMonthLastDay - i, isCurrentMonth: false });
  }

  // Add days of current month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({ day: i, isCurrentMonth: true });
  }

  // Fill remaining cells (up to 42 for 6 rows)
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    days.push({ day: i, isCurrentMonth: false });
  }

  return days;
}

export function getEventsForDay(events: EventWithDetails[], year: number, month: number, day: number): EventWithDetails[] {
  return events.filter(event => {
    const eventDate = new Date(event.start_time);
    return eventDate.getFullYear() === year &&
           eventDate.getMonth() === month &&
           eventDate.getDate() === day;
  });
}

// ============================================================================
// ICS EXPORT
// ============================================================================

/**
 * Formats a date to ICS format (YYYYMMDDTHHMMSSZ)
 * Converts to UTC timezone
 */
function formatICSDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');

  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Escapes special characters in ICS text fields
 */
function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Gets the location URL for an event (for ICS export and display)
 * Returns the meeting link for online events, or a Google Maps URL for in-person events
 */
export function getEventLocationUrl(event: DbEvent | EventWithDetails): string | null {
  if (event.location_type === 'in_person' && event.address) {
    // If it's already a Google Maps URL, return as-is
    // Patterns: google.com/maps, goo.gl/maps, maps.google.com, maps.app.goo.gl
    if (
      event.address.includes('google.com/maps') ||
      event.address.includes('goo.gl/maps') ||
      event.address.includes('maps.google.com') ||
      event.address.includes('maps.app.goo.gl')
    ) {
      return event.address;
    }
    // Otherwise, generate a Google Maps search URL
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address)}`;
  }
  return event.meeting_link || null;
}

/**
 * Generates ICS file content for a single event
 */
export function generateICS(event: DbEvent | EventWithDetails): string {
  const startDate = new Date(event.start_time);
  const endDate = new Date(event.end_time);

  const title = escapeICSText(event.title);
  const description = event.description ? escapeICSText(event.description) : '';

  // For ICS, use the address text for in-person events, meeting link for online
  const locationText = event.location_type === 'in_person'
    ? (event.address || '')
    : (event.meeting_link || '');
  const locationUrl = getEventLocationUrl(event);

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Founders Club//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `DTSTART:${formatICSDate(startDate)}`,
    `DTEND:${formatICSDate(endDate)}`,
    `DTSTAMP:${formatICSDate(new Date())}`,
    `UID:${event.id}@foundersclub.com`,
    `SUMMARY:${title}`,
    description ? `DESCRIPTION:${description}` : null,
    locationText ? `LOCATION:${escapeICSText(locationText)}` : null,
    locationUrl ? `URL:${locationUrl}` : null,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(line => line !== null)
    .join('\r\n');

  return icsContent;
}

/**
 * Downloads an ICS file for a single event
 */
export function downloadICS(event: DbEvent | EventWithDetails): void {
  const icsContent = generateICS(event);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  // Create a temporary anchor element to trigger download
  const link = document.createElement('a');
  link.href = url;
  link.download = `${event.title.replace(/[^a-z0-9]/gi, '_')}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up the URL object
  URL.revokeObjectURL(url);
}

// ============================================================================
// ATTENDANCE TRACKING
// ============================================================================

export interface EventAttendeeWithProfile {
  id: string;
  user_id: string;
  event_id: string;
  status: AttendeeStatus;
  attended: boolean;
  attended_at: string | null;
  profile: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };
}

/**
 * Get all attendees for an event with their profiles and attendance status
 * Uses RPC function to bypass RLS issues with profile joins
 */
export async function getEventAttendeesWithAttendance(eventId: string): Promise<EventAttendeeWithProfile[]> {
  const { data, error } = await supabase
    .rpc('get_event_attendees_with_profiles', { p_event_id: eventId });

  if (error) {
    console.error('Error fetching event attendees with attendance:', error);
    return [];
  }

  return (data || []).map((a: any) => ({
    id: a.id,
    user_id: a.user_id,
    event_id: a.event_id,
    status: a.status,
    attended: a.attended || false,
    attended_at: a.attended_at,
    profile: {
      id: a.profile_id || a.user_id,
      full_name: a.profile_name || null,
      email: a.profile_email || '',
      avatar_url: a.profile_avatar || null,
    },
  }));
}

/**
 * Mark a single user as attended/not attended for an event
 * Uses RPC function to bypass RLS
 */
export async function markAttendance(
  eventId: string,
  userId: string,
  attended: boolean,
  creatorId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .rpc('mark_event_attendance', {
      p_event_id: eventId,
      p_user_id: userId,
      p_attended: attended,
      p_creator_id: creatorId,
    });

  if (error) {
    console.error('Error marking attendance:', error);
    return false;
  }

  return data === true;
}

/**
 * Mark multiple users as attended for an event
 */
export async function markBulkAttendance(
  eventId: string,
  userIds: string[],
  attended: boolean,
  creatorId: string
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const userId of userIds) {
    const result = await markAttendance(eventId, userId, attended, creatorId);
    if (result) {
      success++;
    } else {
      failed++;
    }
  }

  return { success, failed };
}

/**
 * Get community members who are NOT already marked as attendees for an event
 * Useful for adding new attendees who didn't RSVP
 */
export async function getNonAttendingCommunityMembers(
  communityId: string,
  eventId: string
): Promise<CommunityMember[]> {
  // First get all community members
  const allMembers = await getCommunityMembers(communityId);

  // Get existing attendees for this event
  const { data: existingAttendees } = await supabase
    .from('event_attendees')
    .select('user_id')
    .eq('event_id', eventId);

  const existingUserIds = new Set((existingAttendees || []).map(a => a.user_id));

  // Filter out members who are already attendees
  return allMembers.filter(member => !existingUserIds.has(member.id));
}
