import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, GraduationCap, Calendar, BrainCircuit, Settings, LogOut, ClipboardList, Bot, UserCog, Tag, ClipboardCheck, MessageSquare, UserCircle, ShoppingBag } from 'lucide-react';
import { View } from '../core/types';
import { NAV_ITEMS, CREATOR_NAV_ITEMS, TEAM_MEMBER_NAV_ITEMS } from '../core/constants';
import { useAuth } from '../core/contexts/AuthContext';
import { useCommunity } from '../core/contexts/CommunityContext';
import CommunitySwitcher from './CommunitySwitcher';
import { Avatar } from './Avatar';
import { Logo } from './Logo';

// Map View enum to URL paths
const viewToPath: Record<View, string> = {
  [View.DASHBOARD]: '/dashboard',
  [View.COMMUNITY]: '/community',
  [View.COURSES]: '/courses',
  [View.HOMEWORK]: '/homework',
  [View.AI_CHAT]: '/ai-chat',
  [View.CALENDAR]: '/calendar',
  [View.AI_MANAGER]: '/ai-manager',
  [View.STUDENT_MANAGER]: '/student-manager',
  [View.SURVEYS]: '/surveys',
  [View.DISCOUNTS]: '/discounts',
  [View.SETTINGS]: '/settings',
  [View.MESSAGES]: '/messages',
  [View.MEMBERS]: '/members',
};

