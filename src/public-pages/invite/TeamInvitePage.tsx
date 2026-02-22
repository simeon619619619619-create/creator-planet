import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Users, AlertCircle, CheckCircle, Clock, LogIn, UserPlus, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../core/contexts/AuthContext';
import { Logo } from '../../shared/Logo';
import LanguageSwitcher from '../../shared/LanguageSwitcher';
import { getInviteByToken, acceptTeamInvitation } from '../../features/direct-messages/teamService';
import type { DbCommunityTeamMember, TeamMemberRole } from '../../features/direct-messages/dmTypes';

// Role badge color configuration
const roleBadgeColors: Record<TeamMemberRole, { bg: string; text: string }> = {
  lecturer: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  assistant: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  guest_expert: { bg: 'bg-amber-100', text: 'text-amber-700' },
};

type InviteState = 'loading' | 'invalid' | 'expired' | 'valid' | 'already_accepted';

interface InviteData {
  invite: DbCommunityTeamMember;
  community: { id: string; name: string; logo_url: string | null };
  creator: { full_name: string | null } | null;
}

const TeamInvitePage: React.FC = () => {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, profile, isLoading: authLoading } = useAuth();

  const [state, setState] = useState<InviteState>('loading');
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  // Validate the invite token on mount
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setState('invalid');
        return;
      }

      try {
        const result = await getInviteByToken(token);

        if (result.error) {
          // Check if it's an expiration error
          if (result.error.toLowerCase().includes('expired')) {
            setState('expired');
          } else if (result.error.toLowerCase().includes('already')) {
            setState('already_accepted');
          } else {
            setState('invalid');
            setErrorMessage(result.error);
          }
          return;
        }

        if (!result.invite || !result.community) {
          setState('invalid');
          return;
        }

        // Check expiration
        if (result.invite.invite_expires_at) {
          const expiresAt = new Date(result.invite.invite_expires_at);
          if (expiresAt < new Date()) {
            setState('expired');
            return;
          }
        }

        // Check if already accepted
        if (result.invite.invite_status === 'accepted') {
          setState('already_accepted');
          return;
        }

        setInviteData({
          invite: result.invite,
          community: result.community,
          creator: result.creator,
        });
        setState('valid');
      } catch (error) {
        console.error('Error validating invite token:', error);
        setState('invalid');
      }
    };

    validateToken();
  }, [token]);

  // Redirect if already accepted and logged in
  useEffect(() => {
    if (state === 'already_accepted' && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [state, user, navigate]);

  // Check if user is a creator (can't accept team invites)
  const isCreator = profile?.role === 'creator';

  // Handle accept invitation
  const handleAccept = async () => {
    if (!token || !profile?.id || !profile?.role) return;

    setIsAccepting(true);
    setAcceptError(null);

    try {
      const result = await acceptTeamInvitation(token, profile.id, profile.role);

      if (!result.success) {
        // Map error codes to user-friendly messages
        const errorMessage = result.errorCode
          ? t(`team.invite.error.${result.errorCode}`, { defaultValue: result.error || t('team.invite.error.accept') })
          : result.error || t('team.invite.error.accept');
        setAcceptError(errorMessage);
        return;
      }

      // Redirect to dashboard on success
      navigate('/dashboard', { replace: true });
    } catch (error) {
      console.error('Error accepting invitation:', error);
      setAcceptError(t('team.invite.error.accept'));
    } finally {
      setIsAccepting(false);
    }
  };

  // Get role display name
  const getRoleDisplayName = (role: TeamMemberRole): string => {
    return t(`team.roles.${role}`);
  };

  // Build return URL for login/signup
  const returnUrl = token ? `/invite/team/${token}` : '';
  const encodedReturnUrl = encodeURIComponent(returnUrl);

  // Loading state
  if (state === 'loading' || authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-600">{t('team.invite.loading')}</p>
          </div>
        </main>
      </div>
    );
  }

  // Invalid state
  if (state === 'invalid') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 mb-2">
                {t('team.invite.invalid.title')}
              </h1>
              <p className="text-slate-600 mb-4">
                {errorMessage || t('team.invite.invalid.description')}
              </p>
              <p className="text-sm text-slate-500">
                {t('team.invite.invalid.contact')}
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Expired state
  if (state === 'expired') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-amber-600" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 mb-2">
                {t('team.invite.expired.title')}
              </h1>
              <p className="text-slate-600 mb-4">
                {t('team.invite.expired.description')}
              </p>
              <p className="text-sm text-slate-500">
                {t('team.invite.invalid.contact')}
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Already accepted - will redirect if logged in
  if (state === 'already_accepted') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 mb-2">
                {t('team.invite.alreadyAccepted.title')}
              </h1>
              <p className="text-slate-600 mb-6">
                {t('team.invite.alreadyAccepted.description')}
              </p>
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                <LogIn className="w-5 h-5" />
                {t('common.logIn')}
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Valid invite state
  if (!inviteData) {
    return null; // Should not happen
  }

  const { invite, community, creator } = inviteData;
  const roleColors = roleBadgeColors[invite.role];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Community header with logo */}
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-6 text-center">
              <div className="w-20 h-20 mx-auto mb-3 rounded-xl overflow-hidden bg-white/20 flex items-center justify-center">
                {community.logo_url ? (
                  <img
                    src={community.logo_url}
                    alt={community.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Users className="w-10 h-10 text-white" />
                )}
              </div>
              <h2 className="text-xl font-bold text-white">{community.name}</h2>
              {creator?.full_name && (
                <p className="text-white/80 text-sm mt-1">
                  {t('team.invite.valid.createdBy', { creatorName: creator.full_name })}
                </p>
              )}
            </div>

            {/* Invite content */}
            <div className="p-6">
              {/* Role badge */}
              <div className="flex justify-center mb-4">
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${roleColors.bg} ${roleColors.text}`}
                >
                  {getRoleDisplayName(invite.role)}
                </span>
              </div>

              {/* Title if set */}
              {invite.title && (
                <p className="text-center text-slate-600 mb-4">{invite.title}</p>
              )}

              {/* Invitation message */}
              <div className="text-center mb-6">
                <h1 className="text-xl font-bold text-slate-900 mb-2">
                  {t('team.invite.valid.title')}
                </h1>
                <p className="text-slate-600">
                  {t('team.invite.valid.description', {
                    communityName: community.name,
                    role: getRoleDisplayName(invite.role),
                  })}
                </p>
              </div>

              {/* Error message */}
              {acceptError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-red-700 text-sm">{acceptError}</p>
                </div>
              )}

              {/* Actions based on auth state */}
              {user && profile ? (
                isCreator ? (
                  // Creator account - cannot accept team invites
                  <div className="space-y-4">
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-start gap-3">
                        <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-amber-800 font-medium text-sm">
                            {t('team.invite.creatorAccount.title')}
                          </p>
                          <p className="text-amber-700 text-sm mt-1">
                            {t('team.invite.creatorAccount.description')}
                          </p>
                        </div>
                      </div>
                    </div>
                    <p className="text-center text-slate-500 text-sm">
                      {t('team.invite.creatorAccount.hint', { email: profile.email })}
                    </p>
                    <Link
                      to={`/signup?return=${encodedReturnUrl}`}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <UserPlus className="w-5 h-5" />
                      {t('team.invite.creatorAccount.signupStudent')}
                    </Link>
                  </div>
                ) : (
                  // Student account - show accept button
                  <button
                    onClick={handleAccept}
                    disabled={isAccepting}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {isAccepting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        {t('team.invite.accepting')}
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        {t('team.invite.valid.accept')}
                      </>
                    )}
                  </button>
                )
              ) : (
                // Not logged in - show signup/login buttons
                <div className="space-y-3">
                  <Link
                    to={`/signup?return=${encodedReturnUrl}`}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <UserPlus className="w-5 h-5" />
                    {t('team.invite.valid.signup')}
                  </Link>
                  <Link
                    to={`/login?return=${encodedReturnUrl}`}
                    className="w-full bg-white hover:bg-slate-50 text-slate-700 font-semibold py-3 px-4 rounded-lg border border-slate-300 transition-colors flex items-center justify-center gap-2"
                  >
                    <LogIn className="w-5 h-5" />
                    {t('team.invite.valid.login')}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

// Header component
const Header: React.FC = () => {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center">
          <Logo variant="dark" size="md" showText={false} />
        </Link>
        <LanguageSwitcher variant="minimal" />
      </div>
    </header>
  );
};

export default TeamInvitePage;
