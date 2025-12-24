-- Migration consolidée: Consultations, Fédération et Rôles
-- Date: 2025-12-04
-- Description: Migration complète incluant:
--   1. Colonne role sur users (pour RLS et évolution du système de permissions)
--   2. Tables consultations et consultation_responses
--   3. Champs de fédération pour les consultations
--   4. Colonnes pétitions pour les consultations
--   5. Tables federation_registry et consultation_imports

-- ============================================================================
-- PARTIE 1: COLONNE ROLE SUR USERS
-- Requis pour les policies RLS des consultations
-- Note: Le code JS utilise actuellement l'email pour déterminer le rôle admin
--       Cette colonne permettra une migration progressive vers un système DB-based
-- ============================================================================

-- Ajouter la colonne role si elle n'existe pas
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user';

-- Ajouter la contrainte CHECK pour les valeurs autorisées
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check'
  ) THEN
    ALTER TABLE public.users
    ADD CONSTRAINT users_role_check
    CHECK (role IN ('user', 'moderator', 'admin'));
  END IF;
END $$;

-- Index pour les recherches fréquentes (RLS policies)
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

COMMENT ON COLUMN public.users.role IS
  'Rôle utilisateur: user (citoyen standard), moderator (modérateur), admin (administrateur)';

-- ============================================================================
-- PARTIE 2: TABLE CONSULTATIONS
-- Registre des consultations (formulaires) disponibles
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.consultations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),

  -- Identification
  slug text NOT NULL UNIQUE,           -- ex: "quasquara-2024", "budget-2025"
  title text NOT NULL,
  description text,

  -- Période de validité
  starts_at timestamp with time zone DEFAULT now(),
  ends_at timestamp with time zone,     -- NULL = pas de fin

  -- Configuration du formulaire (schéma JSON des questions)
  schema jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Statistiques (mise à jour côté JS)
  response_count integer NOT NULL DEFAULT 0,

  -- Métadonnées
  status text NOT NULL DEFAULT 'active',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,

  -- ========================================
  -- Champs de fédération (ajoutés directement)
  -- ========================================

  -- Portée de la consultation
  scope text NOT NULL DEFAULT 'local',

  -- Instance source (pour les consultations importées)
  source_instance text,

  -- ID de la consultation sur l'instance source
  source_consultation_id uuid,

  -- URL de l'API pour synchroniser les réponses
  sync_endpoint text,

  -- Clé API pour la synchronisation (chiffrée en prod)
  sync_api_key text,

  -- Configuration de fédération (métadonnées)
  federation_config jsonb DEFAULT '{}'::jsonb,

  -- Dernier sync
  last_synced_at timestamp with time zone,

  -- Compteur de réponses synchronisées
  synced_response_count integer NOT NULL DEFAULT 0,

  -- ========================================
  -- Champs pétitions (liens externes)
  -- ========================================

  -- Lien vers pétition locale (commune)
  petition_local text,

  -- Lien vers pétition régionale
  petition_regional text,

  -- Lien vers pétition nationale
  petition_national text,

  -- Métadonnées des pétitions (titre, plateforme, icône...)
  petitions_metadata jsonb DEFAULT '{}'::jsonb,

  CONSTRAINT consultations_pkey PRIMARY KEY (id),
  CONSTRAINT consultations_status_check CHECK (status IN ('draft', 'active', 'closed', 'archived')),
  CONSTRAINT consultations_scope_check CHECK (scope IN ('local', 'regional', 'national', 'custom'))
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_consultations_slug ON public.consultations(slug);
CREATE INDEX IF NOT EXISTS idx_consultations_status ON public.consultations(status);
CREATE INDEX IF NOT EXISTS idx_consultations_scope ON public.consultations(scope);

-- Commentaires
COMMENT ON TABLE public.consultations IS 'Registre des consultations citoyennes';
COMMENT ON COLUMN public.consultations.scope IS
  'Portée: local (commune), regional (ex: Corse), national (France), custom (réseau personnalisé)';
COMMENT ON COLUMN public.consultations.source_instance IS
  'URL de l''instance source si importée. NULL = hébergée localement';
COMMENT ON COLUMN public.consultations.source_consultation_id IS
  'ID original sur l''instance source (pour la synchronisation)';
