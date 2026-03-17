import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, GraduationCap, Euro, Building2, ArrowLeft } from 'lucide-react';
import { Logo } from '../../../shared/Logo';
import type { AdminSection } from '../types';

interface AdminSidebarProps {
  activeSection: AdminSection;
  onSectionChange: (section: AdminSection) => void;
}

const sections: { id: AdminSection; icon: React.ElementType; labelKey: string }[] = [
  { id: 'overview', icon: LayoutDashboard, labelKey: 'admin.sections.overview' },
  { id: 'creators', icon: Users, labelKey: 'admin.sections.creators' },
  { id: 'students', icon: GraduationCap, labelKey: 'admin.sections.students' },
  { id: 'revenue', icon: Euro, labelKey: 'admin.sections.revenue' },
  { id: 'communities', icon: Building2, labelKey: 'admin.sections.communities' },
];

const AdminSidebar: React.FC<AdminSidebarProps> = ({ activeSection, onSectionChange }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="w-64 bg-[#0A0A0A] border-r border-[#1F1F1F] flex flex-col h-full shrink-0">
      {/* Header */}
      <div className="h-16 flex items-center px-6 border-b border-[#1F1F1F]">
        <Logo variant="light" size="lg" showText={false} />
        <span className="ml-3 text-sm font-semibold text-[#FAFAFA] tracking-wide uppercase">
          {t('admin.title')}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1">
        {sections.map(({ id, icon: Icon, labelKey }) => (
          <button
            key={id}
            onClick={() => onSectionChange(id)}
            className={`
              w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors
              ${activeSection === id
                ? 'bg-[#151515] text-[#FAFAFA] border-l-2 border-white'
                : 'text-[#A0A0A0] hover:bg-[#151515] hover:text-[#FAFAFA]'}
            `}
          >
            <Icon size={20} />
            {t(labelKey)}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-[#1F1F1F]">
        <button
          onClick={() => navigate('/dashboard')}
          className="w-full flex items-center gap-3 px-4 py-3 text-[#A0A0A0] hover:text-[#FAFAFA] hover:bg-[#151515] rounded-lg text-sm font-medium transition-colors"
        >
          <ArrowLeft size={20} />
          {t('admin.backToDashboard')}
        </button>
      </div>
    </div>
  );
};

export default AdminSidebar;
