/**
 * Discounts Page
 *
 * Creator dashboard page for managing discount codes.
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Copy,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Tag,
  Users,
  Calendar,
  Percent,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../core/contexts/AuthContext';
import { getDiscountCodes, deactivateDiscountCode, reactivateDiscountCode, deleteDiscountCode } from './discountService';
import { CreateDiscountModal } from './components/CreateDiscountModal';
import { getDurationLabel, formatCents } from './discountTypes';
import type { DiscountCodeWithDetails } from './discountTypes';

type FilterStatus = 'all' | 'active' | 'inactive' | 'expired';

export function DiscountsPage() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [codes, setCodes] = useState<DiscountCodeWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<DiscountCodeWithDetails | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadCodes = async () => {
    if (!profile?.id) return;

    try {
      setIsLoading(true);
      const data = await getDiscountCodes(profile.id);
      setCodes(data);
    } catch (err) {
      setError(t('discounts.errors.loadFailed'));
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCodes();
  }, [profile?.id]);

  const handleCopyCode = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggleActive = async (code: DiscountCodeWithDetails) => {
    try {
      if (code.is_active) {
        await deactivateDiscountCode(code.id);
      } else {
        await reactivateDiscountCode(code.id);
      }
      loadCodes();
    } catch (err) {
      console.error('Failed to toggle code status:', err);
    }
  };

  const handleDelete = async (code: DiscountCodeWithDetails) => {
    if (!confirm(t('discounts.actions.deleteConfirm', { code: code.code }))) {
      return;
    }

    try {
      await deleteDiscountCode(code.id);
      loadCodes();
    } catch (err) {
      console.error('Failed to delete code:', err);
    }
  };

  const handleEdit = (code: DiscountCodeWithDetails) => {
    setEditingCode(code);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingCode(null);
  };

  const isExpired = (code: DiscountCodeWithDetails): boolean => {
    if (!code.valid_until) return false;
    return new Date(code.valid_until) < new Date();
  };

  const isMaxedOut = (code: DiscountCodeWithDetails): boolean => {
    if (code.max_uses === null) return false;
    return code.current_uses >= code.max_uses;
  };

  // Filter codes
  const filteredCodes = codes.filter((code) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (
        !code.code.toLowerCase().includes(query) &&
        !code.target_student?.email?.toLowerCase().includes(query) &&
        !code.target_community?.name?.toLowerCase().includes(query) &&
        !code.target_course?.title?.toLowerCase().includes(query)
      ) {
        return false;
      }
    }

    // Status filter
    switch (filterStatus) {
      case 'active':
        return code.is_active && !isExpired(code) && !isMaxedOut(code);
      case 'inactive':
        return !code.is_active;
      case 'expired':
        return isExpired(code) || isMaxedOut(code);
      default:
        return true;
    }
  });

  const getStatusBadge = (code: DiscountCodeWithDetails) => {
    if (!code.is_active) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--fc-section-hover,#1F1F1F)] px-2 py-0.5 text-xs font-medium text-[var(--fc-section-muted,#A0A0A0)]">
          <XCircle className="h-3 w-3" /> {t('discounts.status.inactive')}
        </span>
      );
    }
    if (isExpired(code)) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#EF4444]/10 px-2 py-0.5 text-xs font-medium text-[#EF4444]">
          <Calendar className="h-3 w-3" /> {t('discounts.status.expired')}
        </span>
      );
    }
    if (isMaxedOut(code)) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#EAB308]/10 px-2 py-0.5 text-xs font-medium text-[#EAB308]">
          <Users className="h-3 w-3" /> {t('discounts.status.maxedOut')}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#22C55E]/10 px-2 py-0.5 text-xs font-medium text-[#22C55E]">
        <CheckCircle2 className="h-3 w-3" /> {t('discounts.status.active')}
      </span>
    );
  };

  const getTargetLabel = (code: DiscountCodeWithDetails): string => {
    if (code.target_student) {
      return t('discounts.codeDetails.targetFor', { email: code.target_student.email || code.target_student.full_name || 'Specific student' });
    }
    if (code.target_community) {
      return t('discounts.codeDetails.targetCommunity', { name: code.target_community.name });
    }
    if (code.target_course) {
      return t('discounts.codeDetails.targetCourse', { title: code.target_course.title });
    }
    return t('discounts.codeDetails.targetAll');
  };

  if (!profile) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-[var(--fc-section-muted,#666666)]">{t('discounts.page.loginRequired')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--fc-section,#0A0A0A)] p-6">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--fc-section-text,#FAFAFA)]">{t('discounts.page.title')}</h1>
            <p className="mt-1 text-sm text-[var(--fc-section-muted,#666666)]">
              {t('discounts.page.subtitle')}
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-[var(--fc-button,white)] px-4 py-2.5 text-sm font-medium text-[var(--fc-button-text,black)] hover:bg-[var(--fc-button-hover,#E0E0E0)]"
          >
            <Plus className="h-4 w-4" />
            {t('discounts.page.createButton')}
          </button>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fc-section-muted,#666666)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('discounts.page.searchPlaceholder')}
              className="w-full rounded-lg border border-[var(--fc-section-border,#1F1F1F)] py-2 pl-10 pr-4 text-sm focus:border-[var(--fc-section-text,#555555)] focus:ring-white/10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-[var(--fc-section-muted,#666666)]" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
              className="rounded-lg border border-[var(--fc-section-border,#1F1F1F)] py-2 px-3 text-sm focus:border-[var(--fc-section-text,#555555)] focus:ring-white/10"
            >
              <option value="all">{t('discounts.page.filterAll')}</option>
              <option value="active">{t('discounts.page.filterActive')}</option>
              <option value="inactive">{t('discounts.page.filterInactive')}</option>
              <option value="expired">{t('discounts.page.filterExpired')}</option>
            </select>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 rounded-lg bg-[#EF4444]/10 p-4 text-sm text-[#EF4444]">
            {error}
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent" />
          </div>
        ) : filteredCodes.length === 0 ? (
          /* Empty State */
          <div className="flex h-64 flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--fc-section-border,#1F1F1F)] bg-[var(--fc-section,#0A0A0A)]">
            <Tag className="mb-3 h-12 w-12 text-[var(--fc-section-muted,#A0A0A0)]" />
            <h3 className="text-lg font-medium text-[var(--fc-section-text,#FAFAFA)]">
              {searchQuery || filterStatus !== 'all'
                ? t('discounts.page.empty.withFilters')
                : t('discounts.page.empty.noFilters')}
            </h3>
            <p className="mt-1 text-sm text-[var(--fc-section-muted,#666666)]">
              {searchQuery || filterStatus !== 'all'
                ? t('discounts.page.empty.hintWithFilters')
                : t('discounts.page.empty.hintNoFilters')}
            </p>
            {!searchQuery && filterStatus === 'all' && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="mt-4 flex items-center gap-2 rounded-lg bg-[var(--fc-button,white)] px-4 py-2 text-sm font-medium text-[var(--fc-button-text,black)] hover:bg-[var(--fc-button-hover,#E0E0E0)]"
              >
                <Plus className="h-4 w-4" />
                {t('discounts.page.createButton')}
              </button>
            )}
          </div>
        ) : (
          /* Codes List */
          <div className="space-y-4">
            {filteredCodes.map((code) => (
              <div
                key={code.id}
                className="rounded-xl border border-[var(--fc-section-border,#1F1F1F)] bg-[var(--fc-section,#0A0A0A)] p-5 transition-shadow hover:border-[#333333]"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Code and Status */}
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-lg font-bold text-[var(--fc-section-text,#FAFAFA)]">
                        {code.code}
                      </span>
                      {getStatusBadge(code)}
                    </div>

                    {/* Details */}
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-[var(--fc-section-muted,#A0A0A0)]">
                      <span className="flex items-center gap-1">
                        <Percent className="h-4 w-4 text-[var(--fc-section-text,#FAFAFA)]" />
                        {code.discount_percent}{t('discounts.codeDetails.offLabel')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4 text-[var(--fc-section-text,#FAFAFA)]" />
                        {getDurationLabel(code.duration_months)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-[var(--fc-section-text,#FAFAFA)]" />
                        {code.current_uses}
                        {code.max_uses !== null ? `/${code.max_uses}` : ''} {t('discounts.codeDetails.usesLabel')}
                      </span>
                    </div>

                    {/* Target */}
                    <p className="mt-2 text-sm text-[var(--fc-section-muted,#666666)]">
                      {getTargetLabel(code)}
                    </p>

                    {/* Expiry */}
                    {code.valid_until && (
                      <p className="mt-1 text-xs text-[var(--fc-section-muted,#666666)]">
                        {isExpired(code) ? t('discounts.codeDetails.expiryExpired') : t('discounts.codeDetails.expiryExpires')}{' '}
                        {new Date(code.valid_until).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleCopyCode(code.code, code.id)}
                      className="rounded-lg p-2 text-[var(--fc-section-muted,#666666)] hover:bg-[var(--fc-section-hover,#1F1F1F)] hover:text-[var(--fc-section-muted,#A0A0A0)]"
                      title={t('discounts.actions.copyTitle')}
                    >
                      {copiedId === code.id ? (
                        <CheckCircle2 className="h-5 w-5 text-[#22C55E]" />
                      ) : (
                        <Copy className="h-5 w-5" />
                      )}
                    </button>
                    <button
                      onClick={() => handleEdit(code)}
                      className="rounded-lg p-2 text-[var(--fc-section-muted,#666666)] hover:bg-[var(--fc-section-hover,#1F1F1F)] hover:text-[var(--fc-section-muted,#A0A0A0)]"
                      title={t('discounts.actions.editTitle')}
                    >
                      <Edit2 className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleToggleActive(code)}
                      className="rounded-lg p-2 text-[var(--fc-section-muted,#666666)] hover:bg-[var(--fc-section-hover,#1F1F1F)] hover:text-[var(--fc-section-muted,#A0A0A0)]"
                      title={code.is_active ? t('discounts.actions.deactivateTitle') : t('discounts.actions.activateTitle')}
                    >
                      {code.is_active ? (
                        <ToggleRight className="h-5 w-5 text-[#22C55E]" />
                      ) : (
                        <ToggleLeft className="h-5 w-5" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(code)}
                      className="rounded-lg p-2 text-[var(--fc-section-muted,#666666)] hover:bg-[var(--fc-section-hover,#1F1F1F)] hover:text-[#EF4444]"
                      title={t('discounts.actions.deleteTitle')}
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <CreateDiscountModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        creatorId={profile.id}
        editingCode={editingCode}
        onSuccess={loadCodes}
      />
    </div>
  );
}