COMMENT ON COLUMN public.consultations.petition_local IS 'URL vers pétition locale (Change.org, mairie...)';
COMMENT ON COLUMN public.consultations.petition_regional IS 'URL vers pétition régionale';
COMMENT ON COLUMN public.consultations.petition_national IS 'URL vers pétition nationale (Sénat, Assemblée...)';
COMMENT ON COLUMN public.consultations.petitions_metadata IS
  'Métadonnées des pétitions: {"local": {"title": "...", "platform": "Change.org"}, ...}';

-- ============================================================================
-- PARTIE 3: TABLE CONSULTATION_RESPONSES
-- Réponses individuelles aux consultations (schéma flexible)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.consultation_responses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),

  -- Lien vers la consultation
  consultation_id uuid NOT NULL,

  -- Répondant (optionnel - consultations anonymes possibles)
  user_id uuid,
  session_id text,                      -- Pour limiter les doublons anonymes

  -- Réponses (schéma flexible JSONB)
  responses jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Validation et versioning
  schema_version integer NOT NULL DEFAULT 1,
  is_complete boolean NOT NULL DEFAULT false,

  -- Métadonnées de traçabilité (RGPD-compatible)
  ip_hash text,
  user_agent_category text,
  source text DEFAULT 'web',

  -- Timestamps
  started_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),

  -- ========================================
  -- Champs de synchronisation (fédération)
  -- ========================================

  -- Statut de synchronisation
  sync_status text DEFAULT 'pending',

  -- Date de synchronisation
  synced_at timestamp with time zone,

  -- ID de la réponse sur l'instance source (après sync)
  source_response_id uuid,

  -- Nombre de tentatives de sync
  sync_attempts integer NOT NULL DEFAULT 0,

  -- Dernière erreur de sync
  sync_error text,

  CONSTRAINT consultation_responses_pkey PRIMARY KEY (id),
  CONSTRAINT consultation_responses_consultation_id_fkey
    FOREIGN KEY (consultation_id) REFERENCES public.consultations(id) ON DELETE CASCADE,
  CONSTRAINT consultation_responses_sync_status_check
    CHECK (sync_status IN ('pending', 'synced', 'failed', 'not_applicable'))
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_consultation_responses_consultation
  ON public.consultation_responses(consultation_id);
CREATE INDEX IF NOT EXISTS idx_consultation_responses_user
  ON public.consultation_responses(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_consultation_responses_session
  ON public.consultation_responses(consultation_id, session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_consultation_responses_sync_status
  ON public.consultation_responses(sync_status) WHERE sync_status = 'pending';

-- Index GIN pour les recherches dans les réponses JSONB
CREATE INDEX IF NOT EXISTS idx_consultation_responses_data
  ON public.consultation_responses USING GIN (responses);

-- Contraintes UNIQUE pour éviter les doublons
CREATE UNIQUE INDEX IF NOT EXISTS idx_consultation_responses_unique_session
  ON public.consultation_responses(consultation_id, session_id)
  WHERE session_id IS NOT NULL AND user_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_consultation_responses_unique_user
  ON public.consultation_responses(consultation_id, user_id)
  WHERE user_id IS NOT NULL;

COMMENT ON TABLE public.consultation_responses IS
  'Réponses aux consultations (schéma flexible JSONB)';
COMMENT ON COLUMN public.consultation_responses.sync_status IS
  'Statut sync: pending (à synchroniser), synced (ok), failed (échec), not_applicable (consultation locale)';

-- ============================================================================
-- PARTIE 4: TABLE FEDERATION_REGISTRY
-- Registre des instances connues dans le réseau fédéré
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.federation_registry (
  id uuid NOT NULL DEFAULT gen_random_uuid(),

  -- Identification de l'instance
  instance_url text NOT NULL UNIQUE,
  instance_name text NOT NULL,
  instance_type text NOT NULL DEFAULT 'commune',

  -- Métadonnées géographiques
  commune_name text,
  commune_insee text,
  region_name text,
  region_code text,

  -- Configuration
  api_endpoint text,
  api_key_hash text,                    -- Hash de la clé API (pas la clé en clair)
  is_hub boolean NOT NULL DEFAULT false, -- Instance hub régional/national

  -- Statut
  status text NOT NULL DEFAULT 'pending',
  verified_at timestamp with time zone,
  last_seen_at timestamp with time zone,

  -- Métadonnées
  federation_config jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT federation_registry_pkey PRIMARY KEY (id),
  CONSTRAINT federation_registry_type_check CHECK (instance_type IN ('commune', 'region', 'national', 'custom')),
  CONSTRAINT federation_registry_status_check CHECK (status IN ('pending', 'active', 'suspended', 'revoked'))
);

-- Index
CREATE INDEX IF NOT EXISTS idx_federation_registry_status ON public.federation_registry(status);
CREATE INDEX IF NOT EXISTS idx_federation_registry_region ON public.federation_registry(region_code);
CREATE INDEX IF NOT EXISTS idx_federation_registry_hub ON public.federation_registry(is_hub) WHERE is_hub = true;

COMMENT ON TABLE public.federation_registry IS
  'Registre des instances participantes au réseau fédéré de consultations citoyennes';

-- ============================================================================
-- PARTIE 5: TABLE CONSULTATION_IMPORTS
-- Journal des imports de consultations
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.consultation_imports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),

  -- Consultation locale créée par l'import
  local_consultation_id uuid NOT NULL,

  -- Source
  source_instance text NOT NULL,
  source_consultation_id uuid NOT NULL,
  source_slug text NOT NULL,

  -- Métadonnées d'import
  imported_at timestamp with time zone NOT NULL DEFAULT now(),
  imported_by uuid,

  -- Configuration d'import
  auto_sync boolean NOT NULL DEFAULT true,
  sync_interval_hours integer DEFAULT 1,

  -- Statut
  status text NOT NULL DEFAULT 'active',
  last_check_at timestamp with time zone,

  CONSTRAINT consultation_imports_pkey PRIMARY KEY (id),
  CONSTRAINT consultation_imports_local_fkey
    FOREIGN KEY (local_consultation_id) REFERENCES public.consultations(id) ON DELETE CASCADE,
  CONSTRAINT consultation_imports_status_check CHECK (status IN ('active', 'paused', 'revoked'))
);

