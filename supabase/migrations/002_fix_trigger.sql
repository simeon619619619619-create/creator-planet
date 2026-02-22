-- Fix the handle_new_user trigger to safely handle role casting
-- The previous version had an unsafe CAST that happened before COALESCE

-- Drop and recreate the trigger function with safe role handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_role_value user_role;
  raw_role TEXT;
BEGIN
  -- Safely extract role from metadata
  raw_role := NEW.raw_user_meta_data->>'role';

  -- Validate and convert role, defaulting to 'student' if invalid or NULL
  IF raw_role IS NULL OR raw_role = '' THEN
    user_role_value := 'student';
  ELSIF raw_role IN ('superadmin', 'creator', 'student', 'member') THEN
    user_role_value := raw_role::user_role;
  ELSE
    -- Invalid role value, default to student
    user_role_value := 'student';
  END IF;

  -- Insert the profile with validated role
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- The trigger already exists, no need to recreate it
-- It will automatically use the updated function
