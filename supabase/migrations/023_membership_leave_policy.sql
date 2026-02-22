-- Migration: Add ability for users to leave communities
-- Allows members to delete their own memberships while preventing creators from leaving their own communities

-- Helper function to check if user can leave a community
CREATE OR REPLACE FUNCTION public.can_leave_community(p_profile_id UUID, p_community_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_community_creator_id UUID;
BEGIN
  -- Get the community's creator_id
  SELECT creator_id INTO v_community_creator_id
  FROM public.communities
  WHERE id = p_community_id;

  -- Cannot leave if you're the creator of this community
  IF v_community_creator_id = p_profile_id THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.can_leave_community(UUID, UUID) TO authenticated;

-- Add RLS policy for users to delete their own memberships
-- Note: memberships.user_id references profiles.id, NOT auth.users.id
DROP POLICY IF EXISTS "Users can leave communities" ON public.memberships;
CREATE POLICY "Users can leave communities"
  ON public.memberships FOR DELETE
  TO authenticated
  USING (
    -- User can only delete their own membership
    -- Must look up profile.id from auth.uid()
    user_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    -- And they cannot be the creator of the community
    AND public.can_leave_community(user_id, community_id)
  );

COMMENT ON POLICY "Users can leave communities" ON public.memberships IS
  'Allows members to leave communities. Creators cannot leave their own community.';
