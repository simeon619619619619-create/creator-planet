import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import {
  Users, GraduationCap, Euro, Building2, TrendingUp,
  AlertTriangle, Loader2, ArrowUpDown, Shield, Lock,
} from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import AdminStatCard from '../components/AdminStatCard';
import TimeRangeSelector from '../components/TimeRangeSelector';
import {
  useAdminOverview,
  useCreatorLeaderboard,
  useRevenueChart,
  useEnrollmentChart,
  useCommunityHealth,
} from '../hooks/useAdminData';
import type { TimeRange, AdminSection, CreatorRow, CommunityRow } from '../types';

// ============================================================================
// HELPERS
// ============================================================================

function formatCents(cents: number): string {
  return `\u20AC${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString();
}

// ============================================================================
// CREATORS TABLE
// ============================================================================

const CreatorsTable: React.FC<{ creators: CreatorRow[] }> = ({ creators }) => {
  const { t } = useTranslation();
  const [sortBy, setSortBy] = useState<string>('revenue');

  const sorted = [...creators].sort((a, b) => {
    switch (sortBy) {
      case 'students': return b.studentCount - a.studentCount;
      case 'communities': return b.communityCount - a.communityCount;
      default: return b.totalRevenue - a.totalRevenue;
    }
  });

  const columns = [
    { key: 'name', label: t('admin.creatorsTable.name'), sortable: false },
    { key: 'plan', label: t('admin.creatorsTable.plan'), sortable: false },
    { key: 'revenue', label: t('admin.creatorsTable.revenue'), sortable: true },
    { key: 'students', label: t('admin.creatorsTable.students'), sortable: true },
    { key: 'communities', label: t('admin.creatorsTable.communities'), sortable: true },
    { key: 'lastLogin', label: t('admin.creatorsTable.lastLogin'), sortable: false },
  ];

  return (
    <div className="bg-[#0A0A0A] rounded-xl border border-[#1F1F1F] overflow-hidden">
      <div className="p-6 border-b border-[#1F1F1F]">
        <h2 className="text-lg font-bold text-[#FAFAFA]">{t('admin.creatorsTable.title')}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#1F1F1F]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-6 py-3 text-left text-xs font-medium text-[#A0A0A0] uppercase tracking-wider ${
                    col.sortable ? 'cursor-pointer hover:text-[#FAFAFA] transition-colors' : ''
                  }`}
                  onClick={() => col.sortable && setSortBy(col.key)}
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && (
                      <ArrowUpDown size={14} className={sortBy === col.key ? 'text-[#FAFAFA]' : 'text-[#333333]'} />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1F1F1F]">
            {sorted.map((creator) => (
              <tr key={creator.id} className="hover:bg-[#151515] transition-colors">
                <td className="px-6 py-4">
                  <div>
                    <p className="text-sm font-medium text-[#FAFAFA]">{creator.name}</p>
                    <p className="text-xs text-[#666666]">{creator.email}</p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[#1F1F1F] text-[#A0A0A0] capitalize">
                    {creator.plan}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-[#FAFAFA]">{formatCents(creator.totalRevenue)}</td>
                <td className="px-6 py-4 text-sm text-[#FAFAFA]">{creator.studentCount}</td>
                <td className="px-6 py-4 text-sm text-[#FAFAFA]">{creator.communityCount}</td>
                <td className="px-6 py-4 text-sm text-[#A0A0A0]">{formatDate(creator.lastLogin)}</td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-sm text-[#666666]">
                  {t('admin.creatorsTable.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============================================================================
// COMMUNITY TABLE
// ============================================================================

const CommunityTable: React.FC<{ communities: CommunityRow[] }> = ({ communities }) => {
  const { t } = useTranslation();

  return (
    <div className="bg-[#0A0A0A] rounded-xl border border-[#1F1F1F] overflow-hidden">
      <div className="p-6 border-b border-[#1F1F1F]">
        <h2 className="text-lg font-bold text-[#FAFAFA]">{t('admin.communityTable.title')}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#1F1F1F]">
              <th className="px-6 py-3 text-left text-xs font-medium text-[#A0A0A0] uppercase tracking-wider">
                {t('admin.communityTable.name')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#A0A0A0] uppercase tracking-wider">
                {t('admin.communityTable.creator')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#A0A0A0] uppercase tracking-wider">
                {t('admin.communityTable.members')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#A0A0A0] uppercase tracking-wider">
                {t('admin.communityTable.posts')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#A0A0A0] uppercase tracking-wider">
                {t('admin.communityTable.pricing')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#A0A0A0] uppercase tracking-wider">
                {t('admin.communityTable.visibility')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#A0A0A0] uppercase tracking-wider">
                {t('admin.communityTable.created')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1F1F1F]">
            {communities.map((community) => (
              <tr key={community.id} className="hover:bg-[#151515] transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#1F1F1F] flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-[#FAFAFA]">{community.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <span className="text-sm font-medium text-[#FAFAFA]">{community.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-[#A0A0A0]">{community.creatorName}</td>
                <td className="px-6 py-4 text-sm text-[#FAFAFA]">{community.memberCount}</td>
                <td className="px-6 py-4 text-sm text-[#FAFAFA]">{community.postCount}</td>
                <td className="px-6 py-4">
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[#1F1F1F] text-[#A0A0A0] capitalize">
                    {community.pricingType}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    community.isPublic
                      ? 'bg-[#16A34A]/10 text-[#16A34A]'
                      : 'bg-[#F59E0B]/10 text-[#F59E0B]'
                  }`}>
                    {community.isPublic ? t('admin.communityTable.public') : t('admin.communityTable.private')}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-[#A0A0A0]">{formatDate(community.createdAt)}</td>
              </tr>
            ))}
            {communities.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-sm text-[#666666]">
                  {t('admin.communityTable.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============================================================================
// ADMIN DASHBOARD (MAIN)
// ============================================================================

const AdminDashboard: React.FC = () => {
  const { t } = useTranslation();
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');

  const [isAuthenticated, setIsAuthenticated] = useState(() =>
    sessionStorage.getItem('admin_auth') === 'true'
  );
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD;
    if (!adminPassword) {
      setPasswordError(t('admin.noPasswordConfigured') || 'Admin password not configured');
      return;
    }
    if (password === adminPassword) {
      setIsAuthenticated(true);
      setPasswordError('');
      sessionStorage.setItem('admin_auth', 'true');
    } else {
      setPasswordError(t('admin.wrongPassword') || 'Wrong password');
    }
  };

  // All hooks called unconditionally at top level
  const { data: stats, isLoading: statsLoading } = useAdminOverview(timeRange);
  const { data: revenueData, isLoading: revenueLoading } = useRevenueChart(timeRange);
  const { data: enrollmentData, isLoading: enrollmentLoading } = useEnrollmentChart(timeRange);
  const { data: creators, isLoading: creatorsLoading } = useCreatorLeaderboard('revenue');
  const { data: communities, isLoading: communitiesLoading } = useCommunityHealth();

  const isLoading = statsLoading || revenueLoading || enrollmentLoading || creatorsLoading || communitiesLoading;
  const s = stats ?? {
    totalCreators: 0, creatorsByPlan: { starter: 0, pro: 0, scale: 0 },
    activeCreators: 0, inactiveCreators: 0, totalStudents: 0,
    totalEnrollments: 0, activeEnrollments: 0, avgCompletionRate: 0,
    atRiskStudentCount: 0, totalPlatformRevenue: 0, totalGrossRevenue: 0,
    monthlyRecurringRevenue: 0, transactionCount: 0, totalCommunities: 0,
    publicCommunities: 0, privateCommunities: 0, avgMembersPerCommunity: 0, totalPosts: 0,
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4">
        <div className="bg-[#0A0A0A] rounded-xl border border-[#1F1F1F] p-8 max-w-sm w-full">
          <div className="flex items-center justify-center mb-6">
            <div className="w-12 h-12 bg-[#1F1F1F] rounded-xl flex items-center justify-center">
              <Shield size={24} className="text-[#FAFAFA]" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-[#FAFAFA] text-center mb-2">{t('admin.title')}</h1>
          <p className="text-sm text-[#666666] text-center mb-6">{t('admin.enterPassword')}</p>
          <form onSubmit={handleLogin}>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666666]" />
              <input
                type="password"
                placeholder={t('admin.passwordPlaceholder') || 'Password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-[#151515] border border-[#1F1F1F] rounded-lg text-[#FAFAFA] placeholder:text-[#666666] focus:outline-none focus:border-[#333333]"
                autoFocus
              />
            </div>
            {passwordError && <p className="text-[#EF4444] text-sm mt-2">{passwordError}</p>}
            <button
              type="submit"
              className="w-full mt-4 py-3 bg-white text-black rounded-lg font-medium hover:bg-[#E0E0E0] transition-colors"
            >
              {t('admin.login') || 'Login'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <AdminLayout>
      {(_activeSection: AdminSection) => (
        <>
          {/* Header bar */}
          <div className="flex items-center justify-between p-6 border-b border-[#1F1F1F]">
            <h1 className="text-2xl font-semibold text-[#FAFAFA]">{t('admin.pageTitle')}</h1>
            <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
          </div>

          {/* Loading state */}
          {isLoading ? (
            <div className="flex items-center justify-center min-h-[400px]">
              <Loader2 className="w-8 h-8 animate-spin text-white" />
            </div>
          ) : (
            /* Scrollable content */
            <div className="p-6 space-y-6 max-w-7xl mx-auto">
              {/* KPI Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <AdminStatCard
                  label={t('admin.kpi.totalCreators')}
                  value={s.totalCreators}
                  icon={Users}
                  color="blue"
                  trend={s.activeCreators > 0 ? { value: `${s.activeCreators} ${t('admin.kpi.active')}`, positive: true } : undefined}
                />
                <AdminStatCard
                  label={t('admin.kpi.totalStudents')}
                  value={s.totalStudents}
                  icon={GraduationCap}
                  color="green"
                  trend={s.atRiskStudentCount > 0 ? { value: `${s.atRiskStudentCount} ${t('admin.kpi.atRisk')}`, positive: false } : undefined}
                />
                <AdminStatCard
                  label={t('admin.kpi.platformRevenue')}
                  value={formatCents(s.totalPlatformRevenue)}
                  icon={Euro}
                  color="amber"
                  trend={s.transactionCount > 0 ? { value: `${s.transactionCount} ${t('admin.kpi.transactions')}`, positive: true } : undefined}
                />
                <AdminStatCard
                  label={t('admin.kpi.totalCommunities')}
                  value={s.totalCommunities}
                  icon={Building2}
                  trend={s.totalPosts > 0 ? { value: `${s.totalPosts} ${t('admin.kpi.posts')}`, positive: true } : undefined}
                />
              </div>

              {/* Revenue Chart */}
              <div className="bg-[#0A0A0A] rounded-xl border border-[#1F1F1F] p-5">
                <h2 className="text-lg font-bold text-[#FAFAFA] mb-6">{t('admin.chart.revenueTitle')}</h2>
                <div className="w-full" style={{ height: 320 }}>
                  {revenueData && revenueData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={320}>
                      <AreaChart data={revenueData}>
                        <defs>
                          <linearGradient id="colorPlatform" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.15} />
                            <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorGross" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#FFFFFF" stopOpacity={0.05} />
                            <stop offset="95%" stopColor="#FFFFFF" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1F1F1F" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#666666' }} />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: '#666666' }}
                          tickFormatter={(v: number) => `\u20AC${(v / 100).toFixed(0)}`}
                        />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#151515', border: '1px solid #1F1F1F', borderRadius: '8px' }}
                          labelStyle={{ color: '#FAFAFA' }}
                          itemStyle={{ color: '#A0A0A0' }}
                          formatter={(value: number, name: string) => [
                            formatCents(value),
                            name === 'platformRevenue' ? t('admin.chart.platformFee') : t('admin.chart.grossRevenue'),
                          ]}
                        />
                        <Area
                          type="monotone"
                          dataKey="grossRevenue"
                          stroke="#FAFAFA"
                          fillOpacity={1}
                          fill="url(#colorGross)"
                          strokeWidth={2}
                        />
                        <Area
                          type="monotone"
                          dataKey="platformRevenue"
                          stroke="#F59E0B"
                          fillOpacity={1}
                          fill="url(#colorPlatform)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-[#666666]">
                      {t('admin.chart.noData')}
                    </div>
                  )}
                </div>
              </div>

              {/* Two-column grid: Creators by Plan + Student Health */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Creators by Plan */}
                <div className="bg-[#0A0A0A] p-6 rounded-xl border border-[#1F1F1F]">
                  <h2 className="text-lg font-bold text-[#FAFAFA] mb-4">{t('admin.creatorsByPlan.title')}</h2>
                  <div className="space-y-4">
                    {([
                      { plan: 'starter' as const, color: '#A0A0A0' },
                      { plan: 'pro' as const, color: '#F59E0B' },
                      { plan: 'scale' as const, color: '#16A34A' },
                    ]).map(({ plan, color }) => {
                      const count = s.creatorsByPlan[plan] ?? 0;
                      const total = s.totalCreators || 1;
                      const pct = Math.round((count / total) * 100);
                      return (
                        <div key={plan}>
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="flex items-center gap-2 text-sm font-medium text-[#FAFAFA]">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                              {t(`admin.plans.${plan}`)}
                            </span>
                            <span className="text-sm text-[#A0A0A0]">{count} ({pct}%)</span>
                          </div>
                          <div className="h-2 bg-[#1F1F1F] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{ width: `${pct}%`, backgroundColor: color }}
                            />
                          </div>
                        </div>
                      );
                    })}
                    <div className="pt-3 border-t border-[#1F1F1F] flex justify-between text-sm">
                      <span className="text-[#A0A0A0]">{t('admin.creatorsByPlan.inactive')}</span>
                      <span className="text-[#A0A0A0]">{s.inactiveCreators}</span>
                    </div>
                  </div>
                </div>

                {/* Student Health */}
                <div className="bg-[#0A0A0A] p-6 rounded-xl border border-[#1F1F1F]">
                  <h2 className="text-lg font-bold text-[#FAFAFA] mb-4">{t('admin.studentHealth.title')}</h2>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-[#16A34A]/10">
                          <GraduationCap size={18} className="text-[#16A34A]" />
                        </div>
                        <span className="text-sm text-[#FAFAFA]">{t('admin.studentHealth.totalEnrollments')}</span>
                      </div>
                      <span className="text-sm font-semibold text-[#FAFAFA]">{s.totalEnrollments}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-[#2563EB]/10">
                          <TrendingUp size={18} className="text-[#2563EB]" />
                        </div>
                        <span className="text-sm text-[#FAFAFA]">{t('admin.studentHealth.avgCompletion')}</span>
                      </div>
                      <span className="text-sm font-semibold text-[#FAFAFA]">{s.avgCompletionRate}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-[#DC2626]/10">
                          <AlertTriangle size={18} className="text-[#DC2626]" />
                        </div>
                        <span className="text-sm text-[#FAFAFA]">{t('admin.studentHealth.atRisk')}</span>
                      </div>
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[#DC2626]/10 text-[#DC2626]">
                        {s.atRiskStudentCount}
                      </span>
                    </div>
                    {/* Enrollment Trends mini chart */}
                    {enrollmentData && enrollmentData.length > 0 && (
                      <div className="pt-3 border-t border-[#1F1F1F]">
                        <p className="text-xs font-medium text-[#A0A0A0] uppercase tracking-wider mb-2">
                          {t('admin.studentHealth.enrollmentTrend')}
                        </p>
                        <ResponsiveContainer width="100%" height={120}>
                          <AreaChart data={enrollmentData}>
                            <defs>
                              <linearGradient id="colorEnrollments" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#16A34A" stopOpacity={0.15} />
                                <stop offset="95%" stopColor="#16A34A" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <XAxis dataKey="date" hide />
                            <YAxis hide />
                            <Area
                              type="monotone"
                              dataKey="newEnrollments"
                              stroke="#16A34A"
                              fillOpacity={1}
                              fill="url(#colorEnrollments)"
                              strokeWidth={2}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Top Creators Table */}
              <CreatorsTable creators={creators ?? []} />

              {/* Community Health Table */}
              <CommunityTable communities={communities ?? []} />
            </div>
          )}
        </>
      )}
    </AdminLayout>
  );
};

export default AdminDashboard;
