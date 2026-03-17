import React, { useState, useEffect } from 'react';
import { supabase } from '../../core/supabase/client';
import { Lock, Users, BookOpen, Globe, Search, ChevronDown, ChevronUp, Mail, Calendar, Shield, Phone } from 'lucide-react';

interface StudentProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string;
  role: string;
  avatar_url: string | null;
  created_at: string;
  last_login_at: string | null;
  bio: string | null;
}

interface CommunityInfo {
  id: string;
  name: string;
  member_count: number;
}

interface CourseInfo {
  id: string;
  title: string;
  community_id: string;
}

const ADMIN_PASSWORD = 'admin12345';

const AdminPanel: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [profiles, setProfiles] = useState<StudentProfile[]>([]);
  const [communities, setCommunities] = useState<CommunityInfo[]>([]);
  const [courses, setCourses] = useState<CourseInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'full_name' | 'email' | 'role' | 'created_at'>('created_at');
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>('all');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setPasswordError('');
      sessionStorage.setItem('admin_auth', 'true');
    } else {
      setPasswordError('Грешна парола');
    }
  };

  // Check session on mount
  useEffect(() => {
    if (sessionStorage.getItem('admin_auth') === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  // Load data when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    loadData();
  }, [isAuthenticated]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [profilesRes, communitiesRes, coursesRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('communities').select('id, name'),
        supabase.from('courses').select('id, title, community_id'),
      ]);

      setProfiles(profilesRes.data || []);

      // Get member counts for communities
      const comms = communitiesRes.data || [];
      const commsWithCounts = await Promise.all(
        comms.map(async (c) => {
          const { count } = await supabase
            .from('memberships')
            .select('*', { count: 'exact', head: true })
            .eq('community_id', c.id);
          return { ...c, member_count: count ?? 0 };
        })
      );
      setCommunities(commsWithCounts);
      setCourses(coursesRes.data || []);
    } catch (err) {
      console.error('Error loading admin data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter and sort profiles
  const filteredProfiles = profiles
    .filter((p) => {
      const matchesSearch =
        !searchQuery ||
        (p.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
        p.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = selectedRole === 'all' || p.role === selectedRole;
      return matchesSearch && matchesRole;
    })
    .sort((a, b) => {
      const aVal = a[sortField] ?? '';
      const bVal = b[sortField] ?? '';
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortAsc ? cmp : -cmp;
    });

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return null;
    return sortAsc ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  const roleColors: Record<string, string> = {
    superadmin: 'bg-purple-500/20 text-purple-400',
    creator: 'bg-blue-500/20 text-blue-400',
    student: 'bg-green-500/20 text-green-400',
    member: 'bg-gray-500/20 text-gray-400',
  };

  const stats = {
    total: profiles.length,
    creators: profiles.filter((p) => p.role === 'creator' || p.role === 'superadmin').length,
    students: profiles.filter((p) => p.role === 'student').length,
    communities: communities.length,
    courses: courses.length,
  };

  // Login screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4">
        <div className="bg-[#0A0A0A] rounded-xl border border-[#1F1F1F] p-8 max-w-sm w-full">
          <div className="flex items-center justify-center mb-6">
            <div className="w-12 h-12 bg-[#1F1F1F] rounded-xl flex items-center justify-center">
              <Shield size={24} className="text-[#FAFAFA]" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-[#FAFAFA] text-center mb-2">Админ панел</h1>
          <p className="text-sm text-[#666666] text-center mb-6">Въведете паролата за достъп</p>
          <form onSubmit={handleLogin}>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666666]" />
              <input
                type="password"
                placeholder="Парола"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-[#151515] border border-[#1F1F1F] rounded-lg text-[#FAFAFA] placeholder:text-[#666666] focus:outline-none focus:border-[#555555]"
                autoFocus
              />
            </div>
            {passwordError && <p className="text-[#EF4444] text-sm mt-2">{passwordError}</p>}
            <button
              type="submit"
              className="w-full mt-4 py-3 bg-white text-black rounded-lg font-medium hover:bg-[#E0E0E0] transition-colors"
            >
              Вход
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Admin dashboard
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#FAFAFA]">
      {/* Header */}
      <div className="border-b border-[#1F1F1F] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield size={24} className="text-purple-400" />
            <h1 className="text-xl font-bold">Админ панел — Founders Club</h1>
          </div>
          <button
            onClick={() => {
              sessionStorage.removeItem('admin_auth');
              setIsAuthenticated(false);
            }}
            className="text-sm text-[#666666] hover:text-[#A0A0A0]"
          >
            Изход
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-[#FAFAFA] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
              <div className="bg-[#151515] rounded-xl border border-[#1F1F1F] p-4">
                <div className="flex items-center gap-2 text-[#666666] text-sm mb-1">
                  <Users size={14} />
                  Общо потребители
                </div>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <div className="bg-[#151515] rounded-xl border border-[#1F1F1F] p-4">
                <div className="flex items-center gap-2 text-blue-400 text-sm mb-1">
                  <Users size={14} />
                  Създатели
                </div>
                <p className="text-2xl font-bold">{stats.creators}</p>
              </div>
              <div className="bg-[#151515] rounded-xl border border-[#1F1F1F] p-4">
                <div className="flex items-center gap-2 text-green-400 text-sm mb-1">
                  <Users size={14} />
                  Студенти
                </div>
                <p className="text-2xl font-bold">{stats.students}</p>
              </div>
              <div className="bg-[#151515] rounded-xl border border-[#1F1F1F] p-4">
                <div className="flex items-center gap-2 text-[#666666] text-sm mb-1">
                  <Globe size={14} />
                  Общности
                </div>
                <p className="text-2xl font-bold">{stats.communities}</p>
              </div>
              <div className="bg-[#151515] rounded-xl border border-[#1F1F1F] p-4">
                <div className="flex items-center gap-2 text-[#666666] text-sm mb-1">
                  <BookOpen size={14} />
                  Курсове
                </div>
                <p className="text-2xl font-bold">{stats.courses}</p>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4 mb-6">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666666]" />
                <input
                  type="text"
                  placeholder="Търси по име или имейл..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-[#151515] border border-[#1F1F1F] rounded-lg text-[#FAFAFA] placeholder:text-[#666666] focus:outline-none focus:border-[#555555]"
                />
              </div>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="px-4 py-2 bg-[#151515] border border-[#1F1F1F] rounded-lg text-[#FAFAFA] focus:outline-none"
              >
                <option value="all">Всички роли</option>
                <option value="superadmin">Superadmin</option>
                <option value="creator">Creator</option>
                <option value="student">Student</option>
                <option value="member">Member</option>
              </select>
            </div>

            {/* Users table */}
            <div className="bg-[#151515] rounded-xl border border-[#1F1F1F] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#1F1F1F] text-left text-sm text-[#666666]">
                      <th className="px-4 py-3 cursor-pointer hover:text-[#A0A0A0]" onClick={() => handleSort('full_name')}>
                        <div className="flex items-center gap-1">Име <SortIcon field="full_name" /></div>
                      </th>
                      <th className="px-4 py-3 cursor-pointer hover:text-[#A0A0A0]" onClick={() => handleSort('email')}>
                        <div className="flex items-center gap-1">Имейл <SortIcon field="email" /></div>
                      </th>
                      <th className="px-4 py-3 cursor-pointer hover:text-[#A0A0A0]" onClick={() => handleSort('role')}>
                        <div className="flex items-center gap-1">Роля <SortIcon field="role" /></div>
                      </th>
                      <th className="px-4 py-3 cursor-pointer hover:text-[#A0A0A0]" onClick={() => handleSort('created_at')}>
                        <div className="flex items-center gap-1">Регистрация <SortIcon field="created_at" /></div>
                      </th>
                      <th className="px-4 py-3">Телефон</th>
                      <th className="px-4 py-3">Последен вход</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProfiles.map((p) => (
                      <tr key={p.id} className="border-b border-[#1F1F1F] hover:bg-[#1A1A1A] transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {p.avatar_url ? (
                              <img src={p.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-[#1F1F1F] flex items-center justify-center text-xs font-medium text-[#A0A0A0]">
                                {(p.full_name || p.email)[0]?.toUpperCase()}
                              </div>
                            )}
                            <span className="font-medium text-[#FAFAFA]">{p.full_name || '—'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-[#A0A0A0]">
                          <div className="flex items-center gap-1">
                            <Mail size={12} />
                            {p.email}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleColors[p.role] || roleColors.member}`}>
                            {p.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-[#A0A0A0]">
                          <div className="flex items-center gap-1">
                            <Calendar size={12} />
                            {new Date(p.created_at).toLocaleDateString('bg-BG')}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-[#A0A0A0]">
                          {(p as any).phone ? (
                            <div className="flex items-center gap-1">
                              <Phone size={12} />
                              {(p as any).phone}
                            </div>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-[#666666]">
                          {p.last_login_at ? new Date(p.last_login_at).toLocaleDateString('bg-BG') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 border-t border-[#1F1F1F] text-sm text-[#666666]">
                Показани: {filteredProfiles.length} от {profiles.length} потребители
              </div>
            </div>

            {/* Communities */}
            <h2 className="text-lg font-semibold mt-8 mb-4">Общности</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {communities.map((c) => (
                <div key={c.id} className="bg-[#151515] rounded-xl border border-[#1F1F1F] p-4">
                  <h3 className="font-medium text-[#FAFAFA]">{c.name}</h3>
                  <p className="text-sm text-[#666666] mt-1">{c.member_count} членове</p>
                </div>
              ))}
            </div>

            {/* Courses */}
            <h2 className="text-lg font-semibold mt-8 mb-4">Курсове ({courses.length})</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {courses.map((c) => (
                <div key={c.id} className="bg-[#151515] rounded-xl border border-[#1F1F1F] p-4">
                  <h3 className="font-medium text-[#FAFAFA]">{c.title}</h3>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
