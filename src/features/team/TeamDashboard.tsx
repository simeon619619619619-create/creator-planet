import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, GraduationCap, Calendar, User, ChevronRight, Mail, AlertTriangle, BrainCircuit } from 'lucide-react';
import { useAuth } from '../../core/contexts/AuthContext';
import { useCommunity } from '../../core/contexts/CommunityContext';
import { Avatar } from '../../shared/Avatar';
import { getTeamMemberConversations } from '../direct-messages/dmService';
import { ConversationWithDetails } from '../direct-messages/dmTypes';
import { getAtRiskStudents, AtRiskStudent } from '../dashboard/dashboardService';
import { supabase } from '../../core/supabase/client';

interface UpcomingEvent {
  id: string;
  title: string;
  start_time: string;
  event_type: string;
}

interface CourseInfo {
  id: string;
  title: string;
  thumbnail_url: string | null;
}

const TeamDashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile, teamMemberships } = useAuth();
  const { selectedCommunity } = useCommunity();

  const [recentConversations, setRecentConversations] = useState<ConversationWithDetails[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [courses, setCourses] = useState<CourseInfo[]>([]);
  const [atRiskStudents, setAtRiskStudents] = useState<AtRiskStudent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const teamMembership = teamMemberships?.[0];
  const teamRole = teamMembership?.role;

  useEffect(() => {
    if (!profile?.id || !selectedCommunity?.id || !teamMembership?.teamMemberId) return;

    const loadDashboardData = async () => {
      setIsLoading(true);
      try {
        // Load recent conversations
        const conversations = await getTeamMemberConversations(teamMembership.teamMemberId);
        const recent = conversations.slice(0, 3);
        setRecentConversations(recent);
        // Count unread
        const unread = conversations.reduce((sum, conv) => sum + (conv.unread_count_team || 0), 0);
        setUnreadCount(unread);

        // Load upcoming events (next 3)
        const { data: eventsData } = await supabase
          .from('events')
          .select('id, title, start_time, event_type')
          .eq('community_id', selectedCommunity.id)
          .gte('start_time', new Date().toISOString())
          .order('start_time', { ascending: true })
          .limit(3);

        if (eventsData) {
          setUpcomingEvents(eventsData);
        }

        // Load courses for lecturers (courses they created)
        if (teamRole === 'lecturer' && profile.id) {
          const { data: coursesData } = await supabase
            .from('courses')
            .select('id, title, thumbnail_url')
            .eq('community_id', selectedCommunity.id)
            .eq('creator_id', profile.id)
            .limit(4);

          if (coursesData) {
            setCourses(coursesData);
          }

          // Load at-risk students using community creator's ID
          try {
            const riskData = await getAtRiskStudents(selectedCommunity.creator_id, selectedCommunity.id);
            setAtRiskStudents(riskData.slice(0, 5));
          } catch (err) {
            console.error('Error loading at-risk students:', err);
          }
        }
      } catch (error) {
        console.error('Error loading team dashboard:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, [profile?.id, selectedCommunity?.id, teamMembership?.teamMemberId, teamRole]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatRelativeTime = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) return t('common.minutesAgo', { count: diffMins });
    if (diffHours < 24) return t('common.hoursAgo', { count: diffHours });
    return t('common.daysAgo', { count: diffDays });
  };

  const getRoleBadgeColor = () => {
    switch (teamRole) {
      case 'lecturer':
        return 'bg-[#1F1F1F] text-[#A0A0A0]';
      case 'assistant':
        return 'bg-[#22C55E]/10 text-[#22C55E]';
      case 'guest_expert':
        return 'bg-[#EAB308]/10 text-[#EAB308]';
      default:
        return 'bg-[#1F1F1F] text-[#A0A0A0]';
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-[#1F1F1F] rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-48 bg-[#1F1F1F] rounded-xl"></div>
            <div className="h-48 bg-[#1F1F1F] rounded-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#FAFAFA]">
          {t('teamDashboard.welcome', { name: profile?.full_name?.split(' ')[0] || 'Team Member' })}
        </h1>
        <p className="text-[#A0A0A0] mt-1">
          {t('teamDashboard.roleAt', { role: t(`team.roles.${teamRole}`), community: selectedCommunity?.name })}
        </p>
      </div>

      {/* Dashboard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Messages Card */}
        <div className="bg-[#0A0A0A] rounded-xl border border-[#1F1F1F] overflow-hidden">
          <div className="p-4 border-b border-[#1F1F1F] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#FAFAFA]" />
              <h2 className="font-semibold text-[#FAFAFA]">{t('teamDashboard.messages')}</h2>
              {unreadCount > 0 && (
                <span className="bg-[#EF4444] text-white text-xs font-medium px-2 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            <button
              onClick={() => navigate('/messages')}
              className="text-sm text-[#FAFAFA] hover:text-white flex items-center gap-1"
            >
              {t('teamDashboard.viewAll')}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="divide-y divide-[#1F1F1F]">
            {recentConversations.length === 0 ? (
              <div className="p-6 text-center">
                <Mail className="w-10 h-10 text-[#A0A0A0] mx-auto mb-2" />
                <p className="text-sm text-[#666666]">{t('teamDashboard.noMessages')}</p>
              </div>
            ) : (
              recentConversations.map((conv) => {
                const hasUnread = (conv.unread_count_team || 0) > 0;
                const studentName = conv.student?.full_name || 'Student';
                const studentAvatar = conv.student?.avatar_url || null;
                return (
                  <div
                    key={conv.id}
                    className="p-4 hover:bg-[#0A0A0A] cursor-pointer transition-colors"
                    onClick={() => navigate('/messages')}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar
                        src={studentAvatar}
                        name={studentName}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={`text-sm font-medium truncate ${hasUnread ? 'text-[#FAFAFA]' : 'text-[#A0A0A0]'}`}>
                            {studentName}
                          </p>
                          <span className="text-xs text-[#666666] shrink-0 ml-2">
                            {formatRelativeTime(conv.last_message_at)}
                          </span>
                        </div>
                        <p className={`text-sm truncate ${hasUnread ? 'text-[#A0A0A0]' : 'text-[#666666]'}`}>
                          {conv.last_message?.content || t('teamDashboard.noMessageYet')}
                        </p>
                      </div>
                      {hasUnread && (
                        <div className="w-2 h-2 bg-white rounded-full shrink-0 mt-2"></div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Courses Card (for lecturers) */}
        {teamRole === 'lecturer' && (
          <div className="bg-[#0A0A0A] rounded-xl border border-[#1F1F1F] overflow-hidden">
            <div className="p-4 border-b border-[#1F1F1F] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-[#22C55E]" />
                <h2 className="font-semibold text-[#FAFAFA]">{t('teamDashboard.yourCourses')}</h2>
              </div>
              <button
                onClick={() => navigate('/courses')}
                className="text-sm text-[#FAFAFA] hover:text-white flex items-center gap-1"
              >
                {t('teamDashboard.viewAll')}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4">
              {courses.length === 0 ? (
                <div className="text-center py-4">
                  <GraduationCap className="w-10 h-10 text-[#A0A0A0] mx-auto mb-2" />
                  <p className="text-sm text-[#666666]">{t('teamDashboard.noCourses')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {courses.map((course) => (
                    <div
                      key={course.id}
                      className="bg-[#0A0A0A] rounded-lg p-3 hover:bg-[#1F1F1F] cursor-pointer transition-colors"
                      onClick={() => navigate('/courses')}
                    >
                      {course.thumbnail_url ? (
                        <img
                          src={course.thumbnail_url}
                          alt={course.title}
                          className="w-full h-16 object-cover rounded mb-2"
                        />
                      ) : (
                        <div className="w-full h-16 bg-[#1F1F1F] rounded mb-2 flex items-center justify-center">
                          <GraduationCap className="w-6 h-6 text-[#666666]" />
                        </div>
                      )}
                      <p className="text-sm font-medium text-[#A0A0A0] truncate">{course.title}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* At-Risk Students Card (for lecturers) */}
        {teamRole === 'lecturer' && (
          <div className="bg-[#0A0A0A] rounded-xl border border-[#1F1F1F] overflow-hidden">
            <div className="p-4 border-b border-[#1F1F1F] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-[#EF4444]" />
                <h2 className="font-semibold text-[#FAFAFA]">{t('teamDashboard.atRiskStudents')}</h2>
                {atRiskStudents.length > 0 && (
                  <span className="bg-[#EF4444]/10 text-[#EF4444] text-xs font-medium px-2 py-0.5 rounded-full">
                    {atRiskStudents.length}
                  </span>
                )}
              </div>
              <button
                onClick={() => navigate('/ai-manager')}
                className="text-sm text-[#FAFAFA] hover:text-white flex items-center gap-1"
              >
                <BrainCircuit className="w-4 h-4" />
                {t('teamDashboard.viewAll')}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="divide-y divide-[#1F1F1F]">
              {atRiskStudents.length === 0 ? (
                <div className="p-6 text-center">
                  <AlertTriangle className="w-10 h-10 text-[#A0A0A0] mx-auto mb-2" />
                  <p className="text-sm text-[#666666]">{t('teamDashboard.noAtRiskStudents')}</p>
                </div>
              ) : (
                atRiskStudents.map((student) => (
                  <div key={student.user_id} className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar src={student.avatar_url} name={student.name} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#FAFAFA] truncate">{student.name}</p>
                        <p className="text-xs text-[#666666] truncate">{student.reason}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          student.risk_score >= 70 ? 'bg-[#EF4444]/10 text-[#EF4444]' :
                          student.risk_score >= 40 ? 'bg-[#EAB308]/10 text-[#EAB308]' :
                          'bg-[#22C55E]/10 text-[#22C55E]'
                        }`}>
                          {student.risk_score}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Upcoming Events Card */}
        <div className={`bg-[#0A0A0A] rounded-xl border border-[#1F1F1F] overflow-hidden ${teamRole !== 'lecturer' ? '' : ''}`}>
          <div className="p-4 border-b border-[#1F1F1F] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#EAB308]" />
              <h2 className="font-semibold text-[#FAFAFA]">{t('teamDashboard.upcomingEvents')}</h2>
            </div>
            <button
              onClick={() => navigate('/calendar')}
              className="text-sm text-[#FAFAFA] hover:text-white flex items-center gap-1"
            >
              {t('teamDashboard.viewCalendar')}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="divide-y divide-[#1F1F1F]">
            {upcomingEvents.length === 0 ? (
              <div className="p-6 text-center">
                <Calendar className="w-10 h-10 text-[#A0A0A0] mx-auto mb-2" />
                <p className="text-sm text-[#666666]">{t('teamDashboard.noEvents')}</p>
              </div>
            ) : (
              upcomingEvents.map((event) => (
                <div
                  key={event.id}
                  className="p-4 hover:bg-[#0A0A0A] cursor-pointer transition-colors"
                  onClick={() => navigate('/calendar')}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-[#FAFAFA]">{event.title}</p>
                      <p className="text-xs text-[#666666]">{formatDate(event.start_time)}</p>
                    </div>
                    <span className="text-xs bg-[#EAB308]/10 text-[#EAB308] px-2 py-1 rounded-full">
                      {event.event_type}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Profile Card */}
        <div className="bg-[#0A0A0A] rounded-xl border border-[#1F1F1F] overflow-hidden">
          <div className="p-4 border-b border-[#1F1F1F] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-[#A0A0A0]" />
              <h2 className="font-semibold text-[#FAFAFA]">{t('teamDashboard.yourProfile')}</h2>
            </div>
            <button
              onClick={() => navigate('/settings')}
              className="text-sm text-[#FAFAFA] hover:text-white flex items-center gap-1"
            >
              {t('teamDashboard.editProfile')}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="p-6">
            <div className="flex items-center gap-4">
              <Avatar
                src={profile?.avatar_url}
                name={profile?.full_name}
                size="lg"
              />
              <div>
                <h3 className="text-lg font-semibold text-[#FAFAFA]">{profile?.full_name}</h3>
                <p className="text-sm text-[#666666]">{teamMembership?.title || t(`team.roles.${teamRole}`)}</p>
                <span className={`inline-block mt-2 px-2 py-0.5 text-xs font-medium rounded-full ${getRoleBadgeColor()}`}>
                  {t(`team.roles.${teamRole}`)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamDashboard;
