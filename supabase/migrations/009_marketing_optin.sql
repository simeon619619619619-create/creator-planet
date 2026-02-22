-- ============================================================================
-- Add marketing opt-in column to profiles table
-- ============================================================================

-- Add marketing_opt_in column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS marketing_opt_in BOOLEAN DEFAULT false;

-- Add column comment
COMMENT ON COLUMN public.profiles.marketing_opt_in IS 'Whether user opted in to receive marketing emails';

-- Update the trigger function to include marketing_opt_in
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role_value user_role;
  raw_role TEXT;
  marketing_value BOOLEAN;
BEGIN
  -- Safely extract role from metadata
  raw_role := NEW.raw_user_meta_data->>'role';

  -- Extract marketing opt-in preference (default to false)
  marketing_value := COALESCE((NEW.raw_user_meta_data->>'marketing_opt_in')::BOOLEAN, false);

  -- Validate and convert role, defaulting to 'student' if invalid or NULL
  IF raw_role IS NULL OR raw_role = '' THEN
    user_role_value := 'student';
  ELSIF raw_role = 'superadmin' THEN
    user_role_value := 'superadmin';
  ELSIF raw_role = 'creator' THEN
    user_role_value := 'creator';
  ELSIF raw_role = 'student' THEN
    user_role_value := 'student';
  ELSIF raw_role = 'member' THEN
    user_role_value := 'member';
  ELSE
    RAISE WARNING 'Invalid role value "%" for user %, defaulting to student', raw_role, NEW.id;
    user_role_value := 'student';
  END IF;

  -- Insert the profile with validated role and marketing preference
  INSERT INTO public.profiles (user_id, email, full_name, role, marketing_opt_in)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    user_role_value,
    marketing_value
  )
  ON CONFLICT (user_id) DO UPDATE SET
    marketing_opt_in = EXCLUDED.marketing_opt_in;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Verification
DO $$
BEGIN
  RAISE NOTICE 'Migration 009: marketing_opt_in column added to profiles';
END $$;
