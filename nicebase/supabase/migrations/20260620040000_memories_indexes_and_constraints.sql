-- ============================================================
-- Schema/index hardening:
--   1. Composite index for the incremental-sync hot path.
--   2. Align users.aiya_messages_limit DEFAULT with the app (50).
--   3. Validate the memories.categories array against the allowed set.
--   4. Make weekly_summaries (user_id, week_start) unique so summary
--      writes can upsert instead of duplicating.
-- ============================================================

-- 1. Every sync poll runs:
--    SELECT ... WHERE user_id = $1 AND updated_at > $2 ORDER BY updated_at DESC
--    A composite (user_id, updated_at DESC) index serves both the filter
--    and the ordering.
CREATE INDEX IF NOT EXISTS memories_user_id_updated_at_idx
  ON public.memories (user_id, updated_at DESC);

-- 2. The column default was still 30 while the app and the
--    aiya-limit migration use 50.
ALTER TABLE public.users
  ALTER COLUMN aiya_messages_limit SET DEFAULT 50;

-- 3. Guard the categories[] array so DB/union drift cannot inject a
--    value the UI can't render. Added NOT VALID so the constraint
--    enforces on all new/updated rows WITHOUT failing the migration on
--    any pre-existing legacy row. (Run VALIDATE CONSTRAINT later once
--    existing rows are confirmed clean.)
ALTER TABLE public.memories
  DROP CONSTRAINT IF EXISTS memories_categories_check;

ALTER TABLE public.memories
  ADD CONSTRAINT memories_categories_check
  CHECK (
    categories <@ ARRAY[
      'uncategorized','success','peace','fun','love',
      'gratitude','inspiration','growth','adventure'
    ]::text[]
  ) NOT VALID;

-- 4. weekly_summaries: dedupe then add a unique key on (user_id,
--    week_start) so the weekly-summary write path can upsert.
--    The dedup keeps the most recent row per (user, week); the
--    (created_at, id) ordering is null-safe and breaks exact ties.
DELETE FROM public.weekly_summaries a
USING public.weekly_summaries b
WHERE a.user_id = b.user_id
  AND a.week_start = b.week_start
  AND (
    COALESCE(a.created_at, 'epoch'::timestamptz),
    a.id
  ) < (
    COALESCE(b.created_at, 'epoch'::timestamptz),
    b.id
  );

CREATE UNIQUE INDEX IF NOT EXISTS weekly_summaries_user_week_key
  ON public.weekly_summaries (user_id, week_start);
