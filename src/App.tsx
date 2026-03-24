import React, { Suspense, useState, useCallback, useEffect, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu } from 'lucide-react';
import { AuthProvider, useAuth } from './core/contexts/AuthContext';
import { CommunityProvider } from './core/contexts/CommunityContext';
import { Logo } from './shared/Logo';
import ProtectedRoute from './public-pages/auth/ProtectedRoute';
import Sidebar from './shared/Sidebar';
import MobileBottomNav from './shared/MobileBottomNav';
import { View, UserRole } from './core/types';
import { canGradeHomework } from './features/team/teamPermissions';
import { useCommunity } from './core/contexts/CommunityContext';
import BackgroundElements from './features/community/components/BackgroundElements';
import WalletBalance from './features/wallet/WalletBalance';
import { computeThemeVars } from './core/utils/colorContrast';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './core/queryClient';

// Public pages (lazy-loaded)
// AdminPanel removed - had hardcoded credentials
const LandingPage = React.lazy(() => import('./public-pages/LandingPage'));
const MarketingLandingPage = React.lazy(() => import('./public-pages/MarketingLandingPage'));
const WhopLandingPage = React.lazy(() => import('./public-pages/WhopLandingPage'));
const CommunityLandingPage = React.lazy(() => import('./public-pages/communities/CommunityLandingPage').then(m => ({ default: m.CommunityLandingPage })));
const CommunitiesDirectory = React.lazy(() => import('./public-pages/communities/CommunitiesDirectory').then(m => ({ default: m.CommunitiesDirectory })));
const CourseCatalogPage = React.lazy(() => import('./features/landing').then(m => ({ default: m.LandingPage })));
const TeamInvitePage = React.lazy(() => import('./public-pages/invite/TeamInvitePage'));
const TBIStatusPage = React.lazy(() => import('./features/billing/pages/TBIStatusPage'));
const TrackingPage = React.lazy(() => import('./features/tracking/TrackingPage'));

// Auth pages (lazy-loaded)
const LoginPage = React.lazy(() => import('./features/auth').then(m => ({ default: m.LoginPage })));
const SignupPage = React.lazy(() => import('./features/auth').then(m => ({ default: m.SignupPage })));
const ResetPasswordPage = React.lazy(() => import('./features/auth').then(m => ({ default: m.ResetPasswordPage })));

// Billing pages (lazy-loaded)
const PricingPage = React.lazy(() => import('./features/billing').then(m => ({ default: m.PricingPage })));
const OnboardingPage = React.lazy(() => import('./features/billing').then(m => ({ default: m.OnboardingPage })));

// Other public pages (lazy-loaded)
const DwyPackagesPage = React.lazy(() => import('./features/dwyPackages').then(m => ({ default: m.DwyPackagesPage })));
const CreatorOnboardingPage = React.lazy(() => import('./features/creator-onboarding').then(m => ({ default: m.CreatorOnboardingPage })));
const StudentOnboardingPage = React.lazy(() => import('./features/student-onboarding').then(m => ({ default: m.StudentOnboardingPage })));

// Protected pages (lazy-loaded)
const Dashboard = React.lazy(() => import('./features/dashboard/Dashboard'));
const StudentHome = React.lazy(() => import('./features/student/StudentHome'));
const CommunityHub = React.lazy(() => import('./features/community/CommunityHub'));
const CourseLMS = React.lazy(() => import('./features/courses/CourseLMS'));
const CalendarView = React.lazy(() => import('./features/calendar/CalendarView'));
const AiSuccessManager = React.lazy(() => import('./features/ai-manager/AiSuccessManager'));
const Settings = React.lazy(() => import('./features/settings/Settings'));
const HomeworkPage = React.lazy(() => import('./features/homework/HomeworkPage'));
const HomeworkManagement = React.lazy(() => import('./features/homework/HomeworkManagement'));
const ChatbotsPage = React.lazy(() => import('./features/chatbots/ChatbotsPage'));
const StudentManagerPage = React.lazy(() => import('./features/student-manager').then(m => ({ default: m.StudentManagerPage })));
const DiscountsPage = React.lazy(() => import('./features/discounts/DiscountsPage').then(m => ({ default: m.DiscountsPage })));
const SurveyList = React.lazy(() => import('./features/surveys').then(m => ({ default: m.SurveyList })));
const TeamProfilePage = React.lazy(() => import('./features/direct-messages/pages/TeamProfilePage'));
const TeamDashboard = React.lazy(() => import('./features/team/TeamDashboard'));
const TeamInboxPage = React.lazy(() => import('./features/team/TeamInboxPage'));
const CommunityMessagesPage = React.lazy(() => import('./features/direct-messages/pages/CommunityMessagesPage'));
const TeamMembersPage = React.lazy(() => import('./features/team/TeamMembersPage'));
const AdminDashboard = React.lazy(() => import('./features/admin/pages/AdminDashboard'));
const ShopPage = React.lazy(() => import('./features/shop/ShopPage'));

