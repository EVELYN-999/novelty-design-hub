
CREATE TABLE public.positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.positions TO anon, authenticated;
GRANT ALL ON public.positions TO service_role;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "positions readable by all" ON public.positions FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,
  name text NOT NULL,
  bio text NOT NULL DEFAULT '',
  photo_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_candidates_position ON public.candidates(position_id);
GRANT SELECT ON public.candidates TO anon, authenticated;
GRANT ALL ON public.candidates TO service_role;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "candidates readable by all" ON public.candidates FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.election_state (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  title text NOT NULL DEFAULT 'General Election 2026',
  locked boolean NOT NULL DEFAULT false,
  locked_at timestamptz,
  ballot_hash text,
  opens_at timestamptz,
  closes_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.election_state TO anon, authenticated;
GRANT ALL ON public.election_state TO service_role;
ALTER TABLE public.election_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "election_state readable by all" ON public.election_state FOR SELECT TO anon, authenticated USING (true);
INSERT INTO public.election_state (id) VALUES (1);

CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor text NOT NULL,
  action text NOT NULL,
  target text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_audit_log TO anon, authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit log readable by all" ON public.admin_audit_log FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.admin_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  code_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_codes TO service_role;
ALTER TABLE public.admin_codes ENABLE ROW LEVEL SECURITY;

INSERT INTO public.admin_codes (label, code_hash)
VALUES ('default', encode(digest('ADMIN-2026', 'sha256'), 'hex'));

WITH p AS (
  INSERT INTO public.positions (name, description, display_order) VALUES
    ('President',      'Chief executive of the assembly.', 1),
    ('Vice President', 'Second officer and successor.',    2),
    ('Treasurer',      'Steward of the public purse.',     3)
  RETURNING id, name
)
INSERT INTO public.candidates (position_id, name, bio, photo_url)
SELECT p.id, c.name, c.bio, c.photo_url FROM p JOIN (VALUES
  ('President',      'Ada Okonkwo',   'Systems engineer. Ten years in civic infrastructure.', 'https://api.dicebear.com/9.x/notionists/svg?seed=ada'),
  ('President',      'Marcus Vale',   'Public defender. Reform of transparent governance.',    'https://api.dicebear.com/9.x/notionists/svg?seed=marcus'),
  ('President',      'Priya Ramanan', 'Economist. Focused on housing and public transit.',     'https://api.dicebear.com/9.x/notionists/svg?seed=priya'),
  ('Vice President', 'Bilal Khan',    'Data scientist. Two-term district representative.',     'https://api.dicebear.com/9.x/notionists/svg?seed=bilal'),
  ('Vice President', 'Elena Duarte',  'Urban planner. Championed the open-records ordinance.', 'https://api.dicebear.com/9.x/notionists/svg?seed=elena'),
  ('Treasurer',      'Hana Sato',     'CPA. Overhauled the municipal audit process.',          'https://api.dicebear.com/9.x/notionists/svg?seed=hana'),
  ('Treasurer',      'Jonah Weiss',   'Former banking regulator. Ledger-first budgeting.',     'https://api.dicebear.com/9.x/notionists/svg?seed=jonah')
) AS c(position_name, name, bio, photo_url) ON c.position_name = p.name;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER positions_set_updated  BEFORE UPDATE ON public.positions      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER candidates_set_updated BEFORE UPDATE ON public.candidates     FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER election_set_updated   BEFORE UPDATE ON public.election_state FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_ballot_lock()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE is_locked boolean;
BEGIN
  SELECT locked INTO is_locked FROM public.election_state WHERE id = 1;
  IF is_locked THEN
    RAISE EXCEPTION 'Ballot is locked; no changes to % permitted.', TG_TABLE_NAME USING ERRCODE = 'check_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER positions_lock  BEFORE INSERT OR UPDATE OR DELETE ON public.positions  FOR EACH ROW EXECUTE FUNCTION public.enforce_ballot_lock();
CREATE TRIGGER candidates_lock BEFORE INSERT OR UPDATE OR DELETE ON public.candidates FOR EACH ROW EXECUTE FUNCTION public.enforce_ballot_lock();