interface SidebarProps {
  currentView: View;
  setCurrentView: (view: View) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onBrowseCommunities?: () => void;
  onCreateCommunity?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView, isOpen, setIsOpen, onBrowseCommunities, onCreateCommunity }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { signOut, profile, role, teamMemberships, isTeamMemberOnly } = useAuth();
  const { selectedCommunity } = useCommunity();
  const isCreator = role === 'creator' || role === 'superadmin';

  // Check if user is a student (not creator)
  const isStudent = role === 'student' || role === 'member';

  // Get team role for display (if team member)
  const teamRole = teamMemberships && teamMemberships.length > 0 ? teamMemberships[0].role : null;
  const teamTitle = teamMemberships && teamMemberships.length > 0 ? teamMemberships[0].title : null;

  const iconMap: Record<string, React.ReactNode> = {
    'LayoutDashboard': <LayoutDashboard size={20} />,
    'Users': <Users size={20} />,
    'GraduationCap': <GraduationCap size={20} />,
    'Calendar': <Calendar size={20} />,
    'BrainCircuit': <BrainCircuit size={20} />,
    'ClipboardList': <ClipboardList size={20} />,
    'Bot': <Bot size={20} />,
    'UserCog': <UserCog size={20} />,
    'ClipboardCheck': <ClipboardCheck size={20} />,
    'Tag': <Tag size={20} />,
    'MessageSquare': <MessageSquare size={20} />,
    'UserCircle': <UserCircle size={20} />,
  };

  // Translation key map for nav items
  const labelTranslationMap: Record<View, string> = {
    [View.DASHBOARD]: 'sidebar.dashboard',
    [View.COMMUNITY]: 'sidebar.community',
    [View.COURSES]: 'sidebar.courses',
    [View.HOMEWORK]: 'sidebar.homework',
    [View.AI_CHAT]: 'sidebar.aiChat',
    [View.CALENDAR]: 'sidebar.calendar',
    [View.AI_MANAGER]: 'sidebar.aiManager',
    [View.STUDENT_MANAGER]: 'sidebar.studentManager',
    [View.SURVEYS]: 'sidebar.surveys',
    [View.DISCOUNTS]: 'sidebar.discounts',
    [View.SETTINGS]: 'sidebar.settings',
    [View.MESSAGES]: 'sidebar.messages',
    [View.MEMBERS]: 'sidebar.members',
  };

  // Filter and modify nav items based on role
  const getNavItems = () => {
    // Team-only users get the team member nav items (AI Manager only for lecturers)
    if (isTeamMemberOnly) {
      const teamRole = teamMemberships?.[0]?.role;
      return TEAM_MEMBER_NAV_ITEMS.filter(item => {
        if (item.id === View.AI_MANAGER && teamRole !== 'lecturer') return false;
        return true;
      });
    }

    const baseItems = NAV_ITEMS
      .filter(item => {
        // Hide AI Success Manager for students
        if (isStudent && item.id === View.AI_MANAGER) return false;
        return true;
      });

    // Add creator-only nav items for creators
    if (isCreator) {
      return [...baseItems, ...CREATOR_NAV_ITEMS];
    }

    return baseItems;
  };

  const handleSignOut = async () => {
    await signOut();
  };

  // Get display text for team role
  const getTeamRoleDisplay = () => {
    if (!teamRole) return null;
    const roleKey = `team.roles.${teamRole}`;
    return t(roleKey);
  };

  return (
    <>
      {/* Mobile Overlay */}
      <div
        className={`fixed inset-0 bg-black/50 z-20 transition-opacity lg:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsOpen(false)}
      />

      {/* Sidebar */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-30 w-64 bg-[var(--fc-surface,#0A0A0A)] border-r border-[var(--fc-border,#1F1F1F)] text-[var(--fc-surface-text,#FAFAFA)] transform transition-transform duration-200 ease-in-out flex flex-col
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Header */}
        <div className="h-16 flex items-center px-6 border-b border-[var(--fc-border,#1F1F1F)]">
          <Logo variant="light" size="lg" showText={false} />
        </div>

        {/* Community Selector */}
        {!isTeamMemberOnly ? (
          <div className="px-4 pt-4 pb-2">
            <CommunitySwitcher
              onBrowseMore={() => {
                if (onBrowseCommunities) {
                  onBrowseCommunities();
                }
                setIsOpen(false);
              }}
              onCreateCommunity={() => {
                setCurrentView(View.COMMUNITY);
                if (onCreateCommunity) {
                  onCreateCommunity();
                }
                setIsOpen(false);
              }}
            />
          </div>
        ) : (
          <div className="px-4 pt-4 pb-2">
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[var(--fc-surface-hover,#151515)]">
              <div className="w-7 h-7 rounded-md bg-[#333333] flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-[var(--fc-surface-text,#FAFAFA)]">
                  {(selectedCommunity?.name || teamMemberships?.[0]?.communityName || 'C').charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--fc-surface-text,#FAFAFA)] truncate">
                  {selectedCommunity?.name || teamMemberships?.[0]?.communityName || 'Community'}
                </p>
                {teamRole && (
                  <p className="text-xs font-medium text-[var(--fc-surface-muted,#A0A0A0)]">
                    {getTeamRoleDisplay()}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-1">
          {getNavItems().map((item) => (
            <button
              key={item.id}
              onClick={() => {
                navigate(viewToPath[item.id]);
                setCurrentView(item.id);
                setIsOpen(false);
              }}
              className={`
                w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors
                ${currentView === item.id
                  ? 'bg-[var(--fc-surface-hover,#151515)] text-[var(--fc-surface-text,#FAFAFA)] border-l-2 border-[var(--fc-surface-text,#FAFAFA)]'
                  : 'text-[var(--fc-surface-muted,#A0A0A0)] hover:bg-[var(--fc-surface-hover,#151515)] hover:text-[var(--fc-surface-text,#FAFAFA)]'}
              `}
            >
              {iconMap[item.icon]}
              {t(labelTranslationMap[item.id] || item.label)}
            </button>
          ))}

          {/* Shop — only when enabled */}
          {selectedCommunity?.shop_enabled && (
            <button
              onClick={() => {
                navigate('/shop');
                setCurrentView(View.SHOP);
                setIsOpen(false);
              }}
              className={`
                w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors
                ${currentView === View.SHOP
                  ? 'bg-[var(--fc-surface-hover,#151515)] text-[var(--fc-surface-text,#FAFAFA)] border-l-2 border-[var(--fc-surface-text,#FAFAFA)]'
                  : 'text-[var(--fc-surface-muted,#A0A0A0)] hover:bg-[var(--fc-surface-hover,#151515)] hover:text-[var(--fc-surface-text,#FAFAFA)]'}
              `}
            >
              <ShoppingBag size={20} />
              {t('sidebar.shop', { defaultValue: 'Магазин' })}
            </button>
          )}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--fc-border,#1F1F1F)] space-y-2">
          <button
            onClick={() => {
              navigate('/settings');
              setCurrentView(View.SETTINGS);
              setIsOpen(false);
            }}
            className={`
              w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors
              ${currentView === View.SETTINGS
                ? 'bg-[var(--fc-surface-hover,#151515)] text-[var(--fc-surface-text,#FAFAFA)] border-l-2 border-[var(--fc-surface-text,#FAFAFA)]'
                : 'text-[var(--fc-surface-muted,#A0A0A0)] hover:text-[var(--fc-surface-text,#FAFAFA)] hover:bg-[var(--fc-surface-hover,#151515)]'}
            `}
          >
            <Settings size={20} />
            {t('sidebar.settings')}
          </button>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-3 text-[var(--fc-surface-muted,#A0A0A0)] hover:text-[#EF4444] hover:bg-[var(--fc-surface-hover,#151515)] rounded-lg text-sm font-medium transition-colors"
          >
            <LogOut size={20} />
            {t('common.logout')}
          </button>
          <div className="mt-4 flex items-center gap-3 px-4">
            <Avatar
              src={profile?.avatar_url}
              name={profile?.full_name}
              size="sm"
              className="border border-[#333333]"
            />
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate">{profile?.full_name || 'User'}</p>
              <p className="text-xs text-[var(--fc-surface-muted,#666666)] truncate">
                {isCreator ? (profile?.role || 'creator') : (isTeamMemberOnly ? (teamTitle || getTeamRoleDisplay()) : (profile?.role || 'Member'))}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