// Loading component
const LoadingScreen: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0A0A0A]">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-[#FAFAFA] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[#A0A0A0]">{t('loading.foundersClub')}</p>
      </div>
    </div>
  );
};

// Map URL path to View enum
const pathToView = (pathname: string): View => {
  if (pathname.includes('/dashboard') || pathname === '/app') {
    return View.DASHBOARD;
  }
  if (pathname.includes('/community') && !pathname.includes('/communities')) {
    return View.COMMUNITY;
  }
  if (pathname.includes('/courses')) {
    return View.COURSES;
  }
  if (pathname.includes('/homework')) {
    return View.HOMEWORK;
  }
  if (pathname.includes('/ai-chat')) {
    return View.AI_CHAT;
  }
  if (pathname.includes('/calendar')) {
    return View.CALENDAR;
  }
  if (pathname.includes('/ai-manager')) {
    return View.AI_MANAGER;
  }
  if (pathname.includes('/student-manager')) {
    return View.STUDENT_MANAGER;
  }
  if (pathname.includes('/surveys')) {
    return View.SURVEYS;
  }
  if (pathname.includes('/discounts')) {
    return View.DISCOUNTS;
  }
  if (pathname.includes('/shop')) {
    return View.SHOP;
  }
  if (pathname.includes('/settings')) {
    return View.SETTINGS;
  }
  if (pathname.includes('/messages')) {
    return View.MESSAGES;
  }
  if (pathname.includes('/members')) {
    return View.MEMBERS;
  }
  return View.DASHBOARD;
};

