// ============================================================================
// TBI STATUS TRACKER COMPONENT
// Tracks and displays TBI application status with auto-refresh
// ============================================================================
//
// This component:
// 1. Displays current application status
// 2. Auto-polls for status updates
// 3. Shows progress through the application flow
// 4. Handles completion and error states
//
// Usage:
//   <TBIStatusTracker
//     applicationId="app-123"
//     onStatusChange={(status) => console.log('New status:', status)}
//     onComplete={() => console.log('Application completed!')}
//     pollInterval={30000} // Poll every 30 seconds
//   />
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  RefreshCw,
  Ban,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';
import {
  TBIStatusTrackerProps,
  TBIApplication,
  TBIApplicationStatus,
  TBI_STATUS_LABELS,
  TBI_STATUS_COLORS,
} from '../tbiTypes';
import { pollApplicationStatus, cancelTBIApplication, getTBIStatusLabel } from '../tbiService';
import { useAuth } from '../../../core/contexts/AuthContext';

// Status step configuration
const STATUS_STEPS: { status: TBIApplicationStatus; label: string; icon: typeof Clock }[] = [
  { status: 'pending', label: 'Изпратена', icon: Clock },
  { status: 'processing', label: 'В обработка', icon: Loader2 },
  { status: 'approved', label: 'Одобрена', icon: CheckCircle },
  { status: 'completed', label: 'Завършена', icon: CheckCircle },
];

// Terminal states that don't need polling
const TERMINAL_STATES: TBIApplicationStatus[] = ['completed', 'rejected', 'cancelled', 'expired'];

