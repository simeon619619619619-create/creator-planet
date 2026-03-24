import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Search, Check, Loader2, Users, UserCheck, UserX } from 'lucide-react';
import {
  getEventAttendeesWithAttendance,
  getCommunityMembers,
  markAttendance,
  EventAttendeeWithProfile,
  CommunityMember,
} from '../eventService';

interface AttendanceModalProps {
  eventId: string;
  eventTitle: string;
  communityId: string | null;
  creatorId: string;
  onClose: () => void;
  onSaved: () => void;
}

const AttendanceModal: React.FC<AttendanceModalProps> = ({
  eventId,
  eventTitle,
  communityId,
  creatorId,
  onClose,
  onSaved,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [attendees, setAttendees] = useState<EventAttendeeWithProfile[]>([]);
  const [communityMembers, setCommunityMembers] = useState<CommunityMember[]>([]);
  const [attendanceChanges, setAttendanceChanges] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    loadData();
  }, [eventId, communityId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load existing attendees with attendance status
      const attendeesData = await getEventAttendeesWithAttendance(eventId);
      setAttendees(attendeesData);

      // Load all community members if community exists
      if (communityId) {
        const members = await getCommunityMembers(communityId);
        setCommunityMembers(members);
      }
    } catch (error) {
      console.error('Error loading attendance data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Merge attendees and community members into a unified list
  const allMembers = useMemo(() => {
    const memberMap = new Map<string, {
      id: string;
      name: string;
      email: string;
      avatar_url: string | null;
      isAttendee: boolean;
      attended: boolean;
    }>();

    // Add existing attendees first
    attendees.forEach(a => {
      memberMap.set(a.user_id, {
        id: a.user_id,
        name: a.profile.full_name || a.profile.email || 'Unknown',
        email: a.profile.email,
        avatar_url: a.profile.avatar_url,
        isAttendee: true,
        attended: attendanceChanges.has(a.user_id)
          ? attendanceChanges.get(a.user_id)!
          : a.attended,
      });
    });

    // Add community members who aren't already attendees
    communityMembers.forEach(m => {
      if (!memberMap.has(m.id)) {
        memberMap.set(m.id, {
          id: m.id,
          name: m.display_name,
          email: '',
          avatar_url: m.avatar_url,
          isAttendee: false,
          attended: attendanceChanges.has(m.id)
            ? attendanceChanges.get(m.id)!
            : false,
        });
      }
    });

    return Array.from(memberMap.values());
  }, [attendees, communityMembers, attendanceChanges]);

  // Filter members by search query
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return allMembers;

    const query = searchQuery.toLowerCase();
    return allMembers.filter(
      m => m.name.toLowerCase().includes(query) || m.email.toLowerCase().includes(query)
    );
  }, [allMembers, searchQuery]);

  const handleToggleAttendance = (userId: string, currentAttended: boolean) => {
    setAttendanceChanges(prev => {
      const newMap = new Map(prev);
      newMap.set(userId, !currentAttended);
      return newMap;
    });
  };

  const handleSave = async () => {
    if (attendanceChanges.size === 0) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      // Save all changes
      const promises = Array.from(attendanceChanges.entries()).map(([userId, attended]) =>
        markAttendance(eventId, userId, attended, creatorId)
      );

      await Promise.all(promises);
      onSaved();
      onClose();
    } catch (error) {
      console.error('Error saving attendance:', error);
    } finally {
      setSaving(false);
    }
  };

  const attendedCount = filteredMembers.filter(m => m.attended).length;
  const totalCount = filteredMembers.length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--fc-section,#0A0A0A)] rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-[var(--fc-section-border,#1F1F1F)]">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-lg font-bold text-[var(--fc-section-text,#FAFAFA)]">
                {t('calendar.attendance.modalTitle')}
              </h2>
              <p className="text-sm text-[var(--fc-section-muted,#666666)] mt-1">{eventTitle}</p>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-[var(--fc-section-hover,#1F1F1F)] rounded-full transition-colors"
            >
              <X size={20} className="text-[var(--fc-section-muted,#666666)]" />
            </button>
          </div>

          {/* Search */}
          <div className="mt-4 relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fc-section-muted,#666666)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('calendar.attendance.searchPlaceholder')}
              className="w-full pl-10 pr-4 py-2 border border-[var(--fc-section-border,#1F1F1F)] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-white/10"
            />
          </div>

          {/* Stats */}
          <div className="mt-4 flex gap-4 text-sm">
            <div className="flex items-center gap-1.5 text-[#22C55E]">
              <UserCheck size={16} />
              <span>{t('calendar.attendance.attendedCount', { count: attendedCount })}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[var(--fc-section-muted,#666666)]">
              <Users size={16} />
              <span>{t('calendar.attendance.totalCount', { count: totalCount })}</span>
            </div>
          </div>
        </div>

        {/* Member List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--fc-section-text,#FAFAFA)]" />
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="text-center py-12 text-[var(--fc-section-muted,#666666)]">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">
                {searchQuery
                  ? t('calendar.attendance.noSearchResults')
                  : t('calendar.attendance.noMembers')}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredMembers.map(member => (
                <button
                  key={member.id}
                  onClick={() => handleToggleAttendance(member.id, member.attended)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                    member.attended
                      ? 'bg-[#22C55E]/10 border-[#22C55E]/20 hover:bg-[#22C55E]/10'
                      : 'bg-[var(--fc-section,#0A0A0A)] border-[var(--fc-section-border,#1F1F1F)] hover:bg-[var(--fc-section,#0A0A0A)]'
                  }`}
                >
                  {/* Avatar */}
                  {member.avatar_url ? (
                    <img
                      src={member.avatar_url}
                      alt={member.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[var(--fc-section-hover,#1F1F1F)] flex items-center justify-center text-[var(--fc-section-muted,#666666)] font-semibold">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                  )}

                  {/* Name and status */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--fc-section-text,#FAFAFA)] truncate">{member.name}</p>
                    <p className="text-xs text-[var(--fc-section-muted,#666666)]">
                      {member.isAttendee
                        ? t('calendar.attendance.rsvpYes')
                        : t('calendar.attendance.rsvpNo')}
                    </p>
                  </div>

                  {/* Attendance checkbox */}
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                      member.attended
                        ? 'bg-[#22C55E] text-white'
                        : 'bg-[var(--fc-section-hover,#1F1F1F)] text-[var(--fc-section-muted,#666666)]'
                    }`}
                  >
                    {member.attended ? <Check size={14} /> : null}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--fc-section-border,#1F1F1F)] flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-[var(--fc-section-border,#1F1F1F)] text-[var(--fc-section-muted,#A0A0A0)] py-2.5 rounded-lg text-sm font-medium hover:bg-[var(--fc-section,#0A0A0A)] transition-colors"
          >
            {t('calendar.attendance.cancelButton')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || attendanceChanges.size === 0}
            className="flex-1 bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] py-2.5 rounded-lg text-sm font-medium hover:bg-[#E0E0E0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {t('calendar.attendance.savingButton')}
              </>
            ) : (
              t('calendar.attendance.saveButton')
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AttendanceModal;
