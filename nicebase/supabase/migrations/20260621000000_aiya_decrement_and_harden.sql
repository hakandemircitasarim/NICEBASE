-- ============================================================
-- Aiya metering follow-ups (audit batch A):
--
-- 1. decrement_aiya_usage: atomic relative -1 refund used by the edge
--    function when an OpenAI call fails AFTER a slot was reserved. A
--    relative GREATEST(0, used - 1) can never clobber a concurrent +1 the
--    way the previous absolute write of a stale snapshot could.
--
-- 2. Harden increment_aiya_usage against NULL columns: the comparison
--    aiya_messages_used < aiya_messages_limit is NULL (=> matches nothing,
--    => meterUsage returns null, => the user is wrongly told "limit
--    exceeded") if either column is NULL. COALESCE both sides.
--
-- 3. Make the two metering columns NOT NULL with sane defaults so the NULL
--    edge cannot recur from any future write path.
-- ============================================================

-- ---- 1. Atomic usage decrement (refund) -------------------------------
CREATE OR REPLACE FUNCTION public.decrement_aiya_usage(p_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users u
     SET aiya_messages_used = GREATEST(0, COALESCE(u.aiya_messages_used, 0) - 1)
   WHERE u.id = p_user;
END;
$$;

REVOKE ALL ON FUNCTION public.decrement_aiya_usage(uuid) FROM public;
REVOKE ALL ON FUNCTION public.decrement_aiya_usage(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.decrement_aiya_usage(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_aiya_usage(uuid) TO service_role;

-- ---- 2. NULL-hardened increment ---------------------------------------
CREATE OR REPLACE FUNCTION public.increment_aiya_usage(p_user uuid)
RETURNS TABLE(used integer, lim integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.users u
     SET aiya_messages_used = COALESCE(u.aiya_messages_used, 0) + 1
   WHERE u.id = p_user
     AND COALESCE(u.aiya_messages_used, 0) < COALESCE(u.aiya_messages_limit, 50)
  RETURNING u.aiya_messages_used, u.aiya_messages_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_aiya_usage(uuid) FROM public;
REVOKE ALL ON FUNCTION public.increment_aiya_usage(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.increment_aiya_usage(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.increment_aiya_usage(uuid) TO service_role;

-- ---- 3. Backfill + NOT NULL the metering columns ----------------------
UPDATE public.users
   SET aiya_messages_used  = COALESCE(aiya_messages_used, 0),
       aiya_messages_limit = COALESCE(aiya_messages_limit, 50)
 WHERE aiya_messages_used IS NULL
    OR aiya_messages_limit IS NULL;

ALTER TABLE public.users
  ALTER COLUMN aiya_messages_used  SET DEFAULT 0,
  ALTER COLUMN aiya_messages_used  SET NOT NULL,
  ALTER COLUMN aiya_messages_limit SET DEFAULT 50,
  ALTER COLUMN aiya_messages_limit SET NOT NULL;
