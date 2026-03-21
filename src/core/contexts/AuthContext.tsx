import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';
import { Profile, UserRole } from '../types';

export interface TeamMembershipInfo {
  teamMemberId: string;
  communityId: string;
  communityName: string;
  role: 'lecturer' | 'assistant' | 'guest_expert';
  title: string | null;
}

// Split context types
interface AuthStateContextType {
  user: User | null;
  profile: Profile | null;
  role: UserRole | null;
  session: Session | null;
  isLoading: boolean;
  teamMemberships: TeamMembershipInfo[] | null;
  isTeamMemberOnly: boolean;
  primaryTeamCommunity: string | null;
}

interface AuthActionsContextType {
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, fullName: string, role: UserRole, marketingOptIn?: boolean, phone?: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: AuthError | null }>;
}

// Combined type for backward compatibility
type AuthContextType = AuthStateContextType & AuthActionsContextType;

const AuthStateContext = createContext<AuthStateContextType | undefined>(undefined);
const AuthActionsContext = createContext<AuthActionsContextType | undefined>(undefined);

// Backward-compatible hook - returns both state and actions
export const useAuth = (): AuthContextType => {
  const state = useContext(AuthStateContext);
  const actions = useContext(AuthActionsContext);
  if (!state || !actions) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return { ...state, ...actions };
};

