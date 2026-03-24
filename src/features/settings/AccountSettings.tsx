import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Lock, LogOut, AlertCircle, Mail, Trash2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../core/contexts/AuthContext';
import { updatePassword, updateEmail, deleteAccount } from './profileService';

// Confirmation Dialog Component
interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  confirmButtonText: string;
  cancelButtonText: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDangerous?: boolean;
  requireTypedConfirmation?: boolean;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText,
  confirmButtonText,
  cancelButtonText,
  onConfirm,
  onCancel,
  isDangerous = false,
  requireTypedConfirmation = false,
}) => {
  const [typedConfirmation, setTypedConfirmation] = useState('');

  if (!isOpen) return null;

  const canConfirm = !requireTypedConfirmation || typedConfirmation === confirmText;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-[var(--fc-section,#0A0A0A)] rounded-xl border border-[var(--fc-section-border,#1F1F1F)] max-w-md w-full p-6">
        <div className={`flex items-center gap-3 mb-4 ${isDangerous ? 'text-[#EF4444]' : 'text-[var(--fc-section-text,#FAFAFA)]'}`}>
          {isDangerous && <AlertTriangle size={24} />}
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        <p className="text-[var(--fc-section-muted,#A0A0A0)] mb-4">{message}</p>

        {requireTypedConfirmation && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-[var(--fc-section-muted,#A0A0A0)] mb-2">
              Type <span className="font-mono bg-[var(--fc-section-hover,#1F1F1F)] px-1 rounded text-[var(--fc-section-text,#FAFAFA)]">{confirmText}</span> to confirm:
            </label>
            <input
              type="text"
              value={typedConfirmation}
              onChange={(e) => setTypedConfirmation(e.target.value)}
              className="w-full px-4 py-2 bg-[var(--fc-section,#0A0A0A)] border border-[var(--fc-section-border,#1F1F1F)] rounded-lg text-[var(--fc-section-text,#FAFAFA)] placeholder:text-[var(--fc-section-muted,#666666)] focus:outline-none focus:border-[var(--fc-section-text,#555555)] focus:ring-1 focus:ring-white/10"
              placeholder={confirmText}
            />
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={() => {
              setTypedConfirmation('');
              onCancel();
            }}
            className="px-4 py-2 text-[var(--fc-section-text,#FAFAFA)] border border-[var(--fc-section-border,#1F1F1F)] rounded-lg hover:bg-[var(--fc-section-hover,#151515)] hover:border-[var(--fc-section-border,#333333)] transition-colors"
          >
            {cancelButtonText}
          </button>
          <button
            onClick={() => {
              setTypedConfirmation('');
              onConfirm();
            }}
            disabled={!canConfirm}
            className={`px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isDangerous
                ? 'bg-[#EF4444] text-white hover:bg-[#EF4444]/80'
                : 'bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] hover:bg-[var(--fc-button-hover,#E0E0E0)]'
            }`}
          >
            {confirmButtonText}
          </button>
        </div>
      </div>
    </div>
  );
};

const AccountSettings: React.FC = () => {
  const { t } = useTranslation();
  const { signOut, profile } = useAuth();

  // Password change state
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Email change state
  const [changingEmail, setChangingEmail] = useState(false);
  const [emailMessage, setEmailMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [newEmail, setNewEmail] = useState('');

  // Sign out confirmation state
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  // Account deletion state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handlePasswordChange = async () => {
    setPasswordMessage(null);

    // Validation
    if (!passwords.currentPassword || !passwords.newPassword || !passwords.confirmPassword) {
      setPasswordMessage({ type: 'error', text: t('creatorSettings.account.password.validation.required') });
      return;
    }

    if (passwords.newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: t('creatorSettings.account.password.validation.minLength') });
      return;
    }

    if (passwords.newPassword !== passwords.confirmPassword) {
      setPasswordMessage({ type: 'error', text: t('creatorSettings.account.password.validation.mismatch') });
      return;
    }

    setChangingPassword(true);

    try {
      await updatePassword(passwords.currentPassword, passwords.newPassword);
      setPasswordMessage({ type: 'success', text: t('creatorSettings.account.password.success') });
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      console.error('Error changing password:', error);
      setPasswordMessage({
        type: 'error',
        text: error.message || t('creatorSettings.account.password.error'),
      });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleEmailChange = async () => {
    setEmailMessage(null);

    if (!newEmail || !newEmail.includes('@')) {
      setEmailMessage({ type: 'error', text: t('creatorSettings.account.email.validation.invalid') });
      return;
    }

    if (newEmail === profile?.email) {
      setEmailMessage({ type: 'error', text: t('creatorSettings.account.email.validation.same') });
      return;
    }

    setChangingEmail(true);

    try {
      await updateEmail(newEmail);
      setEmailMessage({ type: 'success', text: t('creatorSettings.account.email.success') });
      setNewEmail('');
    } catch (error: any) {
      console.error('Error changing email:', error);
      setEmailMessage({
        type: 'error',
        text: error.message || t('creatorSettings.account.email.error'),
      });
    } finally {
      setChangingEmail(false);
    }
  };

  const handleSignOut = async () => {
    setShowSignOutConfirm(false);
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleDeleteAccount = async () => {
    setShowDeleteConfirm(false);
    setDeleting(true);
    setDeleteMessage(null);

    try {
      await deleteAccount();
      // User will be signed out automatically when their account is deleted
    } catch (error: any) {
      console.error('Error deleting account:', error);
      setDeleteMessage({
        type: 'error',
        text: error.message || t('creatorSettings.account.dangerZone.error'),
      });
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Change Password Section */}
      <div>
        <h3 className="text-lg font-semibold text-[var(--fc-section-text,#FAFAFA)] mb-4 flex items-center gap-2">
          <Lock size={20} className="text-[var(--fc-section-text,#FAFAFA)]" />
          {t('creatorSettings.account.password.title')}
        </h3>

        <div className="space-y-4">
          {/* Current Password */}
          <div>
            <label htmlFor="current_password" className="block text-xs font-medium text-[var(--fc-section-muted,#A0A0A0)] mb-2">
              {t('creatorSettings.account.password.currentLabel')}
            </label>
            <input
              type="password"
              id="current_password"
              value={passwords.currentPassword}
              onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
              className="w-full px-4 py-2 bg-[var(--fc-section,#0A0A0A)] border border-[var(--fc-section-border,#1F1F1F)] rounded-lg text-[var(--fc-section-text,#FAFAFA)] placeholder:text-[var(--fc-section-muted,#666666)] focus:outline-none focus:border-[var(--fc-section-text,#555555)] focus:ring-1 focus:ring-white/10"
              placeholder={t('creatorSettings.account.password.currentPlaceholder')}
            />
          </div>

          {/* New Password */}
          <div>
            <label htmlFor="new_password" className="block text-xs font-medium text-[var(--fc-section-muted,#A0A0A0)] mb-2">
              {t('creatorSettings.account.password.newLabel')}
            </label>
            <input
              type="password"
              id="new_password"
              value={passwords.newPassword}
              onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
              className="w-full px-4 py-2 bg-[var(--fc-section,#0A0A0A)] border border-[var(--fc-section-border,#1F1F1F)] rounded-lg text-[var(--fc-section-text,#FAFAFA)] placeholder:text-[var(--fc-section-muted,#666666)] focus:outline-none focus:border-[var(--fc-section-text,#555555)] focus:ring-1 focus:ring-white/10"
              placeholder={t('creatorSettings.account.password.newPlaceholder')}
            />
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="confirm_password" className="block text-xs font-medium text-[var(--fc-section-muted,#A0A0A0)] mb-2">
              {t('creatorSettings.account.password.confirmLabel')}
            </label>
            <input
              type="password"
              id="confirm_password"
              value={passwords.confirmPassword}
              onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
              className="w-full px-4 py-2 bg-[var(--fc-section,#0A0A0A)] border border-[var(--fc-section-border,#1F1F1F)] rounded-lg text-[var(--fc-section-text,#FAFAFA)] placeholder:text-[var(--fc-section-muted,#666666)] focus:outline-none focus:border-[var(--fc-section-text,#555555)] focus:ring-1 focus:ring-white/10"
              placeholder={t('creatorSettings.account.password.confirmPlaceholder')}
            />
          </div>

          {/* Password Message */}
          {passwordMessage && (
            <div
              className={`p-4 rounded-lg flex items-start gap-3 ${
                passwordMessage.type === 'success'
                  ? 'bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20'
                  : 'bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/20'
              }`}
            >
              <AlertCircle size={20} className="shrink-0 mt-0.5" />
              <span className="text-sm">{passwordMessage.text}</span>
            </div>
          )}

          {/* Update Password Button */}
          <div className="flex justify-start">
            <button
              onClick={handlePasswordChange}
              disabled={changingPassword}
              className="px-6 py-2.5 bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] rounded-lg font-medium hover:bg-[var(--fc-button-hover,#E0E0E0)] focus:outline-none focus:ring-1 focus:ring-white/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {changingPassword ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  {t('creatorSettings.account.password.updating')}
                </>
              ) : (
                <>
                  <Lock size={18} />
                  {t('creatorSettings.account.password.button')}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-[var(--fc-section-border,#1F1F1F)]" />

      {/* Change Email Section */}
      <div>
        <h3 className="text-lg font-semibold text-[var(--fc-section-text,#FAFAFA)] mb-4 flex items-center gap-2">
          <Mail size={20} className="text-[var(--fc-section-text,#FAFAFA)]" />
          {t('creatorSettings.account.email.title')}
        </h3>

        <p className="text-sm text-[var(--fc-section-muted,#A0A0A0)] mb-4">
          {t('creatorSettings.account.email.description')}
        </p>

        <p className="text-sm text-[var(--fc-section-muted,#666666)] mb-4">
          {t('creatorSettings.account.email.current')}: <span className="font-medium text-[var(--fc-section-text,#FAFAFA)]">{profile?.email}</span>
        </p>

        <div className="space-y-4">
          <div>
            <label htmlFor="new_email" className="block text-xs font-medium text-[var(--fc-section-muted,#A0A0A0)] mb-2">
              {t('creatorSettings.account.email.newLabel')}
            </label>
            <input
              type="email"
              id="new_email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full px-4 py-2 bg-[var(--fc-section,#0A0A0A)] border border-[var(--fc-section-border,#1F1F1F)] rounded-lg text-[var(--fc-section-text,#FAFAFA)] placeholder:text-[var(--fc-section-muted,#666666)] focus:outline-none focus:border-[var(--fc-section-text,#555555)] focus:ring-1 focus:ring-white/10"
              placeholder={t('creatorSettings.account.email.newPlaceholder')}
            />
          </div>

          {/* Email Message */}
          {emailMessage && (
            <div
              className={`p-4 rounded-lg flex items-start gap-3 ${
                emailMessage.type === 'success'
                  ? 'bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20'
                  : 'bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/20'
              }`}
            >
              <AlertCircle size={20} className="shrink-0 mt-0.5" />
              <span className="text-sm">{emailMessage.text}</span>
            </div>
          )}

          <div className="flex justify-start">
            <button
              onClick={handleEmailChange}
              disabled={changingEmail}
              className="px-6 py-2.5 bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] rounded-lg font-medium hover:bg-[var(--fc-button-hover,#E0E0E0)] focus:outline-none focus:ring-1 focus:ring-white/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {changingEmail ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  {t('creatorSettings.account.email.updating')}
                </>
              ) : (
                <>
                  <Mail size={18} />
                  {t('creatorSettings.account.email.button')}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-[var(--fc-section-border,#1F1F1F)]" />

      {/* Sign Out Section */}
      <div>
        <h3 className="text-lg font-semibold text-[var(--fc-section-text,#FAFAFA)] mb-4 flex items-center gap-2">
          <LogOut size={20} className="text-[#EAB308]" />
          {t('creatorSettings.account.signOut.title')}
        </h3>

        <p className="text-sm text-[var(--fc-section-muted,#A0A0A0)] mb-4">
          {t('creatorSettings.account.signOut.description')}
        </p>

        <button
          onClick={() => setShowSignOutConfirm(true)}
          className="px-6 py-2.5 bg-[#EAB308] text-black rounded-lg font-medium hover:bg-[#EAB308]/80 focus:outline-none focus:ring-1 focus:ring-white/10 flex items-center gap-2"
        >
          <LogOut size={18} />
          {t('creatorSettings.account.signOut.button')}
        </button>
      </div>

      {/* Divider */}
      <div className="border-t border-[var(--fc-section-border,#1F1F1F)]" />

      {/* Danger Zone */}
      <div className="bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-[#EF4444] mb-2 flex items-center gap-2">
          <Trash2 size={20} />
          {t('creatorSettings.account.dangerZone.title')}
        </h3>
        <p className="text-sm text-[#EF4444]/80 mb-4">
          {t('creatorSettings.account.dangerZone.description')}
        </p>

        {deleteMessage && (
          <div className="p-4 rounded-lg bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/20 mb-4 flex items-start gap-3">
            <AlertCircle size={20} className="shrink-0 mt-0.5" />
            <span className="text-sm">{deleteMessage.text}</span>
          </div>
        )}

        <button
          onClick={() => setShowDeleteConfirm(true)}
          disabled={deleting}
          className="px-6 py-2.5 bg-[#EF4444] text-white rounded-lg font-medium hover:bg-[#EF4444]/80 focus:outline-none focus:ring-1 focus:ring-white/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {deleting ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              {t('creatorSettings.account.dangerZone.deleting')}
            </>
          ) : (
            <>
              <Trash2 size={18} />
              {t('creatorSettings.account.dangerZone.button')}
            </>
          )}
        </button>
      </div>

      {/* Sign Out Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showSignOutConfirm}
        title={t('creatorSettings.account.signOut.confirmTitle')}
        message={t('creatorSettings.account.signOut.confirmMessage')}
        confirmText=""
        confirmButtonText={t('creatorSettings.account.signOut.confirmButton')}
        cancelButtonText={t('common.cancel')}
        onConfirm={handleSignOut}
        onCancel={() => setShowSignOutConfirm(false)}
      />

      {/* Delete Account Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={t('creatorSettings.account.dangerZone.confirmTitle')}
        message={t('creatorSettings.account.dangerZone.confirmMessage')}
        confirmText="DELETE"
        confirmButtonText={t('creatorSettings.account.dangerZone.confirmButton')}
        cancelButtonText={t('common.cancel')}
        onConfirm={handleDeleteAccount}
        onCancel={() => setShowDeleteConfirm(false)}
        isDangerous={true}
        requireTypedConfirmation={true}
      />
    </div>
  );
};

export default AccountSettings;
