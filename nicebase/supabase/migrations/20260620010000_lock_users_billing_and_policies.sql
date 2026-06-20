-- ============================================================
-- Harden public.users: stop clients from self-granting premium /
-- unlimited Aiya usage, and tighten the INSERT/UPDATE RLS policies.
--
-- Background: the base schema did GRANT ALL ON public.users TO
-- authenticated/anon and shipped an INSERT policy WITH CHECK (true).
-- That let any authenticated caller (a) insert a users row for any id
-- and (b) UPDATE their own is_premium / aiya_messages_* columns.
--
-- The Aiya edge function uses the SERVICE_ROLE key and BYPASSES both
-- RLS and column grants, so server-side metering / premium
-- provisioning keep working after this migration.
--
-- NOTE on technique: a bare `REVOKE UPDATE (col) ... ` does NOT remove
-- access while a table-wide UPDATE grant is still in place (a
-- table-level privilege is a superset that covers every column). The
-- correct, secure pattern is to REVOKE the table-wide UPDATE and then
-- GRANT UPDATE only on the columns clients may legitimately write.
-- ============================================================

-- 1. INSERT policy: a user may only insert their OWN row, and may not
--    seed is_premium = true on first creation.
DROP POLICY IF EXISTS "Users can insert own data" ON public.users;
CREATE POLICY "Users can insert own data"
  ON public.users
  FOR INSERT
  WITH CHECK (auth.uid() = id AND is_premium IS NOT TRUE);

-- 2. UPDATE policy: own row only, and the row must still belong to them
--    after the update (adds the missing WITH CHECK).
DROP POLICY IF EXISTS "Users can update own data" ON public.users;
CREATE POLICY "Users can update own data"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 3. Column-level UPDATE privileges.
--    Revoke the table-wide UPDATE grant, then re-grant only the columns
--    the client app actually edits (profile + preferences). The billing
--    columns (is_premium, aiya_messages_used, aiya_messages_limit) and
--    identity columns (id, email, created_at) are intentionally omitted
--    so clients cannot write them.
--
--    IMPORTANT: when a NEW client-editable column is added to users in a
--    future migration, add it to this GRANT list as well, otherwise
--    client updates to that column will be denied.
REVOKE UPDATE ON public.users FROM authenticated;
REVOKE UPDATE ON public.users FROM anon;

GRANT UPDATE (
  display_name,
  bio,
  avatar_url,
  birthday,
  location,
  weekly_summary_day,
  daily_reminder_time,
  language,
  theme
) ON public.users TO authenticated;
