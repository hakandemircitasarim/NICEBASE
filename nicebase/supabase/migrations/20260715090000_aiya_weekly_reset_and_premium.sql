-- ============================================================
-- Turn the Aiya message quota from a LIFETIME cap into a WEEKLY allowance, and
-- add a server-side premium entitlement helper.
--
-- Before this migration `aiya_messages_used` only ever incremented — nothing
-- reset it — so a user who reached their limit (default 50) months ago was
-- PERMANENTLY capped, while the UI told them to "try again later". Now the 50
-- allowance rolls over every 7 days, so "this period" is a real, recurring
-- weekly period.
-- ============================================================

-- 1) Track when the current weekly window started. Existing rows start "now",
--    and we reset everyone's counter once so anyone stuck at a previously
--    lifetime cap gets a fresh weekly allowance immediately.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS aiya_usage_period_start timestamptz NOT NULL DEFAULT now();

UPDATE public.users
   SET aiya_messages_used = 0,
       aiya_usage_period_start = now();

-- 2) Reset-on-roll metering. Same atomic "increment only while under limit"
--    contract as before, but first rolls the weekly window: if a full week has
--    elapsed since aiya_usage_period_start, the counter resets to 0 and a new
--    window opens before the increment is attempted.
CREATE OR REPLACE FUNCTION public.increment_aiya_usage(p_user uuid)
RETURNS TABLE(used integer, lim integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Roll the weekly window first (weekly allowance, not lifetime).
  UPDATE public.users u
     SET aiya_messages_used = 0,
         aiya_usage_period_start = now()
   WHERE u.id = p_user
     AND u.aiya_usage_period_start < now() - interval '7 days';

  RETURN QUERY
  UPDATE public.users u
     SET aiya_messages_used = u.aiya_messages_used + 1
   WHERE u.id = p_user
     AND u.aiya_messages_used < u.aiya_messages_limit
  RETURNING u.aiya_messages_used, u.aiya_messages_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_aiya_usage(uuid) FROM public;
REVOKE ALL ON FUNCTION public.increment_aiya_usage(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.increment_aiya_usage(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.increment_aiya_usage(uuid) TO service_role;

-- 3) Premium entitlement helper. is_premium is client-un-writable (locked by
--    20260620010000), so premium must be flipped server-side. A future billing
--    webhook (e.g. RevenueCat) calls this with the service_role key. Premium
--    raises the weekly allowance to an effectively-unlimited sentinel; downgrade
--    restores the free 50/week. SECURITY DEFINER + service_role-only EXECUTE.
CREATE OR REPLACE FUNCTION public.set_user_premium(p_user uuid, p_premium boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
     SET is_premium = p_premium,
         aiya_messages_limit = CASE WHEN p_premium THEN 100000 ELSE 50 END
   WHERE id = p_user;
END;
$$;

REVOKE ALL ON FUNCTION public.set_user_premium(uuid, boolean) FROM public;
REVOKE ALL ON FUNCTION public.set_user_premium(uuid, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.set_user_premium(uuid, boolean) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_premium(uuid, boolean) TO service_role;
