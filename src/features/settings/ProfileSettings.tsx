import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Save, User, Upload, X, Camera, Info } from 'lucide-react';
import { useAuth } from '../../core/contexts/AuthContext';
import { getProfile, updateProfile, uploadAvatar, uploadCroppedAvatar, Profile } from './profileService';
import ImageCropModal from './ImageCropModal';

const ProfileSettings: React.FC = () => {
  const { t } = useTranslation();
  const { user, profile: authProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    avatar_url: '',
    bio: '',
  });
  const [cropModalFile, setCropModalFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (authProfile) {
      setFormData({
        full_name: authProfile.full_name || '',
        avatar_url: authProfile.avatar_url || '',
        bio: authProfile.bio || '',
      });
    }
  }, [authProfile]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user?.id) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setMessage({ type: 'error', text: t('creatorSettings.profile.avatar.uploadError.invalidFile') });
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setMessage({ type: 'error', text: t('creatorSettings.profile.avatar.uploadError.fileSize') });
      return;
    }

    // Open crop modal instead of directly uploading
    setMessage(null);
    setCropModalFile(file);

    // Reset file input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCropComplete = async (croppedBlob: Blob, mimeType: string) => {
    if (!user?.id) return;

    setCropModalFile(null);
    setUploading(true);
    setMessage(null);

    try {
      const publicUrl = await uploadCroppedAvatar(user.id, croppedBlob, mimeType);
      setFormData({ ...formData, avatar_url: publicUrl });
      setMessage({ type: 'success', text: t('creatorSettings.profile.avatar.uploadSuccess') });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      setMessage({ type: 'error', text: t('creatorSettings.profile.avatar.uploadFailed') });
    } finally {
      setUploading(false);
    }
  };

  const handleCropCancel = () => {
    setCropModalFile(null);
  };

  const handleSave = async () => {
    if (!user?.id) return;

    setSaving(true);
    setMessage(null);

    try {
      await updateProfile(user.id, {
        full_name: formData.full_name || null,
        avatar_url: formData.avatar_url || null,
        bio: formData.bio || null,
      });

      setMessage({ type: 'success', text: t('creatorSettings.profile.save.success') });

      // Reload the page to update the auth context
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Error saving profile:', error);
      setMessage({ type: 'error', text: t('creatorSettings.profile.save.error') });
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return t('creatorSettings.profile.memberSince.never');
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Avatar Section */}
      <div className="flex items-start gap-6">
        {/* Avatar Preview with Upload Overlay */}
        <div className="relative group">
          <img
            src={formData.avatar_url || authProfile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.full_name || authProfile?.full_name || 'User')}&background=6366f1&color=fff&size=96&bold=true`}
            alt="Profile"
            className="w-24 h-24 rounded-full border-2 border-[#333333] object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.full_name || 'User')}&background=6366f1&color=fff&size=96&bold=true`;
            }}
          />
          {/* Upload overlay */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-not-allowed"
          >
            {uploading ? (
              <Loader2 size={24} className="text-white animate-spin" />
            ) : (
              <Camera size={24} className="text-white" />
            )}
          </button>
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* User Info & Upload Button */}
        <div className="flex-1">
          <h3 className="font-medium text-[var(--fc-text,#FAFAFA)]">{authProfile?.full_name || 'User'}</h3>
          <p className="text-sm text-[var(--fc-muted,#666666)] capitalize mb-3">{authProfile?.role || 'Member'}</p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--fc-text,#FAFAFA)] border border-[var(--fc-border,#1F1F1F)] rounded-lg hover:bg-[#151515] hover:border-[#333333] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {t('common.uploading')}
              </>
            ) : (
              <>
                <Upload size={16} />
                {t('creatorSettings.profile.avatar.uploadButton')}
              </>
            )}
          </button>
          <p className="mt-2 text-xs text-[var(--fc-muted,#666666)]">
            {t('creatorSettings.profile.avatar.formats')}
          </p>
        </div>
      </div>

      {/* Full Name */}
      <div>
        <label htmlFor="full_name" className="block text-xs font-medium text-[var(--fc-muted,#A0A0A0)] mb-2">
          {t('creatorSettings.profile.fullName.label')}
        </label>
        <input
          type="text"
          id="full_name"
          value={formData.full_name}
          onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
          className="w-full px-4 py-2 bg-[var(--fc-surface,#0A0A0A)] border border-[var(--fc-border,#1F1F1F)] rounded-lg text-[var(--fc-text,#FAFAFA)] placeholder:text-[var(--fc-muted,#666666)] focus:outline-none focus:border-[#555555] focus:ring-1 focus:ring-white/10"
          placeholder={t('creatorSettings.profile.fullName.placeholder')}
        />
      </div>

      {/* Bio */}
      <div>
        <label htmlFor="bio" className="block text-xs font-medium text-[var(--fc-muted,#A0A0A0)] mb-2">
          {t('creatorSettings.profile.bio.label')}
        </label>
        <textarea
          id="bio"
          value={formData.bio}
          onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
          rows={3}
          maxLength={500}
          className="w-full px-4 py-2 bg-[var(--fc-surface,#0A0A0A)] border border-[var(--fc-border,#1F1F1F)] rounded-lg text-[var(--fc-text,#FAFAFA)] placeholder:text-[var(--fc-muted,#666666)] focus:outline-none focus:border-[#555555] focus:ring-1 focus:ring-white/10 resize-none"
          placeholder={t('creatorSettings.profile.bio.placeholder')}
        />
        <p className="mt-1 text-xs text-[var(--fc-muted,#666666)]">
          {t('creatorSettings.profile.bio.characterCount', { count: formData.bio.length })}
        </p>
        <div className="mt-2 flex items-start gap-2 p-2 bg-[#151515] rounded-lg border border-[var(--fc-border,#1F1F1F)]">
          <Info size={14} className="text-[var(--fc-muted,#A0A0A0)] mt-0.5 shrink-0" />
          <p className="text-xs text-[var(--fc-muted,#A0A0A0)]">
            {t('creatorSettings.profile.bio.visibilityHint')}
          </p>
        </div>
      </div>

      {/* Avatar URL (Advanced) */}
      <div>
        <label htmlFor="avatar_url" className="block text-xs font-medium text-[var(--fc-muted,#A0A0A0)] mb-2">
          {t('creatorSettings.profile.avatarUrl.label')}
        </label>
        <input
          type="url"
          id="avatar_url"
          value={formData.avatar_url}
          onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
          className="w-full px-4 py-2 bg-[var(--fc-surface,#0A0A0A)] border border-[var(--fc-border,#1F1F1F)] rounded-lg text-[var(--fc-text,#FAFAFA)] placeholder:text-[var(--fc-muted,#666666)] focus:outline-none focus:border-[#555555] focus:ring-1 focus:ring-white/10 text-sm"
          placeholder={t('creatorSettings.profile.avatarUrl.placeholder')}
        />
        <p className="mt-1 text-xs text-[var(--fc-muted,#666666)]">
          {t('creatorSettings.profile.avatarUrl.description')}
        </p>
      </div>

      {/* Email (Read-only) */}
      <div>
        <label htmlFor="email" className="block text-xs font-medium text-[var(--fc-muted,#A0A0A0)] mb-2">
          {t('creatorSettings.profile.email.label')}
        </label>
        <input
          type="email"
          id="email"
          value={authProfile?.email || ''}
          disabled
          className="w-full px-4 py-2 border border-[var(--fc-border,#1F1F1F)] rounded-lg bg-[var(--fc-surface,#0A0A0A)] text-[var(--fc-muted,#666666)] cursor-not-allowed"
        />
        <p className="mt-1 text-xs text-[var(--fc-muted,#666666)]">
          {t('creatorSettings.profile.email.note')}
        </p>
      </div>

      {/* Role Badge (Read-only) */}
      <div>
        <label className="block text-xs font-medium text-[var(--fc-muted,#A0A0A0)] mb-2">
          {t('creatorSettings.profile.role.label')}
        </label>
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#1F1F1F] text-[var(--fc-muted,#A0A0A0)] rounded-full text-sm font-medium capitalize">
          <User size={14} />
          {authProfile?.role || 'Member'}
        </div>
      </div>

      {/* Member Since (Read-only) */}
      <div>
        <label className="block text-xs font-medium text-[var(--fc-muted,#A0A0A0)] mb-2">
          {t('creatorSettings.profile.memberSince.label')}
        </label>
        <p className="text-[var(--fc-text,#FAFAFA)]">
          {formatDate(authProfile?.created_at || null)}
        </p>
      </div>

      {/* Success/Error Message */}
      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20'
              : 'bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/20'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t border-[var(--fc-border,#1F1F1F)]">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] rounded-lg font-medium hover:bg-[#E0E0E0] focus:outline-none focus:ring-1 focus:ring-white/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saving ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              {t('creatorSettings.profile.save.saving')}
            </>
          ) : (
            <>
              <Save size={18} />
              {t('creatorSettings.profile.save.button')}
            </>
          )}
        </button>
      </div>

      {/* Image Crop Modal */}
      {cropModalFile && (
        <ImageCropModal
          imageFile={cropModalFile}
          onCropComplete={handleCropComplete}
          onClose={handleCropCancel}
        />
      )}
    </div>
  );
};

export default ProfileSettings;
