-- ============================================================
-- ELIGIBLE VOTERS + OTP LOGIN + SCOPED SESSIONS + RECEIPTS
-- ============================================================

-- 1. eligible_voters — admin-uploaded voter list, scoped per election
CREATE TABLE IF NOT EXISTS public.eligible_voters (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id   uuid        NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
  full_name     text        NOT NULL,
  phone_number  text        NOT NULL,  -- stored in E.164 format e.g. +233244123456
  has_voted     boolean     NOT NULL DEFAULT false,
  voted_at      timestamptz,
  uploaded_by   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (election_id, phone_number)   -- one phone per election
);
CREATE INDEX IF NOT EXISTS idx_eligible_voters_election ON public.eligible_voters(election_id);
CREATE INDEX IF NOT EXISTS idx_eligible_voters_phone    ON public.eligible_voters(election_id, phone_number);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.eligible_voters TO service_role;
ALTER TABLE public.eligible_voters ENABLE ROW LEVEL SECURITY;
-- Only service_role (server functions) touches this table
CREATE TRIGGER trg_eligible_voters_updated
  BEFORE UPDATE ON public.eligible_voters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. otp_requests — hashed OTPs, rate-limited
CREATE TABLE IF NOT EXISTS public.otp_requests (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  eligible_voter_id   uuid        NOT NULL REFERENCES public.eligible_voters(id) ON DELETE CASCADE,
  election_id         uuid        NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
  code_hash           text        NOT NULL,   -- SHA-256 hex of the 6-digit OTP
  expires_at          timestamptz NOT NULL,
  is_used             boolean     NOT NULL DEFAULT false,
  attempts            int         NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_otp_voter    ON public.otp_requests(eligible_voter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_otp_election ON public.otp_requests(election_id);
GRANT SELECT, INSERT, UPDATE ON public.otp_requests TO service_role;
ALTER TABLE public.otp_requests ENABLE ROW LEVEL SECURITY;

-- 3. voter_sessions — short-lived scoped session tokens issued after OTP success
CREATE TABLE IF NOT EXISTS public.voter_sessions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  eligible_voter_id   uuid        NOT NULL REFERENCES public.eligible_voters(id) ON DELETE CASCADE,
  election_id         uuid        NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
  token_hash          text        NOT NULL UNIQUE,  -- SHA-256 hex of the raw token
  expires_at          timestamptz NOT NULL,
  is_used             boolean     NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_voter_sessions_token   ON public.voter_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_voter_sessions_voter   ON public.voter_sessions(eligible_voter_id);
GRANT SELECT, INSERT, UPDATE ON public.voter_sessions TO service_role;
ALTER TABLE public.voter_sessions ENABLE ROW LEVEL SECURITY;

-- 4. vote_receipts — decoupled from voter identity
CREATE TABLE IF NOT EXISTS public.vote_receipts (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id   uuid        NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
  receipt_code  text        NOT NULL UNIQUE,  -- short alphanumeric shown to voter
  vote_uuid     uuid        NOT NULL UNIQUE,  -- links to the anonymous vote batch
  cast_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_receipts_code     ON public.vote_receipts(receipt_code);
CREATE INDEX IF NOT EXISTS idx_receipts_election ON public.vote_receipts(election_id);
GRANT SELECT, INSERT ON public.vote_receipts TO service_role;
-- Allow public receipt verification (code lookup only — no voter identity exposed)
GRANT SELECT ON public.vote_receipts TO anon, authenticated;
ALTER TABLE public.vote_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "receipts public verify" ON public.vote_receipts
  FOR SELECT TO anon, authenticated USING (true);

-- 5. voter_upload_audit — log every CSV upload
CREATE TABLE IF NOT EXISTS public.voter_upload_audit (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id   uuid        NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
  uploaded_by   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_rows    int         NOT NULL DEFAULT 0,
  accepted      int         NOT NULL DEFAULT 0,
  rejected      int         NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.voter_upload_audit TO service_role;
ALTER TABLE public.voter_upload_audit ENABLE ROW LEVEL SECURITY;

-- 6. Modify votes table: add vote_uuid column (anonymous batch identifier)
--    We keep ticket_id nullable for backward compat with existing rows,
--    new OTP-based votes will have ticket_id = NULL and vote_uuid set.
ALTER TABLE public.votes
  ADD COLUMN IF NOT EXISTS vote_uuid uuid;
CREATE INDEX IF NOT EXISTS idx_votes_vote_uuid ON public.votes(vote_uuid);

-- 7. Atomic cast-vote function — runs in a single transaction
--    Inserts vote rows, marks has_voted, generates receipt.
--    Returns receipt_code.
CREATE OR REPLACE FUNCTION public.cast_voter_ballot(
  _session_token  text,
  _selections     jsonb   -- [{"position_id": "...", "candidate_id": "..."}]
)
RETURNS text   -- receipt_code
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _session        public.voter_sessions%ROWTYPE;
  _voter          public.eligible_voters%ROWTYPE;
  _election       public.elections%ROWTYPE;
  _token_hash     text;
  _vote_uuid      uuid;
  _receipt_code   text;
  _sel            jsonb;
  _pos_id         uuid;
  _cand_id        uuid;
BEGIN
  -- Hash the incoming token
  _token_hash := encode(digest(_session_token, 'sha256'), 'hex');

  -- Fetch and validate session
  SELECT * INTO _session FROM public.voter_sessions
    WHERE token_hash = _token_hash AND is_used = false AND expires_at > now();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired session token.' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Fetch voter
  SELECT * INTO _voter FROM public.eligible_voters WHERE id = _session.eligible_voter_id;
  IF _voter.has_voted THEN
    RAISE EXCEPTION 'You have already cast your vote in this election.' USING ERRCODE = 'unique_violation';
  END IF;

  -- Fetch election
  SELECT * INTO _election FROM public.elections WHERE id = _session.election_id;
  IF _election.status <> 'active' THEN
    RAISE EXCEPTION 'Election is not currently active.' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Generate anonymous vote_uuid and receipt_code
  _vote_uuid    := gen_random_uuid();
  _receipt_code := upper(substring(encode(gen_random_bytes(6), 'hex') FROM 1 FOR 10));

  -- Insert vote rows (no voter identity — only election + position + candidate + vote_uuid)
  FOR _sel IN SELECT * FROM jsonb_array_elements(_selections)
  LOOP
    _pos_id  := (_sel->>'position_id')::uuid;
    _cand_id := (_sel->>'candidate_id')::uuid;
    INSERT INTO public.votes (election_id, position_id, candidate_id, vote_uuid)
      VALUES (_election.id, _pos_id, _cand_id, _vote_uuid);
  END LOOP;

  -- Mark voter as voted
  UPDATE public.eligible_voters
    SET has_voted = true, voted_at = now()
    WHERE id = _voter.id;

  -- Invalidate session
  UPDATE public.voter_sessions SET is_used = true WHERE id = _session.id;

  -- Create receipt (decoupled — no voter identity)
  INSERT INTO public.vote_receipts (election_id, receipt_code, vote_uuid)
    VALUES (_election.id, _receipt_code, _vote_uuid);

  RETURN _receipt_code;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cast_voter_ballot(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cast_voter_ballot(text, jsonb) TO service_role;