CREATE INDEX IF NOT EXISTS idx_consultation_imports_local
  ON public.consultation_imports(local_consultation_id);
CREATE INDEX IF NOT EXISTS idx_consultation_imports_source
  ON public.consultation_imports(source_instance, source_consultation_id);

COMMENT ON TABLE public.consultation_imports IS
  'Journal des consultations importées depuis d''autres instances';

-- ============================================================================
-- PARTIE 6: ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Activer RLS sur toutes les tables
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultation_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.federation_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultation_imports ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------
-- Policies pour CONSULTATIONS
-- ----------------------------------------

-- Lecture publique pour les consultations actives/fermées
DROP POLICY IF EXISTS "Public can view consultations" ON public.consultations;
CREATE POLICY "Public can view consultations" ON public.consultations
  FOR SELECT USING (status IN ('active', 'closed'));

-- Modification par les admins et modérateurs
DROP POLICY IF EXISTS "Admins can manage consultations" ON public.consultations;
CREATE POLICY "Admins can manage consultations" ON public.consultations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

-- ----------------------------------------
-- Policies pour CONSULTATION_RESPONSES
-- ----------------------------------------

-- Tout le monde peut soumettre des réponses
DROP POLICY IF EXISTS "Anyone can submit responses" ON public.consultation_responses;
CREATE POLICY "Anyone can submit responses" ON public.consultation_responses
  FOR INSERT WITH CHECK (true);

