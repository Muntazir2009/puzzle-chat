-- ================================================================== *
-- Migration: Fix "Database error saving new user"
-- 
-- Problem: The handle_new_user() trigger on auth.users was blocking
-- new signups. Also, get_or_create_conversation was incorrectly
-- declared as STABLE when it performs INSERTs (must be VOLATILE).
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

-- 4. Fix get_or_create_conversation: remove STABLE (function does INSERT)
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(
  other_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conv_id   UUID;
  v_user_a    UUID;
  v_user_b    UUID;
BEGIN
  IF auth.uid() < other_user_id THEN
    v_user_a := auth.uid();
    v_user_b := other_user_id;
  ELSE
    v_user_a := other_user_id;
    v_user_b := auth.uid();
  END IF;

  SELECT id INTO v_conv_id
    FROM public.conversations
    WHERE user_a = v_user_a AND user_b = v_user_b;

  IF v_conv_id IS NOT NULL THEN
    RETURN v_conv_id;
  END IF;

  INSERT INTO public.conversations (user_a, user_b)
    VALUES (v_user_a, v_user_b)
    RETURNING id INTO v_conv_id;

  RETURN v_conv_id;
END;
$$;

-- 5. Verify: check the policies and function
SELECT policyname, tablename, cmd 
FROM pg_policies 
WHERE tablename = 'users';

SELECT proname, provolatile 
FROM pg_proc 
WHERE proname = 'get_or_create_conversation';
