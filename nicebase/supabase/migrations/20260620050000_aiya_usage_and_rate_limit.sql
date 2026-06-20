-- ============================================================
-- Server-authoritative Aiya metering + burst rate limiting.
--
-- These functions are SECURITY DEFINER and EXECUTE-granted only to
-- service_role (the aiya-chat edge function). Clients cannot call them.
--
-- 1. increment_aiya_usage: atomically bumps aiya_messages_used by 1 ONLY
--    when the user is still under their limit, returning the new
--    (used, lim). No row returned => the user is at/over the cap. This
--    replaces the previous read-then-write increment (race-prone, and
--    the cap was checked against a stale snapshot).
--
-- 2. check_aiya_rate_limit: a fixed-window per-user burst limiter keyed
--    by a bucket name ('chat' vs 'classify'), so the unmetered
--    classify/category gpt-4o-mini path cannot be hammered with a valid
--    token, and the chat path gets a short-window ceiling on top of the
--    daily message quota.
-- ============================================================

-- ---- 1. Atomic usage increment ----------------------------------------
CREATE OR REPLACE FUNCTION public.increment_aiya_usage(p_user uuid)
RETURNS TABLE(used integer, lim integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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

-- ---- 2. Burst rate limiter --------------------------------------------
CREATE TABLE IF NOT EXISTS public.aiya_rate_limit (
  user_id      uuid        NOT NULL,
  bucket       text        NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  count        integer     NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, bucket)
);

-- RLS on with NO policies => only service_role (which bypasses RLS) can
-- read/write. Satisfies CLAUDE.md 2.1 (every table has RLS).
ALTER TABLE public.aiya_rate_limit ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.check_aiya_rate_limit(
  p_user uuid,
  p_bucket text,
  p_max integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now   timestamptz := now();
  v_count integer;
BEGIN
  INSERT INTO public.aiya_rate_limit (user_id, bucket, window_start, count)
  VALUES (p_user, p_bucket, v_now, 1)
  ON CONFLICT (user_id, bucket) DO UPDATE
    SET count = CASE
                  WHEN aiya_rate_limit.window_start < v_now - make_interval(secs => p_window_seconds)
                    THEN 1
                    ELSE aiya_rate_limit.count + 1
                END,
        window_start = CASE
                  WHEN aiya_rate_limit.window_start < v_now - make_interval(secs => p_window_seconds)
                    THEN v_now
                    ELSE aiya_rate_limit.window_start
                END
  RETURNING count INTO v_count;

  RETURN v_count <= p_max;
END;
$$;

REVOKE ALL ON FUNCTION public.check_aiya_rate_limit(uuid, text, integer, integer) FROM public;
REVOKE ALL ON FUNCTION public.check_aiya_rate_limit(uuid, text, integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.check_aiya_rate_limit(uuid, text, integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.check_aiya_rate_limit(uuid, text, integer, integer) TO service_role;
