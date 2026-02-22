import { supabase } from '../../core/supabase/client';
import { DbPoints, DbPointTransaction } from '../../core/supabase/database.types';

// ============================================================================
// POINTS - Gamification System
// ============================================================================

/**
 * Gets a user's points and level for a specific community
 * @param userId - The auth user's ID (not profile ID)
 * @param communityId - The community's ID
 * @returns User's points record or null if not found
 */
export async function getUserPoints(
  userId: string,
  communityId: string
): Promise<DbPoints | null> {
  // First, get the profile ID for this user (FK references profiles.id, not user_id)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (profileError || !profile) {
    return null;
  }

  const { data, error } = await supabase
    .from('points')
    .select('*')
    .eq('user_id', profile.id)
    .eq('community_id', communityId)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    console.error('Error fetching user points:', error);
  }

  return data || null;
}

/**
 * Gets the leaderboard for a community (top members by points)
 * @param communityId - The community's ID
 * @param limit - Number of top members to return (default: 10)
 * @returns Array of points records with user profile information
 */
export async function getCommunityLeaderboard(
  communityId: string,
  limit: number = 10
): Promise<(DbPoints & { user: { full_name: string; avatar_url: string | null; role: string } })[]> {
  const { data, error } = await supabase
    .from('points')
    .select(`
      *,
      user:profiles!user_id(full_name, avatar_url, role)
    `)
    .eq('community_id', communityId)
    .order('total_points', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching community leaderboard:', error);
    return [];
  }

  // Filter out entries where the user profile is null (orphaned records)
  const validEntries = (data || []).filter(entry => entry.user !== null);

  return validEntries;
}

/**
 * Awards points to a user for an action
 * Creates a transaction record and updates the user's total points and level
 * @param profileId - The user's profile ID (profiles.id)
 * @param communityId - The community's ID
 * @param points - Number of points to award
 * @param reason - Reason for awarding points
 * @returns The created transaction record or null if failed
 */
export async function awardPoints(
  profileId: string,
  communityId: string,
  points: number,
  reason: string
): Promise<DbPointTransaction | null> {
  // First, create the transaction
  const { data: transaction, error: transactionError } = await supabase
    .from('point_transactions')
    .insert({
      user_id: profileId,
      community_id: communityId,
      points,
      reason,
    })
    .select()
    .single();

  if (transactionError) {
    console.error('Error creating point transaction:', transactionError);
    return null;
  }

  // Then, update or create the user's points record
  // Note: getUserPointsByProfileId uses profileId directly
  const existingPoints = await getUserPointsByProfileId(profileId, communityId);

  if (existingPoints) {
    // Update existing record
    const newTotalPoints = existingPoints.total_points + points;
    const newLevel = calculateLevel(newTotalPoints);

    const { error: updateError } = await supabase
      .from('points')
      .update({
        total_points: newTotalPoints,
        level: newLevel,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingPoints.id);

    if (updateError) {
      console.error('Error updating points:', updateError);
    }
  } else {
    // Create new record
    const newLevel = calculateLevel(points);

    const { error: insertError } = await supabase
      .from('points')
      .insert({
        user_id: profileId,
        community_id: communityId,
        total_points: points,
        level: newLevel,
      });

    if (insertError) {
      console.error('Error creating points record:', insertError);
    }
  }

  return transaction;
}

/**
 * Internal function to get points by profile ID directly
 */
async function getUserPointsByProfileId(
  profileId: string,
  communityId: string
): Promise<DbPoints | null> {
  const { data, error } = await supabase
    .from('points')
    .select('*')
    .eq('user_id', profileId)
    .eq('community_id', communityId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching user points by profile ID:', error);
  }

  return data || null;
}

/**
 * Calculates the user's level based on total points
 * Formula: Level = floor(sqrt(total_points / 100)) + 1
 * This means:
 * - Level 1: 0-99 points
 * - Level 2: 100-399 points
 * - Level 3: 400-899 points
 * - Level 4: 900-1599 points
 * - etc.
 * @param totalPoints - The user's total points
 * @returns The calculated level
 */
function calculateLevel(totalPoints: number): number {
  return Math.floor(Math.sqrt(totalPoints / 100)) + 1;
}

/**
 * Gets the point transactions history for a user in a community
 * @param userId - The auth user's ID (not profile ID)
 * @param communityId - The community's ID
 * @param limit - Number of transactions to return (default: 50)
 * @returns Array of point transaction records
 */
export async function getPointTransactions(
  userId: string,
  communityId: string,
  limit: number = 50
): Promise<DbPointTransaction[]> {
  // First, get the profile ID for this user (FK references profiles.id, not user_id)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (profileError || !profile) {
    return [];
  }

  const { data, error } = await supabase
    .from('point_transactions')
    .select('*')
    .eq('user_id', profile.id)
    .eq('community_id', communityId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching point transactions:', error);
    return [];
  }

  return data || [];
}

/**
 * Gets the points needed to reach the next level
 * @param currentLevel - The user's current level
 * @returns Number of points needed for the next level
 */
export function getPointsForNextLevel(currentLevel: number): number {
  // Reverse the level formula: points = (level - 1)^2 * 100
  return Math.pow(currentLevel, 2) * 100;
}

/**
 * Gets the progress percentage towards the next level
 * @param totalPoints - The user's total points
 * @param currentLevel - The user's current level
 * @returns Progress percentage (0-100)
 */
export function getLevelProgress(totalPoints: number, currentLevel: number): number {
  const currentLevelPoints = Math.pow(currentLevel - 1, 2) * 100;
  const nextLevelPoints = Math.pow(currentLevel, 2) * 100;
  const pointsInCurrentLevel = totalPoints - currentLevelPoints;
  const pointsNeededForLevel = nextLevelPoints - currentLevelPoints;

  return Math.min(100, Math.max(0, (pointsInCurrentLevel / pointsNeededForLevel) * 100));
}
