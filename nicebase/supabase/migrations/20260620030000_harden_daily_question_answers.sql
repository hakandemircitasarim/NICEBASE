-- ============================================================
-- Harden public.daily_question_answers.
--
-- The original "Anyone can read public answers" policy
-- (USING is_public = true, no role scope) lets ANY anon-key caller read
-- answer_text + user_id of every row where is_public = true. The app
-- always inserts is_public = false and exposes no public-share toggle,
-- so this is a latent, ship-disabled misconfiguration rather than an
-- active leak — but it should not exist as written.
--
-- This migration:
--   1. Drops the unscoped public-read policy (answers become strictly
--      owner-readable via the existing owner SELECT policy).
--   2. Hardens INSERT so future code cannot accidentally create public
--      rows (WITH CHECK now also requires is_public = false).
--   3. Adds the missing owner UPDATE / DELETE policies so users can edit
--      and delete their own answers (RLS denies these by default today).
--
-- If public answer-sharing is built later, expose it via a curated,
-- anonymised VIEW + a SECURITY DEFINER mutation — NOT a raw
-- USING (is_public = true) policy on this table.
-- ============================================================

-- 1. Remove the unscoped public-read policy.
DROP POLICY IF EXISTS "Anyone can read public answers" ON public.daily_question_answers;

-- 2. Re-create the INSERT policy so clients can only insert their own,
--    non-public answers.
DROP POLICY IF EXISTS "Users can insert own answers" ON public.daily_question_answers;
CREATE POLICY "Users can insert own answers"
  ON public.daily_question_answers
  FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_public = false);

-- 3. Owner UPDATE / DELETE policies (previously absent -> denied).
DROP POLICY IF EXISTS "Users can update own answers" ON public.daily_question_answers;
CREATE POLICY "Users can update own answers"
  ON public.daily_question_answers
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND is_public = false);

DROP POLICY IF EXISTS "Users can delete own answers" ON public.daily_question_answers;
CREATE POLICY "Users can delete own answers"
  ON public.daily_question_answers
  FOR DELETE
  USING (auth.uid() = user_id);
