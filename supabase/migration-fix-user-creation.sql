-- ================================================================== *
-- Migration: Fix "Database error saving new user"
-- 
-- Problem: The users table had RLS enabled but no INSERT policy.
-- The handle_new_user() trigger was failing, blocking new signups.
-- 
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ================================================================== *

-- 1. Add INSERT policy so users can create their own profile
CREATE POLICY "users_insert_self" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 2. Recreate the trigger function with:
--    - SET search_path to avoid schema resolution issues
--    - EXCEPTION handler so trigger failure doesn't block signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.users (id, name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NULL
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- 3. Recreate the trigger (drop + create to ensure clean state)
DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 4. Verify: check the policies exist
SELECT policyname, tablename, cmd 
FROM pg_policies 
WHERE tablename = 'users';