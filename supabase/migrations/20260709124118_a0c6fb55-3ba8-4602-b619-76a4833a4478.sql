
-- Voter roster (pre-registered members)
CREATE TABLE public.voters (
  voter_id text PRIMARY KEY,
  display_name text NOT NULL,
  phone_mask text NOT NULL,
  has_voted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.voters TO service_role;
ALTER TABLE public.voters ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated policies: access via service role only from server fns.

-- One-time codes (hashed)
CREATE TABLE public.otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voter_id text NOT NULL REFERENCES public.voters(voter_id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT false,
  attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX otps_voter_id_idx ON public.otps(voter_id, created_at DESC);
GRANT ALL ON public.otps TO service_role;
ALTER TABLE public.otps ENABLE ROW LEVEL SECURITY;

-- Blind cast tokens (single-use, unlinked to voter after use)
CREATE TABLE public.cast_tokens (
  token text PRIMARY KEY,
  voter_id text NOT NULL REFERENCES public.voters(voter_id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.cast_tokens TO service_role;
ALTER TABLE public.cast_tokens ENABLE ROW LEVEL SECURITY;

-- Public hash-chained ballot ledger
CREATE TABLE public.ballots (
  entry_index bigserial PRIMARY KEY,
  receipt_hash text NOT NULL UNIQUE,
  prev_hash text NOT NULL,
  entry_hash text NOT NULL UNIQUE,
  token_fingerprint text NOT NULL,
  selections jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ballots_receipt_idx ON public.ballots(receipt_hash);
GRANT SELECT ON public.ballots TO anon, authenticated;
GRANT ALL ON public.ballots TO service_role;
ALTER TABLE public.ballots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ballots public read" ON public.ballots FOR SELECT TO anon, authenticated USING (true);
