-- Olé Olé MVP — Place / Presence schema (issue #42)
-- Service: oleole · Agent: John · Operator: C.O.R.S.I.C.A.
-- Reuses JHN / personal instance Supabase initially; public semantic ids are portable.

-- ---------------------------------------------------------------------------
-- Places (provider-independent canonical ids: place:...)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.oleole_places (
  id text PRIMARY KEY, -- place:...
  name text NOT NULL,
  name_co text,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  classification text NOT NULL DEFAULT 'municipality',
  status text NOT NULL DEFAULT 'open',
  precision_default text NOT NULL DEFAULT 'municipality',
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT oleole_places_id_prefix CHECK (id LIKE 'place:%')
);

CREATE INDEX IF NOT EXISTS oleole_places_name_idx ON public.oleole_places (name);
CREATE INDEX IF NOT EXISTS oleole_places_class_idx ON public.oleole_places (classification);

COMMENT ON TABLE public.oleole_places IS 'Olé Olé Place records with multi-provider provenance; internal id is canonical.';
COMMENT ON COLUMN public.oleole_places.sources IS 'Array of {provider, ref} e.g. osm, overture — never sole identity.';

-- ---------------------------------------------------------------------------
-- Presence claims (individual rows; public map uses aggregates only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.oleole_presence_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_ref text NOT NULL,
  place_ref text REFERENCES public.oleole_places (id),
  place_name text,
  valid_from timestamptz NOT NULL,
  valid_until timestamptz NOT NULL,
  modality text NOT NULL DEFAULT 'declared'
    CHECK (modality IN ('declared', 'intended', 'automatic', 'inferred')),
  precision text NOT NULL DEFAULT 'municipality'
    CHECK (precision IN ('municipality', 'area', 'poi', 'precise')),
  visibility text NOT NULL DEFAULT 'aggregate'
    CHECK (visibility IN ('aggregate', 'bounded', 'private')),
  source text,
  service text NOT NULL DEFAULT 'oleole',
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CONSTRAINT oleole_presence_valid_range CHECK (valid_until > valid_from)
);

CREATE INDEX IF NOT EXISTS oleole_presence_active_idx
  ON public.oleole_presence_claims (place_ref, valid_from, valid_until)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS oleole_presence_subject_idx
  ON public.oleole_presence_claims (subject_ref)
  WHERE revoked_at IS NULL;

COMMENT ON TABLE public.oleole_presence_claims IS 'PresenceClaim rows; do not expose subject_ref on public map APIs.';

-- ---------------------------------------------------------------------------
-- Intent attached to a claim (public output is aggregate only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.oleole_presence_intents (
  claim_id uuid PRIMARY KEY REFERENCES public.oleole_presence_claims (id) ON DELETE CASCADE,
  discovery boolean NOT NULL DEFAULT false,
  social boolean NOT NULL DEFAULT false,
  oleole boolean NOT NULL DEFAULT false,
  visibility text NOT NULL DEFAULT 'aggregate',
  valid_until timestamptz
);

COMMENT ON COLUMN public.oleole_presence_intents.oleole IS 'Aggregate encounter openness flag; not consent to contact.';

-- ---------------------------------------------------------------------------
-- Per-subject contribution policy (auto/manual/off)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.oleole_presence_policies (
  subject_ref text PRIMARY KEY,
  mode text NOT NULL DEFAULT 'manual'
    CHECK (mode IN ('off', 'manual', 'assisted', 'auto')),
  precision text NOT NULL DEFAULT 'municipality'
    CHECK (precision IN ('municipality', 'area', 'poi', 'precise')),
  valid_until timestamptz,
  paused boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Optional future: account ↔ subject link (portable identity)
CREATE TABLE IF NOT EXISTS public.oleole_account_subject_links (
  account_id uuid,
  subject_ref text NOT NULL,
  service text NOT NULL DEFAULT 'oleole',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subject_ref, service)
);

-- ---------------------------------------------------------------------------
-- RLS / privileges: all Presence data is private behind the edge API. The edge
-- uses the service role server-side and derives the subject from a verified
-- session or signed pseudonymous participant cookie. No browser role may query
-- or mutate individual claims, intents, policies, or account links directly.
-- ---------------------------------------------------------------------------
ALTER TABLE public.oleole_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oleole_presence_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oleole_presence_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oleole_presence_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oleole_account_subject_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS oleole_places_public_read ON public.oleole_places;
DROP POLICY IF EXISTS oleole_claims_service ON public.oleole_presence_claims;
DROP POLICY IF EXISTS oleole_intents_service ON public.oleole_presence_intents;
DROP POLICY IF EXISTS oleole_policies_service ON public.oleole_presence_policies;

REVOKE ALL PRIVILEGES ON public.oleole_places,
  public.oleole_presence_claims,
  public.oleole_presence_intents,
  public.oleole_presence_policies,
  public.oleole_account_subject_links
  FROM anon, authenticated;

-- Note: tighten RLS when dedicated auth lands; edge API remains the public gate.

-- ---------------------------------------------------------------------------
-- Seed Corsica places (idempotent)
-- ---------------------------------------------------------------------------
INSERT INTO public.oleole_places (id, name, name_co, lat, lng, classification, status, precision_default, sources)
VALUES
  ('place:corte', 'Corte', 'Corti', 42.3094, 9.149, 'municipality', 'open', 'municipality',
   '[{"provider":"osm","ref":"relation/119336"},{"provider":"overture","ref":"locality:corte-corsica"}]'::jsonb),
  ('place:ajaccio', 'Ajaccio', 'Aiacciu', 41.9192, 8.7386, 'municipality', 'open', 'municipality',
   '[{"provider":"osm","ref":"relation/119317"},{"provider":"overture","ref":"locality:ajaccio-corsica"}]'::jsonb),
  ('place:bastia', 'Bastia', NULL, 42.6973, 9.4509, 'municipality', 'open', 'municipality',
   '[{"provider":"osm","ref":"relation/119320"},{"provider":"overture","ref":"locality:bastia-corsica"}]'::jsonb),
  ('place:calvi', 'Calvi', NULL, 42.5667, 8.7572, 'municipality', 'open', 'municipality',
   '[{"provider":"osm","ref":"relation/119328"},{"provider":"overture","ref":"locality:calvi-corsica"}]'::jsonb),
  ('place:porto-vecchio', 'Porto-Vecchio', 'Portivechju', 41.591, 9.2795, 'municipality', 'open', 'municipality',
   '[{"provider":"osm","ref":"relation/119374"},{"provider":"overture","ref":"locality:porto-vecchio-corsica"}]'::jsonb),
  ('place:bonifacio', 'Bonifacio', 'Bunifaziu', 41.3874, 9.1594, 'municipality', 'open', 'municipality',
   '[{"provider":"osm","ref":"relation/119324"},{"provider":"overture","ref":"locality:bonifacio-corsica"}]'::jsonb),
  ('place:propriano', 'Propriano', 'Prupià', 41.6753, 8.9047, 'municipality', 'open', 'municipality',
   '[{"provider":"osm","ref":"relation/119376"}]'::jsonb),
  ('place:sartene', 'Sartène', 'Sartè', 41.621, 8.973, 'municipality', 'open', 'municipality',
   '[{"provider":"osm","ref":"relation/119382"}]'::jsonb),
  ('place:ile-rousse', 'L''Île-Rousse', 'Isula Rossa', 42.635, 8.937, 'municipality', 'open', 'municipality',
   '[{"provider":"osm","ref":"relation/119350"}]'::jsonb),
  ('place:ghisonaccia', 'Ghisonaccia', NULL, 42.016, 9.405, 'municipality', 'open', 'municipality',
   '[{"provider":"osm","ref":"relation/119346"}]'::jsonb),
  ('place:corte-citadelle', 'Citadelle de Corte', NULL, 42.3065, 9.1505, 'poi', 'open', 'poi',
   '[{"provider":"osm","ref":"way/123456789"},{"provider":"overture","ref":"poi:citadelle-corte"}]'::jsonb),
  ('place:ajaccio-port', 'Port d''Ajaccio', NULL, 41.9215, 8.7405, 'poi', 'open', 'poi',
   '[{"provider":"osm","ref":"way/ajaccio-port"}]'::jsonb),
  ('place:bastia-vieux-port', 'Vieux Port de Bastia', NULL, 42.6978, 9.4518, 'poi', 'open', 'poi',
   '[{"provider":"osm","ref":"way/bastia-vieux-port"}]'::jsonb),
  ('place:calvi-citadelle', 'Citadelle de Calvi', NULL, 42.5678, 8.756, 'poi', 'open', 'poi',
   '[{"provider":"osm","ref":"way/calvi-citadelle"}]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  name_co = EXCLUDED.name_co,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  classification = EXCLUDED.classification,
  sources = EXCLUDED.sources,
  updated_at = now();
