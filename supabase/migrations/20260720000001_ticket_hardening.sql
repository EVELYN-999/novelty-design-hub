-- ============================================================
-- TICKET HARDENING & AUDIT
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================================

-- 1. Add issued_by (admin who issued) and expires_at to voting_tickets
ALTER TABLE public.voting_tickets
  ADD COLUMN IF NOT EXISTS issued_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- 2. Performance indexes
CREATE INDEX IF NOT EXISTS idx_tickets_election   ON public.voting_tickets(election_id);
CREATE INDEX IF NOT EXISTS idx_tickets_user       ON public.voting_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_code       ON public.voting_tickets(code);
CREATE INDEX IF NOT EXISTS idx_tickets_status     ON public.voting_tickets(election_id, status);
CREATE INDEX IF NOT EXISTS idx_votes_election     ON public.votes(election_id);
CREATE INDEX IF NOT EXISTS idx_votes_ticket       ON public.votes(ticket_id);
CREATE INDEX IF NOT EXISTS idx_votes_candidate    ON public.votes(candidate_id);

-- 3. Ticket audit log — every issue / revoke / use is recorded
CREATE TABLE IF NOT EXISTS public.ticket_audit_log (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id    uuid        NOT NULL REFERENCES public.voting_tickets(id) ON DELETE CASCADE,
  election_id  uuid        NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action       text        NOT NULL CHECK (action IN ('issued','used','terminated','revoked')),
  actor_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,  -- admin who acted (null = system)
  detail       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ticket_audit_ticket   ON public.ticket_audit_log(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_audit_election ON public.ticket_audit_log(election_id);
CREATE INDEX IF NOT EXISTS idx_ticket_audit_user     ON public.ticket_audit_log(user_id);
GRANT SELECT ON public.ticket_audit_log TO authenticated;
GRANT ALL    ON public.ticket_audit_log TO service_role;
ALTER TABLE public.ticket_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit admin read" ON public.ticket_audit_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 4. Upgrade terminate_election_tickets to also write audit rows
CREATE OR REPLACE FUNCTION public.terminate_election_tickets(_election_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Insert audit rows for every active ticket being terminated
  INSERT INTO public.ticket_audit_log (ticket_id, election_id, user_id, action, actor_id, detail)
  SELECT id, election_id, user_id, 'terminated', NULL,
         jsonb_build_object('reason', 'election_ended')
  FROM   public.voting_tickets
  WHERE  election_id = _election_id AND status = 'active';

  -- Terminate them
  UPDATE public.voting_tickets
    SET status = 'terminated'
  WHERE election_id = _election_id AND status = 'active';
END;
$$;

-- Keep execute restricted to service_role only
REVOKE EXECUTE ON FUNCTION public.terminate_election_tickets(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.terminate_election_tickets(uuid) TO service_role;

-- 5. Function: auto-expire tickets whose expires_at has passed (called by cron or on-demand)
CREATE OR REPLACE FUNCTION public.expire_stale_tickets()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _count integer;
BEGIN
  WITH expired AS (
    UPDATE public.voting_tickets
      SET status = 'terminated'
    WHERE status = 'active'
      AND expires_at IS NOT NULL
      AND expires_at < now()
    RETURNING id, election_id, user_id
  )
  INSERT INTO public.ticket_audit_log (ticket_id, election_id, user_id, action, detail)
  SELECT id, election_id, user_id, 'terminated',
         jsonb_build_object('reason', 'expired')
  FROM expired;

  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.expire_stale_tickets() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.expire_stale_tickets() TO service_role;

-- 6. Prevent double-voting at DB level (already enforced by UNIQUE(ticket_id, position_id) on votes)
--    Add a check: a ticket can only cast votes if status = 'active'
CREATE OR REPLACE FUNCTION public.check_ticket_active()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _status text;
BEGIN
  SELECT status INTO _status FROM public.voting_tickets WHERE id = NEW.ticket_id;
  IF _status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Ticket % is not active (status: %)', NEW.ticket_id, _status
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_votes_check_ticket ON public.votes;
CREATE TRIGGER trg_votes_check_ticket
  BEFORE INSERT ON public.votes
  FOR EACH ROW EXECUTE FUNCTION public.check_ticket_active();

-- 7. After a vote is inserted, mark the ticket as used and write audit
CREATE OR REPLACE FUNCTION public.mark_ticket_used()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Only mark used once (first vote row for this ticket triggers it)
  UPDATE public.voting_tickets
    SET status = 'used', used_at = now()
  WHERE id = NEW.ticket_id AND status = 'active';

  -- Audit (only if we actually changed it)
  IF FOUND THEN
    INSERT INTO public.ticket_audit_log (ticket_id, election_id, user_id, action, detail)
    SELECT NEW.ticket_id, NEW.election_id, user_id, 'used',
           jsonb_build_object('vote_id', NEW.id)
    FROM   public.voting_tickets WHERE id = NEW.ticket_id;
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_votes_mark_used ON public.votes;
CREATE TRIGGER trg_votes_mark_used
  AFTER INSERT ON public.votes
  FOR EACH ROW EXECUTE FUNCTION public.mark_ticket_used();

-- 8. Election history view — admin sees all elections with ticket + vote counts
CREATE OR REPLACE VIEW public.election_history AS
SELECT
  e.id,
  e.title,
  e.description,
  e.status,
  e.location,
  e.region,
  e.created_at,
  e.activated_at,
  e.ended_at,
  e.starts_at,
  e.ends_at,
  COUNT(DISTINCT t.id)                                          AS tickets_issued,
  COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'active')      AS tickets_active,
  COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'used')        AS tickets_used,
  COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'terminated')  AS tickets_terminated,
  COUNT(DISTINCT v.id)                                          AS total_votes,
  CASE WHEN COUNT(DISTINCT t.id) > 0
    THEN ROUND(COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'used')::numeric
               / COUNT(DISTINCT t.id) * 100, 1)
    ELSE 0
  END AS turnout_pct
FROM public.elections e
LEFT JOIN public.voting_tickets t ON t.election_id = e.id
LEFT JOIN public.votes           v ON v.election_id = e.id
GROUP BY e.id;

GRANT SELECT ON public.election_history TO authenticated;
ALTER VIEW public.election_history OWNER TO postgres;