-- Lecture par propriétaire ou admin
DROP POLICY IF EXISTS "Users can view own responses" ON public.consultation_responses;
CREATE POLICY "Users can view own responses" ON public.consultation_responses
  FOR SELECT USING (
    user_id = auth.uid()
    OR user_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

-- ----------------------------------------
-- Policies pour FEDERATION_REGISTRY
-- ----------------------------------------

-- Lecture publique pour les instances actives
DROP POLICY IF EXISTS "Public can view federation registry" ON public.federation_registry;
CREATE POLICY "Public can view federation registry" ON public.federation_registry
  FOR SELECT USING (status = 'active');

-- Modification par les admins uniquement
DROP POLICY IF EXISTS "Admins can manage federation registry" ON public.federation_registry;
CREATE POLICY "Admins can manage federation registry" ON public.federation_registry
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ----------------------------------------
-- Policies pour CONSULTATION_IMPORTS
-- ----------------------------------------

-- Admins et modérateurs uniquement
DROP POLICY IF EXISTS "Admins can manage consultation imports" ON public.consultation_imports;
CREATE POLICY "Admins can manage consultation imports" ON public.consultation_imports
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

-- ============================================================================
-- PARTIE 7: DONNÉES INITIALES
-- ============================================================================

-- Consultation Quasquara (locale)
INSERT INTO public.consultations (slug, title, description, scope, schema, status, federation_config)
VALUES (
  'quasquara-2024',
  'Consultation citoyenne - L''affaire de Quasquara',
  'Consultation sur la démocratie locale à Corte et l''affaire de la croix de Quasquara',
  'local',
  '{
    "version": 1,
    "sections": [
      {
        "id": "quasquara",
        "title": "L''affaire de Quasquara",
        "questions": [
          {"id": "connaissanceQuasquara", "type": "radio", "options": ["Oui", "Non"]},
          {"id": "positionQuasquara", "type": "radio", "options": ["Maintien", "Retrait", "Sans", "NoAnswer"]},
          {"id": "quiDecide", "type": "radio", "options": ["Justice", "Élus locaux", "Référendum des habitants", "Autre"]}
        ]
      },
      {
        "id": "democratie",
        "title": "Démocratie locale",
        "questions": [
          {"id": "satisfactionDemocratie", "type": "scale", "min": 1, "max": 5},
          {"id": "declinVille", "type": "scale", "min": 1, "max": 5},
          {"id": "favorableReferendum", "type": "radio", "options": ["Oui", "Non", "Selon"]},
          {"id": "sujetsReferendum", "type": "checkbox", "options": ["urbanisme", "culture", "budget", "environnement", "patrimoine", "autre"]},
          {"id": "horaireConseil", "type": "radio", "options": ["Oui", "Non", "Je ne sais pas", "Je préfère ne pas répondre"]}
        ]
      },
      {
        "id": "profil",
        "title": "Profil",
        "optional": true,
        "questions": [
          {"id": "inscritListe", "type": "radio", "options": ["Oui", "Non", "Pas encore mais je compte le faire", "Je ne souhaite pas répondre"]},
          {"id": "quartier", "type": "text"},
          {"id": "age", "type": "select", "options": ["18-25", "26-40", "41-60", "60+"]},
          {"id": "dureeHabitation", "type": "select", "options": ["<1 an", "1-5 ans", "5-10 ans", ">10 ans", "toute ma vie"]}
        ]
      },
      {
        "id": "contact",
        "title": "Contact",
        "optional": true,
        "questions": [
          {"id": "commentaire", "type": "textarea"},
          {"id": "accepteContact", "type": "checkbox"},
          {"id": "email", "type": "email", "conditionalOn": "accepteContact"},
          {"id": "participationEtudeIA", "type": "checkbox"}
        ]
      }
    ]
  }'::jsonb,
  'active',
  '{"allow_import": false}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  scope = EXCLUDED.scope,
  federation_config = EXCLUDED.federation_config;

-- Consultation Démocratie Locale (nationale, fédérée)
INSERT INTO public.consultations (
  slug, title, description, scope, schema, status, federation_config,
  petition_national, petitions_metadata
)
VALUES (
  'democratie-locale-2024',
  'Baromètre de la démocratie locale',
  'Consultation nationale fédérée sur le fonctionnement démocratique des communes françaises. Les réponses locales alimentent une base nationale permettant de comparer les pratiques entre communes.',
  'national',
  '{
    "version": 1,
    "federated": true,
    "sections": [
      {
        "id": "connaissance",
        "title": "Connaissance de la vie locale",
        "questions": [
          {"id": "connaissanceEnjeuxLocaux", "type": "radio", "label": "Connaissez-vous les principaux enjeux de votre commune ?", "options": ["Très bien", "Assez bien", "Peu", "Pas du tout"]},
          {"id": "participationConseil", "type": "radio", "label": "Avez-vous déjà assisté à une séance du conseil municipal ?", "options": ["Oui, régulièrement", "Oui, occasionnellement", "Une fois", "Jamais"]},
          {"id": "suiviDeliberations", "type": "radio", "label": "Suivez-vous les délibérations de votre commune ?", "options": ["Oui, régulièrement", "Parfois", "Rarement", "Jamais"]}
        ]
      },
      {
        "id": "transparence",
        "title": "Transparence municipale",
        "questions": [
          {"id": "satisfactionTransparence", "type": "scale", "label": "Comment évaluez-vous la transparence de votre mairie ?", "min": 1, "max": 5},
          {"id": "accesInformation", "type": "radio", "label": "Trouvez-vous facilement les informations sur les décisions municipales ?", "options": ["Très facilement", "Assez facilement", "Difficilement", "Très difficilement"]},
          {"id": "qualiteCommunication", "type": "radio", "label": "Comment jugez-vous la communication de votre mairie ?", "options": ["Excellente", "Bonne", "Moyenne", "Insuffisante"]}
        ]
      },
      {
        "id": "participation",
        "title": "Participation citoyenne",
        "questions": [
          {"id": "satisfactionDemocratie", "type": "scale", "label": "Comment évaluez-vous le fonctionnement démocratique de votre commune ?", "min": 1, "max": 5},
          {"id": "sentimentEcoute", "type": "radio", "label": "Avez-vous le sentiment d''être écouté par vos élus ?", "options": ["Oui, tout à fait", "Plutôt oui", "Plutôt non", "Pas du tout"]},
          {"id": "opportunitesParticipation", "type": "radio", "label": "Y a-t-il suffisamment d''occasions de participer à la vie locale ?", "options": ["Oui, beaucoup", "Oui, quelques-unes", "Pas assez", "Aucune"]},
          {"id": "favorableReferendum", "type": "radio", "label": "Seriez-vous favorable à des référendums locaux ?", "options": ["Oui, sur tous les sujets", "Oui, sur certains sujets", "Non, pas nécessaire", "Sans avis"]}
        ]
      },
      {
        "id": "numerique",
        "title": "Services numériques",
        "questions": [
          {"id": "usageSiteWeb", "type": "radio", "label": "Utilisez-vous le site web de votre mairie ?", "options": ["Régulièrement", "Parfois", "Rarement", "Jamais", "Il n''y en a pas"]},
          {"id": "demarchesEnLigne", "type": "radio", "label": "Pouvez-vous faire vos démarches administratives en ligne ?", "options": ["Oui, toutes", "Oui, certaines", "Très peu", "Aucune"]},
          {"id": "ouvertureOpenData", "type": "radio", "label": "Savez-vous si votre commune publie des données ouvertes (open data) ?", "options": ["Oui, et je les consulte", "Oui, mais je ne les utilise pas", "Non", "Je ne sais pas"]}
        ]
      },
      {
        "id": "profil",
        "title": "Profil",
        "optional": true,
        "questions": [
          {"id": "tailleCommune", "type": "select", "label": "Taille de votre commune", "options": ["<1000 hab", "1000-5000 hab", "5000-20000 hab", "20000-100000 hab", ">100000 hab"]},
          {"id": "age", "type": "select", "label": "Tranche d''âge", "options": ["18-25", "26-40", "41-60", "60+"]},
          {"id": "dureeHabitation", "type": "select", "label": "Depuis combien de temps habitez-vous cette commune ?", "options": ["<1 an", "1-5 ans", "5-10 ans", ">10 ans", "Toute ma vie"]}
        ]
      }
    ]
  }'::jsonb,
  'active',
  '{
    "allow_import": true,
    "auto_sync": true,
    "sync_interval_hours": 1,
    "collect_commune_data": true,
    "anonymize_for_export": false
  }'::jsonb,
  'https://petitions.senat.fr/',
  '{"national": {"title": "Pétitions citoyennes au Sénat", "platform": "Sénat", "icon": "🏛️"}}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  scope = EXCLUDED.scope,
  federation_config = EXCLUDED.federation_config,
  petition_national = EXCLUDED.petition_national,
  petitions_metadata = EXCLUDED.petitions_metadata;

-- ============================================================================
-- PARTIE 8: MISE À JOUR DE L'ADMIN EXISTANT (optionnel)
-- Marquer l'utilisateur admin existant (basé sur l'email dans constants.js)
-- ============================================================================

-- Cette requête est commentée car l'email admin peut varier
-- Décommenter et adapter si nécessaire:
-- UPDATE public.users
-- SET role = 'admin'
-- WHERE id IN (
--   SELECT u.id FROM public.users u
--   JOIN auth.users au ON au.id = u.id
--   WHERE au.email = 'votre-email-admin@exemple.com'
-- );

-- ============================================================================
-- FIN DE LA MIGRATION
-- ============================================================================

-- Résumé des changements:
-- ✅ public.users.role (user | moderator | admin)
-- ✅ public.consultations (avec scope, fédération, pétitions)
-- ✅ public.consultation_responses (avec sync_status)
-- ✅ public.federation_registry
-- ✅ public.consultation_imports
-- ✅ RLS policies cohérentes avec le code JS
-- ✅ Données initiales (2 consultations)
