-- ============================================================
-- Cloud-persist Aiya's INFERRED profile (its "what I know about you" summary).
--
-- Chat transcripts already sync via aiya_chats, but the inferred profile lived
-- ONLY in localStorage, so on a new device / reinstall / cleared storage Aiya
-- kept the chats yet forgot everything it had learned about the user until it
-- slowly rebuilt from scratch. This table gives the profile the same
-- cross-device durability as the chats.
--
-- One row per user (PK = user_id). RLS keyed on auth.uid() = user_id, FK to
-- public.users(id) ON DELETE CASCADE so it's wiped on account deletion.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.aiya_profiles (
  user_id       uuid        NOT NULL PRIMARY KEY,
  summary       text        NOT NULL DEFAULT '',
  message_count integer     NOT NULL DEFAULT 0,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT aiya_profiles_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

ALTER TABLE public.aiya_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own aiya profile"
  ON public.aiya_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own aiya profile"
  ON public.aiya_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own aiya profile"
  ON public.aiya_profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own aiya profile"
  ON public.aiya_profiles FOR DELETE
  USING (auth.uid() = user_id);
