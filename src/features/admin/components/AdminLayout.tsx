import React, { useState } from 'react';
import AdminSidebar from './AdminSidebar';
import type { AdminSection } from '../types';

interface AdminLayoutProps {
  children: (activeSection: AdminSection, onSectionChange: (s: AdminSection) => void) => React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const [activeSection, setActiveSection] = useState<AdminSection>('overview');

  return (
    <div className="flex h-screen bg-[var(--fc-section,#0A0A0A)] font-sans text-[var(--fc-section-text,#FAFAFA)]">
      <AdminSidebar activeSection={activeSection} onSectionChange={setActiveSection} />
      <main className="flex-1 overflow-auto">
        {children(activeSection, setActiveSection)}
      </main>
    </div>
  );
};

export default AdminLayout;