// Protected App Layout with Sidebar and View Switching
const AppLayout: React.FC = () => {
  const { role, profile, isTeamMemberOnly, teamMemberships } = useAuth();
  const { selectedCommunity } = useCommunity();
  const navigate = useNavigate();
  const location = useLocation();

  // Compute themed CSS variables with auto-contrast
  const themeVars = useMemo(() => computeThemeVars({
    themeColor: selectedCommunity?.theme_color,
    textColor: selectedCommunity?.text_color,
    secondaryColor: selectedCommunity?.secondary_color,
    accentColor: selectedCommunity?.accent_color,
    sectionColor: selectedCommunity?.section_color,
    buttonColor: selectedCommunity?.button_color,
  }), [selectedCommunity?.theme_color, selectedCommunity?.text_color, selectedCommunity?.secondary_color, selectedCommunity?.accent_color, selectedCommunity?.section_color, selectedCommunity?.button_color]);

  // Check if current user is the creator of the selected community
  const isCreatorOfCommunity = !!(
    selectedCommunity &&
    profile?.id &&
    selectedCommunity.creator_id === profile.id
  );

  // Check if current user can manage homework (creator or team member)
  const canManageHomework = isCreatorOfCommunity || (
    selectedCommunity && canGradeHomework(role, selectedCommunity.id, teamMemberships)
  );

  // Initialize view based on current URL
  const [currentView, setCurrentView] = useState<View>(() => pathToView(location.pathname));
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showCreateCommunityModal, setShowCreateCommunityModal] = useState(false);

  // Sync view with URL changes
  useEffect(() => {
    const newView = pathToView(location.pathname);
    if (newView !== currentView) {
      setCurrentView(newView);
    }
  }, [location.pathname]);

  // Check if user is a student (not creator)
  const isStudent = role === 'student' || role === 'member';

  // Helper to convert view string to View enum and navigate
  const handleStudentNavigate = (view: string) => {
    switch (view) {
      case 'community':
        navigate('/community');
        setCurrentView(View.COMMUNITY);
        break;
      case 'courses':
        navigate('/courses');
        setCurrentView(View.COURSES);
        break;
      case 'calendar':
        navigate('/calendar');
        setCurrentView(View.CALENDAR);
        break;
      case 'settings':
        navigate('/settings');
        setCurrentView(View.SETTINGS);
        break;
      default:
        navigate('/dashboard');
        setCurrentView(View.DASHBOARD);
    }
  };

  // Handler for "Browse More" - navigate to communities directory
  const handleBrowseCommunities = useCallback(() => {
    navigate('/communities');
  }, [navigate]);

  // Handler for "Create Community" - open the create community modal in CommunityHub
  const handleCreateCommunity = useCallback(() => {
    setCurrentView(View.COMMUNITY);
    setShowCreateCommunityModal(true);
  }, []);

  // Handler for "Manage Chatbots" - navigate to Settings where chatbot management lives
  const handleManageChatbots = useCallback(() => {
    setCurrentView(View.SETTINGS);
    // The Chatbots tab is visible in Settings for creators with a community
  }, []);

  const renderContent = () => {
    switch (currentView) {
      case View.DASHBOARD:
        // Team-only users see TeamDashboard, students see StudentHome, creators see Dashboard
        if (isTeamMemberOnly) {
          return <TeamDashboard />;
        }
        return isStudent ? (
          <StudentHome onNavigate={handleStudentNavigate} />
        ) : (
          <Dashboard />
        );
      case View.COMMUNITY:
        return (
          <CommunityHub
            showCreateModal={showCreateCommunityModal}
            onCloseCreateModal={() => setShowCreateCommunityModal(false)}
          />
        );
      case View.COURSES:
        return <CourseLMS />;
      case View.HOMEWORK:
        // Creators and team members see homework management, students see homework page
        if (!selectedCommunity) {
          return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
              <div className="w-16 h-16 bg-[#1F1F1F] rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-[#666]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </div>
              <p className="text-[#A0A0A0] mb-4">{t('common.selectCommunityFirst') || 'Изберете общност от менюто вляво.'}</p>
            </div>
          );
        }
        return canManageHomework ? (
          <HomeworkManagement
            communityId={selectedCommunity.id}
            creatorProfileId={profile?.id ?? ''}
          />
        ) : (
          <HomeworkPage communityId={selectedCommunity.id} />
        );
      case View.AI_CHAT:
        // AI Chatbots page - available to all users
        if (!selectedCommunity) {
          return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
              <div className="w-16 h-16 bg-[#1F1F1F] rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-[#666]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </div>
              <p className="text-[#A0A0A0] mb-4">{t('common.selectCommunityFirst') || 'Изберете общност от менюто вляво.'}</p>
            </div>
          );
        }
        return <ChatbotsPage communityId={selectedCommunity.id} onManageChatbots={handleManageChatbots} />;
      case View.CALENDAR:
        return <CalendarView />;
      case View.AI_MANAGER:
        return <AiSuccessManager />;
      case View.STUDENT_MANAGER:
        // Student Manager - creators only (shows all students across all communities)
        if (role !== 'creator') {
          return <div className="p-8 text-center text-[#A0A0A0]">Access restricted to creators.</div>;
        }
        if (!profile?.id) {
          return <div className="p-8 text-center text-[#A0A0A0]">Profile not found.</div>;
        }
        return <StudentManagerPage creatorId={profile.id} />;
      case View.DISCOUNTS:
        // Discounts page - creators only
        if (role !== 'creator') {
          return <div className="p-8 text-center text-[#A0A0A0]">Access restricted to creators.</div>;
        }
        return <DiscountsPage />;
      case View.SURVEYS:
        // Surveys page - creators only
        if (role !== 'creator') {
          return <div className="p-8 text-center text-[#A0A0A0]">Access restricted to creators.</div>;
        }
        if (!profile?.id) {
          return <div className="p-8 text-center text-[#A0A0A0]">Profile not found.</div>;
        }
        return <SurveyList creatorId={profile.id} />;
      case View.SHOP:
        return <ShopPage />;
      case View.SETTINGS:
        return <Settings />;
      case View.MESSAGES:
        return <CommunityMessagesPage />;
      case View.MEMBERS:
        // Team member view of community members
        if (!selectedCommunity) {
          return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
              <div className="w-16 h-16 bg-[#1F1F1F] rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-[#666]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </div>
              <p className="text-[#A0A0A0] mb-4">{t('common.selectCommunityFirst') || 'Изберете общност от менюто вляво.'}</p>
            </div>
          );
        }
        return <TeamMembersPage communityId={selectedCommunity.id} />;
      default:
        return <div className="p-8 text-center text-[#A0A0A0]">Section under construction for MVP.</div>;
    }
  };

  const handleBottomNavNavigate = useCallback((view: View) => {
    const paths: Record<View, string> = {
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
      [View.SHOP]: '/shop',
    };
    navigate(paths[view]);
    setCurrentView(view);
  }, [navigate]);

  return (
    <div
      className="flex h-screen font-sans"
      style={{
        backgroundColor: selectedCommunity?.theme_color || '#0A0A0A',
        color: selectedCommunity?.text_color || themeVars['--fc-bg-text'],
        ...themeVars,
      } as React.CSSProperties}
    >
      {selectedCommunity?.background_elements && selectedCommunity.background_elements.length > 0 && (
        <BackgroundElements elements={selectedCommunity.background_elements} />
      )}
      <Sidebar
        currentView={currentView}
        setCurrentView={setCurrentView}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        onBrowseCommunities={handleBrowseCommunities}
        onCreateCommunity={handleCreateCommunity}
      />

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden h-14 border-b border-[var(--fc-border,#1F1F1F)] flex items-center px-4 justify-between shrink-0" style={{ backgroundColor: 'var(--fc-surface, #0A0A0A)' }}>
          <div className="w-10" />
          <Logo variant="light" size="lg" showText={false} />
          <WalletBalance />
        </header>

        {/* Main Content Area — extra bottom padding on mobile for bottom nav */}
        <main className="flex-1 overflow-auto pb-16 lg:pb-0 relative">
          {/* Desktop wallet balance — top right */}
          <div className="hidden lg:block fixed top-4 right-4 z-20">
            <WalletBalance />
          </div>
          <Suspense fallback={<LoadingScreen />}>
            {renderContent()}
          </Suspense>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav
        currentView={currentView}
        onNavigate={handleBottomNavNavigate}
        onOpenMenu={() => setIsSidebarOpen(true)}
      />
    </div>
  );
};

// Helper function to get the default redirect path based on user role
export const getDefaultRedirectPath = (role: UserRole | null): string => {
  if (role === 'creator' || role === 'superadmin') {
    return '/dashboard';
  }
  // Students and members go to courses
  return '/courses';
};

// Wrapper component to handle auth-based redirects for protected routes
const ProtectedRouteWrapper: React.FC<{
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}> = ({ children, allowedRoles }) => {
  const { user, role, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    // Redirect to login with return URL
    const returnUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?return=${returnUrl}`} replace />;
  }

  return <ProtectedRoute allowedRoles={allowedRoles}>{children}</ProtectedRoute>;
};

// Component to redirect authenticated users to their role-based default route
const AuthenticatedRedirect: React.FC = () => {
  const { user, role, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && user) {
      navigate(getDefaultRedirectPath(role), { replace: true });
    }
  }, [user, role, isLoading, navigate]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  // If not authenticated, show the explore/course catalog page as main landing
  return <CourseCatalogPage />;
};

// Main routing component
const AppRoutes: React.FC = () => {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<AuthenticatedRedirect />} />
      <Route path="/creators" element={<LandingPage onGetStarted={() => window.location.href = '/onboarding/creator'} />} />
      <Route path="/landing" element={<MarketingLandingPage />} />
      <Route path="/discover" element={<WhopLandingPage />} />
      <Route path="/analytics" element={<TrackingPage />} />
      <Route path="/explore" element={<CourseCatalogPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/communities" element={<CommunitiesDirectory />} />
      <Route path="/community/:communityId" element={<CommunityLandingPage />} />
      {/* Team invitation page (public) */}
      <Route path="/invite/team/:token" element={<TeamInvitePage />} />
      {/* TBI application status page */}
      <Route
        path="/tbi/status/:applicationId"
        element={
          <ProtectedRouteWrapper>
            <TBIStatusPage />
          </ProtectedRouteWrapper>
        }
      />
      {/* Team member profile page */}
      <Route
        path="/community/:communityId/team/:memberId"
        element={
          <ProtectedRouteWrapper>
            <CommunityProvider>
              <TeamProfilePage />
            </CommunityProvider>
          </ProtectedRouteWrapper>
        }
      />
      {/* Pricing page removed - no billing plans */}

      {/* Creator onboarding questionnaire (pre-signup) */}
      <Route path="/onboarding/creator" element={<CreatorOnboardingPage />} />

      {/* Student onboarding questionnaire (pre-signup) */}
      <Route path="/onboarding/student" element={<StudentOnboardingPage />} />

      {/* Admin panel removed */}

      {/* Creator onboarding (activation fee) */}
      <Route
        path="/onboarding"
        element={
          <ProtectedRouteWrapper allowedRoles={['creator']}>
            <OnboardingPage />
          </ProtectedRouteWrapper>
        }
      />

      {/* Protected routes - Main app layout */}
      <Route
        path="/app/*"
        element={
          <ProtectedRouteWrapper>
            <CommunityProvider>
              <AppLayout />
            </CommunityProvider>
          </ProtectedRouteWrapper>
        }
      />

      {/* Direct protected routes that redirect to app layout */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRouteWrapper>
            <CommunityProvider>
              <AppLayout />
            </CommunityProvider>
          </ProtectedRouteWrapper>
        }
      />
      <Route
        path="/courses"
        element={
          <ProtectedRouteWrapper>
            <CommunityProvider>
              <AppLayout />
            </CommunityProvider>
          </ProtectedRouteWrapper>
        }
      />
      <Route
        path="/community"
        element={
          <ProtectedRouteWrapper>
            <CommunityProvider>
              <AppLayout />
            </CommunityProvider>
          </ProtectedRouteWrapper>
        }
      />
      <Route
        path="/calendar"
        element={
          <ProtectedRouteWrapper>
            <CommunityProvider>
              <AppLayout />
            </CommunityProvider>
          </ProtectedRouteWrapper>
        }
      />
      <Route
        path="/ai-manager"
        element={
          <ProtectedRouteWrapper allowedRoles={['creator']}>
            <CommunityProvider>
              <AppLayout />
            </CommunityProvider>
          </ProtectedRouteWrapper>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRouteWrapper>
            <CommunityProvider>
              <AppLayout />
            </CommunityProvider>
          </ProtectedRouteWrapper>
        }
      />
      <Route
        path="/homework"
        element={
          <ProtectedRouteWrapper>
            <CommunityProvider>
              <AppLayout />
            </CommunityProvider>
          </ProtectedRouteWrapper>
        }
      />
      <Route
        path="/ai-chat"
        element={
          <ProtectedRouteWrapper>
            <CommunityProvider>
              <AppLayout />
            </CommunityProvider>
          </ProtectedRouteWrapper>
        }
      />
      <Route
        path="/student-manager"
        element={
          <ProtectedRouteWrapper allowedRoles={['creator']}>
            <CommunityProvider>
              <AppLayout />
            </CommunityProvider>
          </ProtectedRouteWrapper>
        }
      />
      <Route
        path="/surveys"
        element={
          <ProtectedRouteWrapper allowedRoles={['creator']}>
            <CommunityProvider>
              <AppLayout />
            </CommunityProvider>
          </ProtectedRouteWrapper>
        }
      />
      <Route
        path="/discounts"
        element={
          <ProtectedRouteWrapper allowedRoles={['creator']}>
            <CommunityProvider>
              <AppLayout />
            </CommunityProvider>
          </ProtectedRouteWrapper>
        }
      />
      <Route
        path="/shop"
        element={
          <ProtectedRouteWrapper>
            <CommunityProvider>
              <AppLayout />
            </CommunityProvider>
          </ProtectedRouteWrapper>
        }
      />
      <Route
        path="/messages"
        element={
          <ProtectedRouteWrapper>
            <CommunityProvider>
              <AppLayout />
            </CommunityProvider>
          </ProtectedRouteWrapper>
        }
      />

      {/* DWY Packages route - for potential clients */}
      <Route
        path="/dwy-packages"
        element={
          <ProtectedRouteWrapper>
            <DwyPackagesPage />
          </ProtectedRouteWrapper>
        }
      />

      {/* Legacy redirect /app to role-based default */}
      <Route path="/app" element={<Navigate to="/dashboard" replace />} />

      {/* Admin dashboard - superadmin only */}
      <Route
        path="/admin"
        element={
          <ProtectedRouteWrapper allowedRoles={['superadmin']}>
            <AdminDashboard />
          </ProtectedRouteWrapper>
        }
      />

      {/* Catch-all redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
};

// Root App component
const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
