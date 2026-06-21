-- ============================================================
-- DB polish (audit batch F):
--   1. (#62) Normalize any out-of-range memories.categories, then VALIDATE the
--      memories_categories_check constraint that shipped NOT VALID.
--   2. (#33) Scope daily_questions reads to authenticated users only and drop
--      the broad GRANT ALL to anon/authenticated (service_role keeps full access).
-- ============================================================

-- ---- 1. Validate memories.categories -----------------------------------
-- Normalize legacy rows that hold a value outside the allowed set so the
-- VALIDATE below cannot fail. NULL categories are left as-is (the CHECK passes
-- on NULL). The constraint itself was created in 20260620040000 (runs first).
UPDATE public.memories
   SET categories = ARRAY['uncategorized']::text[]
 WHERE categories IS NOT NULL
   AND NOT (
     categories <@ ARRAY[
       'uncategorized','success','peace','fun','love',
       'gratitude','inspiration','growth','adventure'
     ]::text[]
   );

ALTER TABLE public.memories VALIDATE CONSTRAINT memories_categories_check;

-- ---- 2. daily_questions: authenticated-read only -----------------------
-- The questions are not user-specific, but the app requires login, so anon has
-- no reason to read them. Replace the public USING(true) policy and the broad
-- GRANT ALL with an authenticated-only SELECT.
DROP POLICY IF EXISTS "Anyone can read daily questions" ON public.daily_questions;

CREATE POLICY "Authenticated can read daily questions"
  ON public.daily_questions FOR SELECT
  TO authenticated
  USING (true);

REVOKE ALL ON TABLE public.daily_questions FROM anon;
REVOKE ALL ON TABLE public.daily_questions FROM authenticated;
GRANT SELECT ON TABLE public.daily_questions TO authenticated;
-- service_role keeps the GRANT ALL from 20260206100000 (inserts the questions).
