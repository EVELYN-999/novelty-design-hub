-- Add election_type to elections
ALTER TABLE public.elections
  ADD COLUMN IF NOT EXISTS election_type text NOT NULL DEFAULT 'general'
    CHECK (election_type IN ('general','executive','board','union','departmental','committee','other'));
