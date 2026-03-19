import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import {
  getCreatorCommunities,
  getMemberCommunities,
} from '../../features/community/communityService';
import { supabase } from '../supabase/client';
import { DbCommunity } from '../supabase/database.types';

interface CommunityContextType {
  communities: DbCommunity[];
  selectedCommunity: DbCommunity | null;
  setSelectedCommunity: (community: DbCommunity | null) => void;
  isLoading: boolean;
  refreshCommunities: () => Promise<void>;
  isTeamMemberOnly: boolean;  // Pass through from AuthContext
  teamCommunityId: string | null;  // The community ID for team-only users
}

const STORAGE_KEY = 'founders-club-selected-community';

const CommunityContext = createContext<CommunityContextType | undefined>(undefined);

export const CommunityProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, role, teamMemberships, isTeamMemberOnly, primaryTeamCommunity } = useAuth();
  const [communities, setCommunities] = useState<DbCommunity[]>([]);
  const [selectedCommunity, setSelectedCommunityState] = useState<DbCommunity | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch a single community by ID (for team communities)
  const getTeamCommunity = async (communityId: string): Promise<DbCommunity | null> => {
    const { data, error } = await supabase
      .from('communities')
      .select('*')
      .eq('id', communityId)
      .single();

    if (error) return null;
    return data as DbCommunity;
  };

  // Wrapper to persist selected community to localStorage
  const setSelectedCommunity = (community: DbCommunity | null) => {
    // Team-only users can't switch communities
    if (isTeamMemberOnly && primaryTeamCommunity) {
      // Only allow setting to their team community
      if (community && community.id !== primaryTeamCommunity) {
        console.warn('Team-only users cannot switch communities');
        return;
      }
    }

    setSelectedCommunityState(community);
    if (community) {
      localStorage.setItem(STORAGE_KEY, community.id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const loadCommunities = async () => {
    if (!user) {
      setCommunities([]);
      setSelectedCommunityState(null);
      localStorage.removeItem(STORAGE_KEY);
      setIsLoading(false);
      return;
    }

    // Wait for role to be determined before loading communities
    // This prevents showing all public communities to creators during auth loading
    if (!role) {
      setIsLoading(true);
      return;
    }

    setIsLoading(true);
    try {
      let communityList: DbCommunity[] = [];

      // Team-only users: only show their team community
      if (isTeamMemberOnly && primaryTeamCommunity) {
        const teamCommunity = await getTeamCommunity(primaryTeamCommunity);
        if (teamCommunity) {
          communityList = [teamCommunity];
        }
      } else if (role === 'creator' || role === 'superadmin') {
        // Creators see ONLY their own communities
        communityList = await getCreatorCommunities(user.id);
      } else if (role === 'student' || role === 'member') {
        // Students/members see ONLY communities they've actually joined
        // They can browse/discover other communities via the "Browse Communities" feature
        communityList = await getMemberCommunities(user.id);

        // Also include any team communities they're part of (for mixed users)
        if (teamMemberships && teamMemberships.length > 0) {
          for (const tm of teamMemberships) {
            // Don't add duplicates
            if (!communityList.some(c => c.id === tm.communityId)) {
              const teamCommunity = await getTeamCommunity(tm.communityId);
              if (teamCommunity) {
                communityList.push(teamCommunity);
              }
            }
          }
        }
      }

      setCommunities(communityList);

      // Restore from localStorage or auto-select first community
      if (communityList.length > 0) {
        // For team-only users, always force-select their team community
        if (isTeamMemberOnly && primaryTeamCommunity) {
          const teamCommunity = communityList.find(c => c.id === primaryTeamCommunity);
          if (teamCommunity) {
            setSelectedCommunityState(teamCommunity);
            localStorage.setItem(STORAGE_KEY, teamCommunity.id);
          }
        } else {
          // Normal selection logic for non-team-only users
          const storedId = localStorage.getItem(STORAGE_KEY);
          const storedCommunity = storedId ? communityList.find(c => c.id === storedId) : null;
          const currentStillExists = selectedCommunity && communityList.some(c => c.id === selectedCommunity.id);

          if (storedCommunity && !selectedCommunity) {
            // Restore from localStorage on initial load
            setSelectedCommunityState(storedCommunity);
          } else if (!currentStillExists) {
            // Fall back to first community if current selection is invalid
            setSelectedCommunity(communityList[0]);
          }
        }
      } else {
        setSelectedCommunityState(null);
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (error) {
      console.error('Error loading communities:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCommunities();
  }, [user, role, isTeamMemberOnly, primaryTeamCommunity, teamMemberships]);

  const refreshCommunities = async () => {
    await loadCommunities();
  };

  return (
    <CommunityContext.Provider
      value={{
        communities,
        selectedCommunity,
        setSelectedCommunity,
        isLoading,
        refreshCommunities,
        isTeamMemberOnly: isTeamMemberOnly ?? false,
        teamCommunityId: primaryTeamCommunity ?? null,
      }}
    >
      {children}
    </CommunityContext.Provider>
  );
};

export const useCommunity = (): CommunityContextType => {
  const context = useContext(CommunityContext);
  if (context === undefined) {
    throw new Error('useCommunity must be used within a CommunityProvider');
  }
  return context;
};
