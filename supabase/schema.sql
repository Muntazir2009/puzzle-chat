/* ================================================================== *
   Puzzle – Full Schema
   1-on-1 Direct Messaging on Supabase (PostgreSQL)
   *
   Run this script in the Supabase SQL Editor (Dashboard → SQL Editor)
   or via `supabase db push` if using the local CLI.
   ================================================================== */

-- ────────────────────────────────────────────────────────────────────
-- 1. ENUMS
-- ────────────────────────────────────────────────────────────────────

CREATE TYPE message_type  AS ENUM ('text', 'image', 'file', 'voice');
CREATE TYPE message_status AS ENUM ('sending', 'sent', 'delivered', 'read', 'failed');

-- ────────────────────────────────────────────────────────────────────
-- 2. TABLES
-- ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.users (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  avatar_url TEXT,
  name       TEXT        NOT NULL,
  last_seen  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversations (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_b     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT conversations_user_pair UNIQUE (user_a, user_b)
);

ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_no_self_chat
  CHECK (user_a <> user_b);

CREATE TABLE IF NOT EXISTS public.messages (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   UUID          NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id         UUID          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reply_to_id       UUID          REFERENCES public.messages(id) ON DELETE SET NULL,
  content           TEXT          NOT NULL DEFAULT '',
  type              message_type  NOT NULL DEFAULT 'text',
  status            message_status NOT NULL DEFAULT 'sent',
  vanish_mode       BOOLEAN       NOT NULL DEFAULT FALSE,
  ephemeral_seconds INTEGER       DEFAULT NULL,
  voice_duration    INTEGER       DEFAULT NULL,
  waveform_data     JSONB         DEFAULT NULL,
  reactions         JSONB         DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────────
-- 3. INDEXES
-- ────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_conversations_user_a     ON public.conversations(user_a);
CREATE INDEX IF NOT EXISTS idx_conversations_user_b     ON public.conversations(user_b);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at  ON public.conversations(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id      ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at     ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_reply_to_id     ON public.messages(reply_to_id) WHERE reply_to_id IS NOT NULL;

-- ────────────────────────────────────────────────────────────────────
-- 4. AUTO-UPDATE `conversations.updated_at` ON NEW MESSAGES
-- ────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversations
    SET updated_at = now()
    WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_conversation_timestamp ON public.messages;
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

CREATE POLICY "users_select_all" ON public.users
  FOR SELECT USING (true);

CREATE POLICY "users_update_self" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "conversations_select" ON public.conversations
  FOR SELECT USING (auth.uid() = user_a OR auth.uid() = user_b);

CREATE POLICY "conversations_insert" ON public.conversations
  FOR INSERT WITH CHECK (auth.uid() = user_a OR auth.uid() = user_b);

CREATE POLICY "conversations_update" ON public.conversations
  FOR UPDATE
  USING (auth.uid() = user_a OR auth.uid() = user_b)
  WITH CHECK (auth.uid() = user_a OR auth.uid() = user_b);

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
-- 6. HELPER: conversation between two users (upsert-safe)
-- ────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_or_create_conversation(
  other_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER STABLE
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
  7. AUTO-CREATE public.users ROW ON AUTH SIGNUP
-- ────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NULL
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();