/* ================================================================== *
   Puzzle – Complete Database Schema (All-in-One)
   1-on-1 Direct Messaging on Supabase (PostgreSQL)
   *
   ⚠️  THIS IS THE ONLY SCRIPT YOU NEED TO RUN.
   ⚠️  Run this in Supabase SQL Editor (Dashboard → SQL Editor)
   ⚠️  It creates ALL tables, indexes, triggers, functions, and RLS policies.
   *
   Changelog vs v2:
   - Cleanup uses DROP TABLE CASCADE first (avoids 42P01 on non-existent tables)
   - handle_new_user() has EXCEPTION handler & SET search_path
   - get_or_create_conversation() is VOLATILE (no STABLE)
   ================================================================== */

-- ────────────────────────────────────────────────────────────────────
-- 0. CLEAN SLATE
--    Tables are dropped FIRST with CASCADE – this automatically removes
--    all dependent triggers, policies, and indexes.
--    Then functions and types are dropped separately.
-- ────────────────────────────────────────────────────────────────────

-- 0a. Drop auth trigger separately (auth.users always exists)
DO $$ BEGIN
  DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- 0b. Drop functions that may have been created independently
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.get_or_create_conversation(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.update_conversation_timestamp() CASCADE;

-- 0c. Drop tables (CASCADE auto-removes their triggers, policies, indexes)
DROP TABLE IF EXISTS public.messages    CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;
DROP TABLE IF EXISTS public.users        CASCADE;

-- 0d. Drop enum types (after tables so column dependencies are gone)
DROP TYPE IF EXISTS message_status CASCADE;
DROP TYPE IF EXISTS message_type   CASCADE;

-- ────────────────────────────────────────────────────────────────────
-- 1. ENUMS
-- ────────────────────────────────────────────────────────────────────

CREATE TYPE message_type  AS ENUM ('text', 'image', 'file', 'voice');
CREATE TYPE message_status AS ENUM ('sending', 'sent', 'delivered', 'read', 'failed');

-- ────────────────────────────────────────────────────────────────────
-- 2. TABLES
-- ────────────────────────────────────────────────────────────────────

CREATE TABLE public.users (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  avatar_url TEXT,
  name       TEXT        NOT NULL,
  last_seen  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.conversations (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_b     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT conversations_user_pair UNIQUE (user_a, user_b),
  CONSTRAINT conversations_no_self_chat CHECK (user_a <> user_b)
);

CREATE TABLE public.messages (
  id                UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   UUID           NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id         UUID           NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reply_to_id       UUID           REFERENCES public.messages(id) ON DELETE SET NULL,
  content           TEXT           NOT NULL DEFAULT '',
  type              message_type   NOT NULL DEFAULT 'text',
  status            message_status NOT NULL DEFAULT 'sent',
  vanish_mode       BOOLEAN        NOT NULL DEFAULT FALSE,
  ephemeral_seconds INTEGER        DEFAULT NULL,
  voice_duration    INTEGER        DEFAULT NULL,
  waveform_data     JSONB          DEFAULT NULL,
  reactions         JSONB          DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ    NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────────
-- 3. INDEXES
-- ────────────────────────────────────────────────────────────────────

CREATE INDEX idx_conversations_user_a     ON public.conversations(user_a);
CREATE INDEX idx_conversations_user_b     ON public.conversations(user_b);
CREATE INDEX idx_conversations_updated_at  ON public.conversations(updated_at DESC);

CREATE INDEX idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX idx_messages_sender_id      ON public.messages(sender_id);
CREATE INDEX idx_messages_created_at     ON public.messages(created_at DESC);
CREATE INDEX idx_messages_reply_to_id     ON public.messages(reply_to_id) WHERE reply_to_id IS NOT NULL;

-- ────────────────────────────────────────────────────────────────────
-- 4. TRIGGER: auto-update conversations.updated_at on new message
-- ────────────────────────────────────────────────────────────────────

CREATE FUNCTION public.update_conversation_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.conversations
    SET updated_at = now()
    WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_conversation_timestamp
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_timestamp();

-- ────────────────────────────────────────────────────────────────────
-- 5. ROW LEVEL SECURITY (RLS)
-- ────────────────────────────────────────────────────────────────────

ALTER TABLE public.users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages     ENABLE ROW LEVEL SECURITY;

-- Users: anyone can read profiles, can only insert/update own
CREATE POLICY "users_select_all" ON public.users
  FOR SELECT USING (true);

CREATE POLICY "users_insert_self" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "users_update_self" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Conversations: only participants can see/insert/update
CREATE POLICY "conversations_select" ON public.conversations
  FOR SELECT USING (auth.uid() = user_a OR auth.uid() = user_b);

CREATE POLICY "conversations_insert" ON public.conversations
  FOR INSERT WITH CHECK (auth.uid() = user_a OR auth.uid() = user_b);

CREATE POLICY "conversations_update" ON public.conversations
  FOR UPDATE
  USING (auth.uid() = user_a OR auth.uid() = user_b)
  WITH CHECK (auth.uid() = user_a OR auth.uid() = user_b);

-- Messages: only participants of the parent conversation
CREATE POLICY "messages_select" ON public.messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE conversations.id = messages.conversation_id
        AND (conversations.user_a = auth.uid()
           OR conversations.user_b = auth.uid())
    )
  );

CREATE POLICY "messages_insert" ON public.messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE conversations.id = messages.conversation_id
        AND (conversations.user_a = auth.uid()
           OR conversations.user_b = auth.uid())
    )
    AND sender_id = auth.uid()
  );

CREATE POLICY "messages_update" ON public.messages
  FOR UPDATE
  USING (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations
      WHERE conversations.id = messages.conversation_id
        AND (conversations.user_a = auth.uid()
           OR conversations.user_b = auth.uid())
    )
  );

CREATE POLICY "messages_delete" ON public.messages
  FOR DELETE
  USING (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations
      WHERE conversations.id = messages.conversation_id
        AND (conversations.user_a = auth.uid()
           OR conversations.user_b = auth.uid())
    )
  );

-- ────────────────────────────────────────────────────────────────────
-- 6. FUNCTION: get_or_create_conversation (VOLATILE – does INSERT)
-- ────────────────────────────────────────────────────────────────────

CREATE FUNCTION public.get_or_create_conversation(
  other_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
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

-- ────────────────────────────────────────────────────────────────────
-- 7. TRIGGER: auto-create public.users on auth.users INSERT
--    (with EXCEPTION handler so signup is never blocked)
-- ────────────────────────────────────────────────────────────────────

CREATE FUNCTION public.handle_new_user()
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

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ────────────────────────────────────────────────────────────────────
-- 8. VERIFICATION QUERIES (optional – confirms everything is set up)
-- ────────────────────────────────────────────────────────────────────

SELECT 'Tables' AS section, tablename FROM pg_tables WHERE schemaname = 'public';
SELECT 'Policies' AS section, policyname, tablename, cmd FROM pg_policies WHERE schemaname = 'public';
SELECT 'Functions' AS section, proname, provolatile FROM pg_proc WHERE pronamespace = 'public'::regnamespace;
SELECT 'Triggers' AS section, trigger_name, event_manipulation, event_object_table FROM information_schema.triggers WHERE trigger_schema = 'public' OR event_object_table = 'users' AND trigger_schema = 'auth';
