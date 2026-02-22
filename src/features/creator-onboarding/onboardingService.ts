import { supabase } from '../../core/supabase/client';

interface OnboardingData {
  sessionId: string;
  startedAt: string;
  completedAt: string | null;
  niche: string | null;
  nicheOther: string | null;
  stage: string | null;
  audienceSize: string | null;
  painPoint: string | null;
  painPointOther: string | null;
  goal: string | null;
  currentTools: string[];
  revenueGoal: string | null;
}

/**
 * Sync onboarding data to the database after signup.
 * This function should be called after a successful signup with the session data.
 */
export const syncOnboardingData = async (data: OnboardingData): Promise<void> => {
  try {
    // Get the current user's profile
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn('No authenticated user found when syncing onboarding data');
      return;
    }

    // Get the profile ID for the user
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      console.warn('Could not find profile for user:', profileError);
      return;
    }

    // Check if onboarding data already exists for this session
    const { data: existing } = await supabase
      .from('creator_onboarding')
      .select('id')
      .eq('session_id', data.sessionId)
      .single();

    if (existing) {
      // Update existing record with profile_id
      const { error: updateError } = await supabase
        .from('creator_onboarding')
        .update({ profile_id: profile.id })
        .eq('session_id', data.sessionId);

      if (updateError) {
        console.error('Error updating onboarding record:', updateError);
      }
      return;
    }

    // Insert new onboarding record
    const { error: insertError } = await supabase
      .from('creator_onboarding')
      .insert({
        profile_id: profile.id,
        session_id: data.sessionId,
        niche: data.niche,
        niche_other: data.nicheOther,
        stage: data.stage,
        audience_size: data.audienceSize,
        pain_point: data.painPoint,
        pain_point_other: data.painPointOther,
        goal: data.goal,
        current_tools: data.currentTools,
        revenue_goal: data.revenueGoal,
        started_at: data.startedAt,
        completed_at: data.completedAt,
      });

    if (insertError) {
      console.error('Error inserting onboarding record:', insertError);
      throw insertError;
    }
  } catch (error) {
    console.error('Error syncing onboarding data:', error);
    throw error;
  }
};

/**
 * Get onboarding data for a creator.
 * Useful for personalizing the dashboard experience.
 */
export const getCreatorOnboarding = async (profileId: string) => {
  const { data, error } = await supabase
    .from('creator_onboarding')
    .select('*')
    .eq('profile_id', profileId)
    .single();

  if (error) {
    console.error('Error fetching onboarding data:', error);
    return null;
  }

  return data;
};

/**
 * Check if a creator has completed onboarding.
 */
export const hasCompletedOnboarding = async (profileId: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('creator_onboarding')
    .select('id')
    .eq('profile_id', profileId)
    .single();

  if (error || !data) {
    return false;
  }

  return true;
};
