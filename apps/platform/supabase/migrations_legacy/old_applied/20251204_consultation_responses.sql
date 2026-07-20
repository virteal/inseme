-- Migration: Système flexible de stockage des réponses aux consultations citoyennes
-- Date: 2025-12-04
-- Description: Tables simples pour stocker les consultations et réponses
--              Logique métier gérée côté JavaScript (pas de triggers/fonctions PL/pgSQL)

-- ============================================================================
-- TABLE: consultations
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

  CONSTRAINT consultations_pkey PRIMARY KEY (id),
  CONSTRAINT consultations_status_check CHECK (status IN ('draft', 'active', 'closed', 'archived'))
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_consultations_slug ON public.consultations(slug);
CREATE INDEX IF NOT EXISTS idx_consultations_status ON public.consultations(status);

-- ============================================================================
-- TABLE: consultation_responses
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

  CONSTRAINT consultation_responses_pkey PRIMARY KEY (id),
  CONSTRAINT consultation_responses_consultation_id_fkey
    FOREIGN KEY (consultation_id) REFERENCES public.consultations(id) ON DELETE CASCADE
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_consultation_responses_consultation
  ON public.consultation_responses(consultation_id);
CREATE INDEX IF NOT EXISTS idx_consultation_responses_user
  ON public.consultation_responses(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_consultation_responses_session
  ON public.consultation_responses(consultation_id, session_id) WHERE session_id IS NOT NULL;

-- Index GIN pour les recherches dans les réponses JSONB
CREATE INDEX IF NOT EXISTS idx_consultation_responses_data
  ON public.consultation_responses USING GIN (responses);

-- Contraintes UNIQUE pour éviter les doublons (gérées par la DB, détectées côté JS)
CREATE UNIQUE INDEX IF NOT EXISTS idx_consultation_responses_unique_session
  ON public.consultation_responses(consultation_id, session_id)
  WHERE session_id IS NOT NULL AND user_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_consultation_responses_unique_user
  ON public.consultation_responses(consultation_id, user_id)
  WHERE user_id IS NOT NULL;

-- ============================================================================
-- RLS (Row Level Security) - Règles simples
-- ============================================================================

ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultation_responses ENABLE ROW LEVEL SECURITY;

-- Consultations: lecture publique pour les actives/fermées
DROP POLICY IF EXISTS "Public can view consultations" ON public.consultations;
CREATE POLICY "Public can view consultations" ON public.consultations
  FOR SELECT USING (status IN ('active', 'closed'));

-- Consultations: modification par les admins
DROP POLICY IF EXISTS "Admins can manage consultations" ON public.consultations;
CREATE POLICY "Admins can manage consultations" ON public.consultations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

-- Réponses: tout le monde peut soumettre
DROP POLICY IF EXISTS "Anyone can submit responses" ON public.consultation_responses;
CREATE POLICY "Anyone can submit responses" ON public.consultation_responses
  FOR INSERT WITH CHECK (true);

-- Réponses: lecture par propriétaire ou admin
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

-- ============================================================================
-- DONNÉES INITIALES: Consultation Quasquara
-- ============================================================================

INSERT INTO public.consultations (slug, title, description, schema, status)
VALUES (
  'quasquara-2024',
  'Consultation citoyenne - L''affaire de Quasquara',
  'Consultation sur la démocratie locale à Corte et l''affaire de la croix de Quasquara',
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
  'active'
)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- DONNÉES INITIALES: Consultation Démocratie Locale Nationale
-- ============================================================================

INSERT INTO public.consultations (slug, title, description, schema, status)
VALUES (
  'democratie-locale-2024',
  'Baromètre de la démocratie locale',
  'Consultation nationale fédérée sur le fonctionnement démocratique des communes françaises. Les réponses locales alimentent une base nationale permettant de comparer les pratiques entre communes.',
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
  'active'
)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- COMMENTAIRES
-- ============================================================================

COMMENT ON TABLE public.consultations IS 'Registre des consultations citoyennes';
COMMENT ON TABLE public.consultation_responses IS 'Réponses aux consultations (schéma flexible JSONB)';
