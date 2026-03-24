import React from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, BellOff, MessageSquare, Calendar, BookOpen, Users, Loader2 } from 'lucide-react';
import { useAuth } from '../../core/contexts/AuthContext';
import { usePushNotifications } from '../notifications/hooks/usePushNotifications';
import { useNotificationPreferences } from '../notifications/hooks/useNotificationPreferences';
import type { NotificationPreferences } from '../notifications/notificationPreferencesService';

interface ToggleProps {
  enabled: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

const Toggle: React.FC<ToggleProps> = ({ enabled, onChange, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={enabled}
    disabled={disabled}
    onClick={() => onChange(!enabled)}
    className={`
      relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent
      transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-[var(--fc-section,#0A0A0A)]
      ${enabled ? 'bg-white' : 'bg-[#333333]'}
      ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
    `}
  >
    <span
      className={`
        pointer-events-none inline-block h-5 w-5 rounded-full shadow-lg ring-0
        transition duration-200 ease-in-out
        ${enabled ? 'translate-x-5 bg-[var(--fc-section,#0A0A0A)]' : 'translate-x-0 bg-[#666666]'}
      `}
    />
  </button>
);

interface CategoryToggleProps {
  icon: React.ElementType;
  label: string;
  description: string;
  enabled: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

const CategoryToggle: React.FC<CategoryToggleProps> = ({
  icon: Icon,
  label,
  description,
  enabled,
  onChange,
  disabled,
}) => (
  <div className="flex items-center justify-between py-4 border-b border-[var(--fc-section-border,#1F1F1F)] last:border-0">
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-[var(--fc-section-muted,#666666)]">
        <Icon size={18} />
      </div>
      <div>
        <p className="text-sm font-medium text-[var(--fc-section-text,#FAFAFA)]">{label}</p>
        <p className="text-xs text-[var(--fc-section-muted,#666666)] mt-0.5">{description}</p>
      </div>
    </div>
    <Toggle enabled={enabled} onChange={onChange} disabled={disabled} />
  </div>
);

const NotificationSettings: React.FC = () => {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const profileId = profile?.id;

  const push = usePushNotifications(profileId);
  const { prefs, isLoading: prefsLoading, isSaving, updatePreference } = useNotificationPreferences(profileId);

  const isLoading = push.isLoading || prefsLoading;
  const categoriesDisabled = !push.isSubscribed || isSaving;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-[var(--fc-section-muted,#666666)]" size={24} />
      </div>
    );
  }

  // Browser doesn't support push
  if (!push.isSupported) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-[var(--fc-section-text,#FAFAFA)] mb-2">{t('notificationSettings.title')}</h2>
          <p className="text-[var(--fc-section-muted,#A0A0A0)] text-sm">{t('notificationSettings.description')}</p>
        </div>
        <div className="bg-[var(--fc-section,#0A0A0A)] rounded-lg p-6 border border-[var(--fc-section-border,#1F1F1F)]">
          <div className="flex items-center gap-3 text-[var(--fc-section-muted,#666666)]">
            <BellOff size={20} />
            <p className="text-sm">{t('notificationSettings.notSupported')}</p>
          </div>
        </div>
      </div>
    );
  }

  const categories: {
    key: keyof NotificationPreferences;
    icon: React.ElementType;
    labelKey: string;
    descKey: string;
  }[] = [
    { key: 'dm_messages', icon: MessageSquare, labelKey: 'dmMessages', descKey: 'dmMessagesDescription' },
    { key: 'event_created', icon: Calendar, labelKey: 'eventCreated', descKey: 'eventCreatedDescription' },
    { key: 'event_reminder', icon: Calendar, labelKey: 'eventReminder', descKey: 'eventReminderDescription' },
    { key: 'course_new_lesson', icon: BookOpen, labelKey: 'courseNewLesson', descKey: 'courseNewLessonDescription' },
    { key: 'course_enrollment', icon: BookOpen, labelKey: 'courseEnrollment', descKey: 'courseEnrollmentDescription' },
    { key: 'community_new_post', icon: Users, labelKey: 'communityNewPost', descKey: 'communityNewPostDescription' },
    { key: 'community_comment_reply', icon: Users, labelKey: 'communityCommentReply', descKey: 'communityCommentReplyDescription' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--fc-section-text,#FAFAFA)] mb-2">{t('notificationSettings.title')}</h2>
        <p className="text-[var(--fc-section-muted,#A0A0A0)] text-sm">{t('notificationSettings.description')}</p>
      </div>

      {/* Push Notifications Toggle */}
      <div className="bg-[var(--fc-section,#0A0A0A)] rounded-lg p-6 border border-[var(--fc-section-border,#1F1F1F)]">
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-[var(--fc-section-text,#FAFAFA)]">
              {push.isSubscribed ? <Bell size={20} /> : <BellOff size={20} />}
            </div>
            <div>
              <h3 className="font-medium text-[var(--fc-section-text,#FAFAFA)]">{t('notificationSettings.pushNotifications')}</h3>
              <p className="text-sm text-[var(--fc-section-muted,#666666)] mt-1">{t('notificationSettings.pushDescription')}</p>
              {push.permission === 'denied' && (
                <p className="text-xs text-[#EF4444] mt-2">{t('notificationSettings.permissionDenied')}</p>
              )}
            </div>
          </div>
          <button
            onClick={() => push.isSubscribed ? push.unsubscribe() : push.subscribe()}
            disabled={push.isLoading || push.permission === 'denied'}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${push.isSubscribed
                ? 'bg-[var(--fc-section-hover,#1F1F1F)] text-[var(--fc-section-muted,#A0A0A0)] hover:bg-[var(--fc-section-hover,#333333)]'
                : 'bg-white text-[#0A0A0A] hover:bg-[var(--fc-button-hover,#E0E0E0)]'}
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            {push.isLoading ? (
              <Loader2 className="animate-spin" size={16} />
            ) : push.isSubscribed ? (
              t('notificationSettings.disable')
            ) : (
              t('notificationSettings.enable')
            )}
          </button>
        </div>
      </div>

      {/* Category Toggles */}
      {push.isSubscribed && prefs && (
        <div className="bg-[var(--fc-section,#0A0A0A)] rounded-lg border border-[var(--fc-section-border,#1F1F1F)]">
          <div className="px-6 py-4 border-b border-[var(--fc-section-border,#1F1F1F)]">
            <h3 className="font-medium text-[var(--fc-section-text,#FAFAFA)]">{t('notificationSettings.categories')}</h3>
            <p className="text-sm text-[var(--fc-section-muted,#666666)] mt-1">{t('notificationSettings.categoriesDescription')}</p>
          </div>
          <div className="px-6">
            {categories.map((cat) => (
              <CategoryToggle
                key={cat.key}
                icon={cat.icon}
                label={t(`notificationSettings.${cat.labelKey}`)}
                description={t(`notificationSettings.${cat.descKey}`)}
                enabled={prefs[cat.key]}
                onChange={(val) => updatePreference(cat.key, val)}
                disabled={categoriesDisabled}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationSettings;
