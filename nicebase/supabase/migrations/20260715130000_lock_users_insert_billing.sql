-- ============================================================
-- Lock the users INSERT path the same way UPDATE was locked in
-- 20260620010000. That earlier migration column-locked UPDATE but left INSERT
-- table-wide-granted, and the INSERT policy only guards is_premium. So a client
-- could self-insert its FIRST users row with an inflated aiya_messages_limit
-- (e.g. 100000) while keeping is_premium=false — and the aiya-chat edge function
-- reads aiya_messages_limit straight off the row as the quota ceiling, granting
-- effectively unlimited Aiya usage and bypassing the weekly meter / paywall.
--
-- Fix: revoke the table-wide INSERT grant and re-grant INSERT only on the
-- non-billing columns. The billing/metering columns then fall to their safe
-- DEFAULTs (is_premium=false, aiya_messages_used=0, aiya_messages_limit=50,
-- aiya_usage_period_start=now()). The Aiya edge function uses the SERVICE_ROLE
-- key and BYPASSES column grants, so server-side provisioning is unaffected.
--
-- The client insert (src/lib/userService.ts) is updated in the same change to
-- STOP sending the billing columns, so its upsert relies on these DEFAULTs.
--
-- IMPORTANT: when a NEW client-insertable column is added to users later, add it
-- to this GRANT list too, or client inserts of that column will be denied.
-- ============================================================

REVOKE INSERT ON public.users FROM authenticated;
REVOKE INSERT ON public.users FROM anon;

GRANT INSERT (
  id,
  email,
  display_name,
  bio,
  avatar_url,
  birthday,
  location,
  weekly_summary_day,
  daily_reminder_time,
  language,
  theme,
  created_at
) ON public.users TO authenticated;
