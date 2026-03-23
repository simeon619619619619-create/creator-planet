import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Users,
  Award,
  Search,
  Loader2,
  X,
  Trophy,
  FileText,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../core/contexts/AuthContext';
import { getStudentsWithStats, addBonusPoints, StudentWithStats } from '../student-manager/studentManagerService';
import { getTeamRoleInCommunity } from './teamPermissions';

// Available bonus point options
const BONUS_POINT_OPTIONS = [1, 2, 3, 5, 10] as const;

interface TeamMembersPageProps {
  communityId: string;
}

const TeamMembersPage: React.FC<TeamMembersPageProps> = ({ communityId }) => {
  const { t } = useTranslation();
  const { profile, teamMemberships, role } = useAuth();

  // State
  const [students, setStudents] = useState<StudentWithStats[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<StudentWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Bonus points modal state
  const [isBonusModalOpen, setIsBonusModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentWithStats | null>(null);
  const [bonusPoints, setBonusPoints] = useState(5);
  const [bonusReason, setBonusReason] = useState('');
  const [isAwarding, setIsAwarding] = useState(false);
  const [awardError, setAwardError] = useState<string | null>(null);

  // Get team role for permission checks
  const teamRole = getTeamRoleInCommunity(communityId, teamMemberships);
  const canAwardPoints = role === 'creator' || role === 'superadmin' || teamRole === 'lecturer' || teamRole === 'assistant';

  // Load students
  const loadStudents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getStudentsWithStats(communityId);
      setStudents(data);
      setFilteredStudents(data);
    } catch (err) {
      // Error is shown to user via error state
      setError(t('teamMembers.errors.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [communityId, t]);

  // Initial load
  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  // Filter students based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredStudents(students);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = students.filter(
      (s) =>
        s.profile.full_name?.toLowerCase().includes(query) ||
        s.profile.email.toLowerCase().includes(query)
    );
    setFilteredStudents(filtered);
  }, [searchQuery, students]);

  // Open bonus modal for a student
  const handleBonusClick = (student: StudentWithStats) => {
    setSelectedStudent(student);
    setBonusPoints(5);
    setBonusReason('');
    setAwardError(null);
    setIsBonusModalOpen(true);
  };

  // Award bonus points
  const handleAwardBonus = async () => {
    if (!selectedStudent || !canAwardPoints) return;

    setIsAwarding(true);
    setAwardError(null);
    try {
      const success = await addBonusPoints(
        selectedStudent.profile.id,
        communityId,
        bonusPoints,
        bonusReason
      );

      if (success) {
        // Refresh the student list to show updated points
        await loadStudents();
        setIsBonusModalOpen(false);
        setSelectedStudent(null);
      } else {
        setAwardError(t('teamMembers.errors.awardFailed'));
      }
    } catch (err) {
      // Error is shown to user via awardError state
      setAwardError(t('teamMembers.errors.awardFailed'));
    } finally {
      setIsAwarding(false);
    }
  };

  // Close modal
  const handleCloseModal = () => {
    if (!isAwarding) {
      setIsBonusModalOpen(false);
      setSelectedStudent(null);
    }
  };

  // Get initials for avatar
  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Format level display
  const getLevelBadge = (level: number) => {
    const colors = [
      'bg-[#1F1F1F] text-[#A0A0A0]',     // Level 1
      'bg-[#22C55E]/10 text-[#22C55E]',     // Level 2
      'bg-[#1F1F1F] text-[#A0A0A0]',       // Level 3
      'bg-[#1F1F1F] text-[#A0A0A0]',   // Level 4
      'bg-[#EAB308]/10 text-[#EAB308]',     // Level 5+
    ];
    const colorIndex = Math.min(level - 1, colors.length - 1);
    return colors[colorIndex];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 text-[#FAFAFA] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      {/* Header */}
      <div className="bg-[#0A0A0A] border-b border-[#1F1F1F]">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-[#1F1F1F] rounded-xl">
                <Users className="w-7 h-7 text-[#FAFAFA]" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#FAFAFA]">{t('teamMembers.pageTitle')}</h1>
                <p className="text-[#A0A0A0]">
                  {t('teamMembers.pageSubtitle', { count: students.length })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-[#EF4444] flex-shrink-0" />
            <p className="text-[#EF4444] text-sm">{error}</p>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-[#EF4444] hover:text-[#EF4444]"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#666666]" />
            <input
              type="text"
              placeholder={t('teamMembers.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-[#1F1F1F] rounded-lg focus:ring-1 focus:ring-white/10 focus:border-[#555555]"
            />
          </div>
        </div>

        {/* Students Table */}
        <div className="bg-[#0A0A0A] rounded-xl border border-[#1F1F1F] overflow-hidden">
          {filteredStudents.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 text-[#A0A0A0] mx-auto mb-3" />
              <h3 className="text-lg font-medium text-[#A0A0A0]">
                {searchQuery ? t('teamMembers.noSearchResults') : t('teamMembers.noMembers')}
              </h3>
              <p className="text-[#666666] mt-1">
                {searchQuery
                  ? t('teamMembers.tryDifferentSearch')
                  : t('teamMembers.membersWillAppear')}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#0A0A0A] border-b border-[#1F1F1F]">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[#A0A0A0] uppercase tracking-wider">
                      {t('teamMembers.table.member')}
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-[#A0A0A0] uppercase tracking-wider">
                      {t('teamMembers.table.level')}
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-[#A0A0A0] uppercase tracking-wider">
                      {t('teamMembers.table.points')}
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-[#A0A0A0] uppercase tracking-wider">
                      {t('teamMembers.table.submissions')}
                    </th>
                    {canAwardPoints && (
                      <th className="px-6 py-3 text-right text-xs font-semibold text-[#A0A0A0] uppercase tracking-wider">
                        {t('teamMembers.table.actions')}
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F1F1F]">
                  {filteredStudents.map((student) => (
                    <tr key={student.profile.id} className="hover:bg-[#0A0A0A]">
                      {/* Member Info */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {student.profile.avatar_url ? (
                            <img
                              src={student.profile.avatar_url}
                              alt={student.profile.full_name || ''}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-[#1F1F1F] flex items-center justify-center">
                              <span className="text-[#FAFAFA] font-medium text-sm">
                                {getInitials(student.profile.full_name)}
                              </span>
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-[#FAFAFA]">
                              {student.profile.full_name || t('teamMembers.unnamed')}
                            </p>
                            <p className="text-sm text-[#666666]">{student.profile.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Level */}
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${getLevelBadge(
                            student.points?.level || 1
                          )}`}
                        >
                          <Trophy className="w-3.5 h-3.5" />
                          {t('teamMembers.level', { level: student.points?.level || 1 })}
                        </span>
                      </td>

                      {/* Points */}
                      <td className="px-6 py-4 text-center">
                        <span className="font-semibold text-[#FAFAFA]">
                          {student.points?.total_points || 0}
                        </span>
                      </td>

                      {/* Submissions */}
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-3">
                          <span className="flex items-center gap-1 text-[#A0A0A0]">
                            <FileText className="w-4 h-4" />
                            {student.submissionCount}
                          </span>
                          <span className="flex items-center gap-1 text-[#22C55E]">
                            <CheckCircle className="w-4 h-4" />
                            {student.gradedCount}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      {canAwardPoints && (
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleBonusClick(student)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#EAB308] bg-[#EAB308]/10 rounded-lg hover:bg-[#EAB308]/10 transition-colors"
                          >
                            <Award className="w-4 h-4" />
                            {t('teamMembers.awardBonus')}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Bonus Points Modal */}
      {isBonusModalOpen && selectedStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0A0A0A] rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-[#1F1F1F] flex justify-between items-center">
              <h2 className="text-lg font-bold text-[#FAFAFA]">{t('teamMembers.bonusModal.title')}</h2>
              <button
                onClick={handleCloseModal}
                disabled={isAwarding}
                className="text-[#666666] hover:text-[#A0A0A0] disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Student info */}
              <div className="flex items-center gap-3 p-3 bg-[#0A0A0A] rounded-lg">
                {selectedStudent.profile.avatar_url ? (
                  <img
                    src={selectedStudent.profile.avatar_url}
                    alt={selectedStudent.profile.full_name || ''}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-[#1F1F1F] flex items-center justify-center">
                    <span className="text-[#FAFAFA] font-medium">
                      {getInitials(selectedStudent.profile.full_name)}
                    </span>
                  </div>
                )}
                <div>
                  <p className="font-medium text-[#FAFAFA]">
                    {selectedStudent.profile.full_name || t('teamMembers.unnamed')}
                  </p>
                  <p className="text-sm text-[#666666]">
                    {t('teamMembers.bonusModal.currentPoints', {
                      points: selectedStudent.points?.total_points || 0,
                    })}
                  </p>
                </div>
              </div>

              {/* Points input */}
              <div>
                <label className="block text-sm font-medium text-[#A0A0A0] mb-2">
                  {t('teamMembers.bonusModal.pointsLabel')}
                </label>
                <div className="flex gap-2">
                  {BONUS_POINT_OPTIONS.map((points) => (
                    <button
                      key={points}
                      onClick={() => setBonusPoints(points)}
                      className={`flex-1 py-2 rounded-lg font-medium text-sm transition-colors ${
                        bonusPoints === points
                          ? 'bg-[var(--fc-text,white)] text-[var(--fc-surface,black)]'
                          : 'bg-[#1F1F1F] text-[#A0A0A0] hover:bg-[#151515]'
                      }`}
                    >
                      +{points}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reason input */}
              <div>
                <label className="block text-sm font-medium text-[#A0A0A0] mb-1">
                  {t('teamMembers.bonusModal.reasonLabel')}
                </label>
                <textarea
                  value={bonusReason}
                  onChange={(e) => setBonusReason(e.target.value)}
                  placeholder={t('teamMembers.bonusModal.reasonPlaceholder')}
                  rows={3}
                  className="w-full border border-[#1F1F1F] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white/10"
                />
              </div>

              {/* Error message */}
              {awardError && (
                <div className="p-3 bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-[#EF4444] flex-shrink-0" />
                  <p className="text-[#EF4444] text-sm">{awardError}</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-[#1F1F1F] flex gap-3">
              <button
                onClick={handleCloseModal}
                disabled={isAwarding}
                className="flex-1 border border-[#1F1F1F] text-[#A0A0A0] py-2 rounded-lg text-sm font-medium hover:bg-[#0A0A0A] disabled:opacity-50"
              >
                {t('teamMembers.bonusModal.cancel')}
              </button>
              <button
                onClick={handleAwardBonus}
                disabled={isAwarding}
                className="flex-1 bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] py-2 rounded-lg text-sm font-medium hover:bg-[#E0E0E0] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isAwarding ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {t('teamMembers.bonusModal.awarding')}
                  </>
                ) : (
                  <>
                    <Award size={16} />
                    {t('teamMembers.bonusModal.awardButton', { points: bonusPoints })}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamMembersPage;