export function TBIStatusTracker({
  applicationId,
  onStatusChange,
  onComplete,
  pollInterval = 30000, // 30 seconds default
}: TBIStatusTrackerProps) {
  const { profile } = useAuth();

  const [application, setApplication] = useState<TBIApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const pollTimerRef = useRef<number | null>(null);
  const previousStatusRef = useRef<TBIApplicationStatus | null>(null);

  // Fetch application status
  const fetchStatus = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    }

    try {
      const result = await pollApplicationStatus(applicationId);

      if (result.success && result.application) {
        setApplication(result.application);
        setError(null);

        // Check if status changed
        if (previousStatusRef.current && previousStatusRef.current !== result.application.status) {
          onStatusChange?.(result.application.status);

          // Check if completed
          if (result.application.status === 'completed') {
            onComplete?.();
          }
        }

        previousStatusRef.current = result.application.status;
      } else {
        setError(result.error || 'Failed to fetch status');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [applicationId, onStatusChange, onComplete]);

  // Initial fetch
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Set up polling
  useEffect(() => {
    if (!application || TERMINAL_STATES.includes(application.status)) {
      // Don't poll for terminal states
      return;
    }

    // Start polling
    pollTimerRef.current = window.setInterval(() => {
      fetchStatus();
    }, pollInterval);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, [application, pollInterval, fetchStatus]);

  // Handle manual refresh
  const handleRefresh = useCallback(() => {
    if (refreshing) return;
    fetchStatus(true);
  }, [refreshing, fetchStatus]);

  // Handle cancel
  const handleCancel = useCallback(async () => {
    if (!profile?.id || cancelling) return;

    const confirmed = window.confirm('Сигурни ли сте, че искате да откажете кандидатурата?');
    if (!confirmed) return;

    setCancelling(true);

    try {
      const result = await cancelTBIApplication(applicationId, profile.id);

      if (result.success) {
        setApplication((prev) =>
          prev ? { ...prev, status: 'cancelled' } : null
        );
        onStatusChange?.('cancelled');
      } else {
        alert(result.error || 'Грешка при отказване');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Грешка при отказване');
    } finally {
      setCancelling(false);
    }
  }, [applicationId, profile?.id, cancelling, onStatusChange]);

  // Get current step index
  const getCurrentStepIndex = useCallback(() => {
    if (!application) return 0;

    const statusIndex = STATUS_STEPS.findIndex((s) => s.status === application.status);
    return statusIndex >= 0 ? statusIndex : 0;
  }, [application]);

  // Loading state
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-center gap-3 py-8">
          <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
          <span className="text-gray-600">Зареждане на статуса...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !application) {
    return (
      <div className="bg-white rounded-xl border border-red-200 p-6">
        <div className="flex items-center gap-3 text-red-600">
          <AlertCircle className="w-6 h-6" />
          <div>
            <p className="font-medium">Грешка при зареждане</p>
            <p className="text-sm text-red-500">{error}</p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          className="mt-4 px-4 py-2 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
        >
          Опитай отново
        </button>
      </div>
    );
  }

  if (!application) {
    return null;
  }

  const currentStepIndex = getCurrentStepIndex();
  const isTerminal = TERMINAL_STATES.includes(application.status);
  const canCancel = ['pending', 'processing'].includes(application.status);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="https://cdn.tbibank.support/logo/tbi-bank-white.svg"
              alt="TBI Bank"
              className="h-5 w-auto"
            />
            <span className="text-white font-medium">Статус на кандидатура</span>
          </div>

          {/* Refresh button */}
          {!isTerminal && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
              title="Обнови статуса"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Status Badge */}
        <div className="flex items-center justify-between mb-6">
          <StatusBadge status={application.status} />

          {application.amount_cents && (
            <div className="text-right">
              <p className="text-sm text-gray-500">Сума</p>
              <p className="font-semibold">
                {(application.amount_cents / 100).toFixed(2)} {application.currency || 'EUR'}
              </p>
            </div>
          )}
        </div>

        {/* Progress Steps - only for non-terminal negative states */}
        {!['rejected', 'cancelled', 'expired'].includes(application.status) && (
          <div className="mb-6">
            <div className="flex items-center justify-between relative">
              {/* Progress line */}
              <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200">
                <div
                  className="h-full bg-orange-500 transition-all duration-500"
                  style={{ width: `${(currentStepIndex / (STATUS_STEPS.length - 1)) * 100}%` }}
                />
              </div>

              {/* Steps */}
              {STATUS_STEPS.map((step, index) => {
                const isActive = index === currentStepIndex;
                const isCompleted = index < currentStepIndex;
                const Icon = step.icon;

                return (
                  <div
                    key={step.status}
                    className="relative flex flex-col items-center z-10"
                  >
                    <div
                      className={`
                        w-8 h-8 rounded-full flex items-center justify-center
                        transition-all duration-300
                        ${isCompleted
                          ? 'bg-orange-500 text-white'
                          : isActive
                            ? 'bg-orange-500 text-white ring-4 ring-orange-100'
                            : 'bg-gray-200 text-gray-400'
                        }
                      `}
                    >
                      <Icon className={`w-4 h-4 ${isActive && step.status === 'processing' ? 'animate-spin' : ''}`} />
                    </div>
                    <span
                      className={`
                        text-xs mt-2 font-medium
                        ${isActive ? 'text-orange-600' : isCompleted ? 'text-gray-700' : 'text-gray-400'}
                      `}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Status-specific content */}
        {application.status === 'rejected' && (
          <div className="bg-red-50 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-700">Кандидатурата е отказана</p>
                <p className="text-sm text-red-500 mt-2">
                  Можете да опитате отново с различни данни или да се свържете с TBI Bank за повече информация.
                </p>
              </div>
            </div>
          </div>
        )}

        {application.status === 'cancelled' && (
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <Ban className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-gray-700">Кандидатурата е отказана</p>
                <p className="text-sm text-gray-500 mt-1">
                  Вие отказахте тази кандидатура. Можете да кандидатствате отново по всяко време.
                </p>
              </div>
            </div>
          </div>
        )}

        {application.status === 'expired' && (
          <div className="bg-yellow-50 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-700">Кандидатурата е изтекла</p>
                <p className="text-sm text-yellow-600 mt-1">
                  Времето за завършване на кандидатурата изтече. Моля, кандидатствайте отново.
                </p>
              </div>
            </div>
          </div>
        )}

        {application.status === 'completed' && (
          <div className="bg-green-50 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-green-700">Кандидатурата е одобрена!</p>
                <p className="text-sm text-green-600 mt-1">
                  Имате пълен достъп до съдържанието. Добре дошли!
                </p>
              </div>
            </div>
          </div>
        )}

        {application.status === 'approved' && (
          <div className="bg-blue-50 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-blue-700">Кандидатурата е одобрена</p>
                <p className="text-sm text-blue-600 mt-1">
                  Моля, завършете процеса в TBI Bank за да получите достъп.
                </p>
                {application.status_url && (
                  <a
                    href={application.status_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 mt-2 underline"
                  >
                    Продължи към TBI Bank
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {['pending', 'processing'].includes(application.status) && (
          <div className="bg-orange-50 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <Loader2 className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5 animate-spin" />
              <div>
                <p className="font-medium text-orange-700">
                  {application.status === 'pending' ? 'Очаква проверка' : 'В процес на обработка'}
                </p>
                <p className="text-sm text-orange-600 mt-1">
                  TBI Bank ще се свърже с вас на {application.customer_phone} за потвърждение.
                  Обикновено отнема между 5 минути и 24 часа.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Application details */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          {application.monthly_installment_cents && application.installment_count && (
            <div>
              <p className="text-gray-500">Месечна вноска</p>
              <p className="font-medium">
                {(application.monthly_installment_cents / 100).toFixed(2)} {application.currency || 'EUR'} x {application.installment_count}
              </p>
            </div>
          )}

          <div>
            <p className="text-gray-500">Номер на кандидатура</p>
            <p className="font-mono text-xs">{applicationId.slice(0, 8)}...</p>
          </div>

          <div>
            <p className="text-gray-500">Дата на кандидатстване</p>
            <p className="font-medium">
              {new Date(application.created_at).toLocaleDateString('bg-BG')}
            </p>
          </div>

          {application.expires_at && !isTerminal && (
            <div>
              <p className="text-gray-500">Валидна до</p>
              <p className="font-medium">
                {new Date(application.expires_at).toLocaleDateString('bg-BG')}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        {canCancel && (
          <div className="mt-6 pt-4 border-t border-gray-100">
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="text-sm text-gray-500 hover:text-red-600 transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              {cancelling ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Отказване...
                </>
              ) : (
                <>
                  <Ban className="w-3.5 h-3.5" />
                  Откажи кандидатурата
                </>
              )}
            </button>
          </div>
        )}

        {/* Help link */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <a
            href="https://www.tbibank.bg/bg/contact"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-500 hover:text-orange-600 transition-colors flex items-center gap-1"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Нужда от помощ? Свържете се с TBI Bank
          </a>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// STATUS BADGE COMPONENT
// ============================================================================

function StatusBadge({ status }: { status: TBIApplicationStatus }) {
  const getIcon = () => {
    switch (status) {
      case 'pending':
      case 'processing':
        return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'approved':
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'rejected':
        return <XCircle className="w-4 h-4" />;
      case 'cancelled':
        return <Ban className="w-4 h-4" />;
      case 'expired':
        return <Clock className="w-4 h-4" />;
      default:
        return <HelpCircle className="w-4 h-4" />;
    }
  };

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium
        ${TBI_STATUS_COLORS[status]}
      `}
    >
      {getIcon()}
      {getTBIStatusLabel(status)}
    </span>
  );
}

// ============================================================================
// COMPACT STATUS BADGE
// For use in lists and cards
// ============================================================================

export function TBIStatusBadge({ status }: { status: TBIApplicationStatus }) {
  return <StatusBadge status={status} />;
}
