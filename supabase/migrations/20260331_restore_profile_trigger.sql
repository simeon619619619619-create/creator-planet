-- ============================================================================
-- Restore missing on_auth_user_created trigger
-- ============================================================================
-- The trigger was accidentally dropped, causing new signups to not get a
-- profile row. This broke community joins (and anything else requiring a profile).

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Backfill: create profiles for any auth.users that are missing one
INSERT INTO public.profiles (user_id, email, full_name, role, marketing_opt_in)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', ''),
  COALESCE(
    CASE
      WHEN u.raw_user_meta_data->>'role' IN ('creator','student','member','superadmin')
      THEN (u.raw_user_meta_data->>'role')::user_role
      ELSE 'student'::user_role
    END,
    'student'::user_role
  ),
  COALESCE((u.raw_user_meta_data->>'marketing_opt_in')::boolean, false)
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.id IS NULL
ON CONFLICT (user_id) DO NOTHING;