// New hook for components that only need actions (won't re-render on state changes)
export const useAuthActions = (): AuthActionsContextType => {
  const context = useContext(AuthActionsContext);
  if (!context) {
    throw new Error('useAuthActions must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [teamMemberships, setTeamMemberships] = useState<TeamMembershipInfo[] | null>(null);
  const [hasRegularMembershipsState, setHasRegularMembershipsState] = useState<boolean>(true);

  // Fetch user profile from database
  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }

      return data as Profile;
    } catch (error) {
      console.error('Error in fetchProfile:', error);
      return null;
    }
  };

  // Fetch team memberships for a profile
  const fetchTeamMemberships = async (profileId: string): Promise<TeamMembershipInfo[]> => {
    try {
      const { data, error } = await supabase
        .from('community_team_members')
        .select(`
          id,
          community_id,
          role,
          title,
          communities!inner(name)
        `)
        .eq('profile_id', profileId)
        .eq('invite_status', 'accepted');

      if (error || !data) return [];

      return data.map(tm => ({
        teamMemberId: tm.id,
        communityId: tm.community_id,
        communityName: (tm.communities as any)?.name || 'Unknown',
        role: tm.role as 'lecturer' | 'assistant' | 'guest_expert',
        title: tm.title,
      }));
    } catch (error) {
      console.error('Error fetching team memberships:', error);
      return [];
    }
  };

  // Check if user has regular memberships (owner or member, not just team member)
  const checkHasRegularMemberships = async (profileId: string): Promise<boolean> => {
    try {
      // Check if user owns any communities (creator)
      const { data: ownedCommunities } = await supabase
        .from('communities')
        .select('id')
        .eq('creator_id', profileId)
        .limit(1);

      if (ownedCommunities && ownedCommunities.length > 0) return true;

      // Check if user has regular memberships (as student/member)
      const { data: memberships } = await supabase
        .from('memberships')
        .select('id')
        .eq('user_id', profileId)
        .limit(1);

      // If they have memberships, consider them to have regular memberships
      // The CommunityContext will handle filtering appropriately
      if (memberships && memberships.length > 0) {
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error checking regular memberships:', error);
      return false;
    }
  };

  // Update last login timestamp
  const updateLastLogin = async (userId: string) => {
    try {
      await supabase
        .from('profiles')
        .update({ last_login_at: new Date().toISOString() })
        .eq('user_id', userId);
    } catch (error) {
      console.error('Error updating last login:', error);
    }
  };

  // Handle PKCE auth callback (email confirmation, password reset, magic link)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          console.error('Error exchanging code for session:', error);
        }
        // Clean up URL
        const url = new URL(window.location.href);
        url.searchParams.delete('code');
        window.history.replaceState({}, '', url.pathname + url.hash);
      });
    }
  }, []);

  // Listen to auth state changes
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchProfile(session.user.id).then(async (profileData) => {
          setProfile(profileData);
          setRole(profileData?.role ?? null);
          updateLastLogin(session.user.id);

          // Fetch team memberships and check regular memberships
          if (profileData?.id) {
            const [teamMembershipsData, hasRegular] = await Promise.all([
              fetchTeamMemberships(profileData.id),
              checkHasRegularMemberships(profileData.id),
            ]);
            setTeamMemberships(teamMembershipsData);
            setHasRegularMembershipsState(hasRegular);
          }

          setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      // Skip re-fetching profile on token refresh to prevent video interruption
      if (_event === 'TOKEN_REFRESHED') return;

      if (session?.user) {
        fetchProfile(session.user.id).then(async (profileData) => {
          setProfile(profileData);
          setRole(profileData?.role ?? null);
          if (_event === 'SIGNED_IN') {
            updateLastLogin(session.user.id);
          }

          // Fetch team memberships and check regular memberships
          if (profileData?.id) {
            const [teamMembershipsData, hasRegular] = await Promise.all([
              fetchTeamMemberships(profileData.id),
              checkHasRegularMemberships(profileData.id),
            ]);
            setTeamMemberships(teamMembershipsData);
            setHasRegularMembershipsState(hasRegular);
          }
        });
      } else {
        setProfile(null);
        setRole(null);
        setTeamMemberships(null);
        setHasRegularMembershipsState(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error };
    } catch (error) {
      return { error: error as AuthError };
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string, role: UserRole, marketingOptIn: boolean = false, phone?: string) => {
    try {
      // Determine the redirect URL based on environment
      const redirectUrl = import.meta.env.PROD
        ? window.location.origin
        : 'http://localhost:5173';

      // First, create the auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: role,
            marketing_opt_in: marketingOptIn,
            phone: phone || '',
          },
          emailRedirectTo: redirectUrl,
        },
      });

      if (authError) {
        return { error: authError };
      }

      // Save phone number to profile after signup
      if (phone && authData?.user?.id) {
        // Wait a moment for trigger to create profile, then update phone
        setTimeout(async () => {
          await supabase
            .from('profiles')
            .update({ phone })
            .eq('user_id', authData.user!.id);
        }, 1000);
      }

      // Profile is created automatically by the database trigger (handle_new_user)
      // The trigger reads full_name and role from auth.users.raw_user_meta_data
      // No manual insert needed - that would cause duplicate key violation

      return { error: null };
    } catch (error) {
      return { error: error as AuthError };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      setRole(null);
      setSession(null);
      setTeamMemberships(null);
      setHasRegularMembershipsState(true);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    try {
      const redirectUrl = import.meta.env.PROD
        ? `${window.location.origin}/reset-password`
        : 'http://localhost:5173/reset-password';

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });
      return { error };
    } catch (error) {
      return { error: error as AuthError };
    }
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      return { error };
    } catch (error) {
      return { error: error as AuthError };
    }
  }, []);

  // Compute derived team membership values
  const isTeamMemberOnly = (teamMemberships !== null && teamMemberships.length > 0) && !hasRegularMembershipsState;
  const primaryTeamCommunity = isTeamMemberOnly && teamMemberships && teamMemberships.length === 1
    ? teamMemberships[0].communityId
    : null;

  // Memoize state to prevent unnecessary re-renders
  const stateValue = useMemo<AuthStateContextType>(() => ({
    user,
    profile,
    role,
    session,
    isLoading,
    teamMemberships,
    isTeamMemberOnly,
    primaryTeamCommunity,
  }), [user, profile, role, session, isLoading, teamMemberships, isTeamMemberOnly, primaryTeamCommunity]);

  // Actions are stable (useCallback) so this object reference is stable
  const actionsValue = useMemo<AuthActionsContextType>(() => ({
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
  }), [signIn, signUp, signOut, resetPassword, updatePassword]);

  return (
    <AuthStateContext.Provider value={stateValue}>
      <AuthActionsContext.Provider value={actionsValue}>
        {children}
      </AuthActionsContext.Provider>
    </AuthStateContext.Provider>
  );
};
