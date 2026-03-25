import React from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, GraduationCap, ClipboardList, Users, Menu } from 'lucide-react';
import { View } from '../core/types';

interface MobileBottomNavProps {
  currentView: View;
  onNavigate: (view: View) => void;
  onOpenMenu: () => void;
}

const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ currentView, onNavigate, onOpenMenu }) => {
  const { t } = useTranslation();

  const tabs = [
    { view: View.DASHBOARD, icon: LayoutDashboard, label: t('sidebar.dashboard') },
    { view: View.COURSES, icon: GraduationCap, label: t('sidebar.courses') },
    { view: View.HOMEWORK, icon: ClipboardList, label: t('sidebar.homework') },
    { view: View.COMMUNITY, icon: Users, label: t('sidebar.community') },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--fc-surface,#0A0A0A)] border-t border-[var(--fc-border,#1F1F1F)] safe-area-bottom">
      <div className="flex items-stretch">
        {tabs.map(({ view, icon: Icon, label }) => {
          const isActive = currentView === view;
          return (
            <button
              key={view}
              onClick={() => onNavigate(view)}
              className={`
                flex-1 flex flex-col items-center justify-center gap-0.5 py-2 pt-2.5 transition-colors relative
                ${isActive ? 'text-white' : 'text-[var(--fc-muted,#666666)] active:text-[#999999]'}
              `}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-white rounded-full" />
              )}
              <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
              <span className="text-[10px] font-medium leading-tight truncate max-w-[64px]">{label}</span>
            </button>
          );
        })}
        {/* More / Menu button */}
        <button
          onClick={onOpenMenu}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 pt-2.5 text-[var(--fc-muted,#666666)] active:text-[#999999] transition-colors"
        >
          <Menu size={20} strokeWidth={1.5} />
          <span className="text-[10px] font-medium leading-tight truncate max-w-[64px]">{t('mobileNav.more')}</span>
        </button>
      </div>
    </nav>
  );
};

export default MobileBottomNav;
