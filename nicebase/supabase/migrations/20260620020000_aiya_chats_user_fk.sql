-- ============================================================
-- Add the missing FK from aiya_chats.user_id -> users.id with
-- ON DELETE CASCADE.
--
-- aiya_chats stores full conversation transcripts (jsonb). Without an
-- FK, those rows orphan permanently when an account is deleted — a
-- data-retention / privacy gap given the account-deletion UI promises
-- "all data deleted" (see privacy-policy.html).
--
-- The pre-clean DELETE MUST run before the ALTER, otherwise adding the
-- constraint fails on any pre-existing orphan rows. user_id is NOT NULL,
-- so the NOT IN check is null-safe.
-- ============================================================

-- 1. Remove any orphaned conversations (no matching user row).
DELETE FROM public.aiya_chats
WHERE user_id NOT IN (SELECT id FROM public.users);

-- 2. Add the FK with cascade delete (idempotent).
ALTER TABLE public.aiya_chats
  DROP CONSTRAINT IF EXISTS aiya_chats_user_id_fkey;

ALTER TABLE public.aiya_chats
  ADD CONSTRAINT aiya_chats_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
