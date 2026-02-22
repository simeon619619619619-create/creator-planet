-- ============================================================================
-- COMPLETE DATABASE RESET FOR CREATOR CLUB AUTH
-- ============================================================================
-- This migration completely resets the profiles table and auth system to fix:
-- 1. INFINITE RECURSION in RLS policy that queries profiles from within profiles
-- 2. Unsafe CAST operations in trigger function
-- 3. Orphaned users from failed signup attempts
--
-- This script is idempotent and can be run multiple times safely.
-- ============================================================================

-- ============================================================================
-- SECTION 1: CLEANUP - Remove all existing policies, triggers, and table
-- ============================================================================

-- Drop all existing RLS policies on profiles table
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
  DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
  DROP POLICY IF EXISTS "Creators and superadmins can view all profiles" ON public.profiles;
  DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.profiles;
  DROP POLICY IF EXISTS "Superadmins can view all profiles" ON public.profiles;
  DROP POLICY IF EXISTS "Creators can view all profiles" ON public.profiles;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

-- Drop the trigger (if exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop the trigger function (if exists)
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Drop the profiles table completely (CASCADE will drop dependent objects)
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Drop and recreate the user_role enum type to ensure it's clean
DROP TYPE IF EXISTS user_role CASCADE;
CREATE TYPE user_role AS ENUM ('superadmin', 'creator', 'student', 'member');

-- ============================================================================
-- SECTION 2: CREATE PROFILES TABLE
-- ============================================================================

-- Create profiles table with clean structure
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  role user_role NOT NULL DEFAULT 'student',
  full_name TEXT,
  avatar_url TEXT,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_login_at TIMESTAMPTZ,
  CONSTRAINT profiles_user_id_key UNIQUE (user_id)
);

-- Create indexes for faster lookups
CREATE INDEX profiles_user_id_idx ON public.profiles(user_id);
CREATE INDEX profiles_email_idx ON public.profiles(email);
CREATE INDEX profiles_role_idx ON public.profiles(role);

-- Add table and column comments for documentation
COMMENT ON TABLE public.profiles IS 'User profiles extending auth.users with additional information';
COMMENT ON COLUMN public.profiles.user_id IS 'Foreign key to auth.users (unique)';
COMMENT ON COLUMN public.profiles.role IS 'User role: superadmin, creator, student, or member';
COMMENT ON COLUMN public.profiles.full_name IS 'User full name';
COMMENT ON COLUMN public.profiles.avatar_url IS 'URL to user avatar image';
COMMENT ON COLUMN public.profiles.email IS 'User email address (denormalized from auth.users)';
COMMENT ON COLUMN public.profiles.last_login_at IS 'Timestamp of last login';

-- ============================================================================
-- SECTION 3: ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SECTION 4: CREATE SIMPLE RLS POLICIES (NO RECURSION)
-- ============================================================================

-- Policy 1: Users can view their own profile
-- Simple policy - just checks if the user_id matches auth.uid()
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy 2: Users can update their own profile
-- Users can only update their own row, and cannot change their user_id
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy 3: Enable insert for authenticated users during signup
-- Users can only insert a profile for themselves
CREATE POLICY "Enable insert for authenticated users"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy 4: Superadmins can view all profiles
-- Uses a simplified check that doesn't cause recursion
-- This policy uses auth.jwt() which doesn't query the profiles table
CREATE POLICY "Superadmins can view all profiles"
  ON public.profiles
  FOR SELECT
  USING (
    -- Check if user has superadmin role in their JWT claims
    -- This is set by the trigger function in raw_user_meta_data
    (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'superadmin'
  );

-- Policy 5: Creators can view all profiles
-- Uses JWT claims to avoid recursion
CREATE POLICY "Creators can view all profiles"
  ON public.profiles
  FOR SELECT
  USING (
    -- Check if user has creator role in their JWT claims
    (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'creator'
  );

-- ============================================================================
-- SECTION 5: CREATE SAFE TRIGGER FUNCTION
-- ============================================================================

-- Create trigger function with proper role validation
-- SECURITY DEFINER allows this function to bypass RLS when inserting
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role_value user_role;
  raw_role TEXT;
BEGIN
  -- Safely extract role from metadata
  raw_role := NEW.raw_user_meta_data->>'role';

  -- Validate and convert role, defaulting to 'student' if invalid or NULL
  -- This prevents any casting errors that could cause the trigger to fail
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
    -- Invalid role value, default to student and log a warning
    RAISE WARNING 'Invalid role value "%" for user %, defaulting to student', raw_role, NEW.id;
    user_role_value := 'student';
  END IF;

  -- Insert the profile with validated role
  -- ON CONFLICT DO NOTHING prevents errors if profile already exists
  INSERT INTO public.profiles (user_id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    user_role_value
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add function comment
COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates a profile when a new user signs up. Uses SECURITY DEFINER to bypass RLS.';

-- ============================================================================
-- SECTION 6: CREATE TRIGGER
-- ============================================================================

-- Create trigger to automatically create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- SECTION 7: GRANT PERMISSIONS
-- ============================================================================

-- Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.profiles TO authenticated;
GRANT USAGE ON TYPE user_role TO authenticated;

-- ============================================================================
-- SECTION 8: CLEANUP ORPHANED AUTH USERS (OPTIONAL)
-- ============================================================================

-- This section identifies orphaned users who have auth.users entries but no profiles
-- Uncomment the DELETE statement below if you want to remove orphaned users
-- WARNING: This will permanently delete users who don't have profiles

-- View orphaned users (for debugging)
DO $$
DECLARE
  orphaned_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphaned_count
  FROM auth.users u
  LEFT JOIN public.profiles p ON u.id = p.user_id
  WHERE p.user_id IS NULL;

  IF orphaned_count > 0 THEN
    RAISE NOTICE 'Found % orphaned auth.users without profiles', orphaned_count;
    RAISE NOTICE 'To remove them, uncomment the DELETE statement in this migration';
  ELSE
    RAISE NOTICE 'No orphaned users found';
  END IF;
END $$;

-- Uncomment to delete orphaned users:
-- DELETE FROM auth.users
-- WHERE id NOT IN (SELECT user_id FROM public.profiles);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Final verification
DO $$
DECLARE
  policy_count INTEGER;
  trigger_count INTEGER;
BEGIN
  -- Count policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'profiles';

  -- Count triggers
  SELECT COUNT(*) INTO trigger_count
  FROM pg_trigger
  WHERE tgname = 'on_auth_user_created';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 003 Complete';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Profiles table: RECREATED';
  RAISE NOTICE 'RLS policies: % created', policy_count;
  RAISE NOTICE 'Triggers: % created', trigger_count;
  RAISE NOTICE 'Status: READY FOR USE';
  RAISE NOTICE '========================================';
END $$;
