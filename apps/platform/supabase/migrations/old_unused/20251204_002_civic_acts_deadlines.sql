-- ============================================================================
-- Migration: Civic Acts Control System - Phase 2: Legal Status & Deadlines
-- Description: Legal status registry, deadline templates, teletransmission,
--              recours, and automatic status management
-- Version: 1.0.0
-- Date: 2025-12-04
-- Depends on: 20251204_001_civic_acts_core.sql
-- ============================================================================

-- ============================================================================
-- SECTION 1: ADDITIONAL ENUMS
-- ============================================================================

-- Legal status codes (comprehensive list for French administrative law)
CREATE TYPE legal_status_code AS ENUM (
  -- Acte statuses
  'NON_EXECUTOIRE',       -- Not yet executable (before transmission)
  'EXECUTOIRE',           -- Executable (after proper transmission)
  'SUSPENDU',             -- Suspended (e.g., by court order)
  'ANNULE',               -- Annulled by court or withdrawn
  'ABROGE',               -- Repealed/superseded
  'CADUC',                -- Lapsed (deadline passed without action)

  -- Demande statuses
  'REFUS_IMPLICITE',      -- Implicit refusal (silence after deadline)
  'SILENCE_VAUT_ACCEPTATION', -- Silence = acceptance (rare cases)
  'IRRECEVABLE',          -- Request deemed inadmissible

  -- Recours statuses
  'RECOURS_PENDANT',      -- Appeal pending
  'DECISION_FAVORABLE',   -- Favorable decision
  'DECISION_DEFAVORABLE', -- Unfavorable decision
  'DECISION_MIXTE',       -- Partial success
  'DESISTEMENT',          -- Withdrawal
  'NON_LIEU'              -- No grounds for decision
);

-- Deadline trigger events
CREATE TYPE deadline_trigger AS ENUM (
  'DATE_ACTE',
  'DATE_SEANCE',
  'DATE_ENVOI',
  'DATE_RECEPTION',
  'DATE_REFUS',
  'DATE_NOTIFICATION',
  'DATE_PUBLICATION',
  'DATE_SIGNATURE'
);

-- Delay calculation types
CREATE TYPE delay_type AS ENUM (
  'JOURS_CALENDAIRES',
  'JOURS_OUVRES',
  'JOURS_FRANCS',
  'MOIS',
  'ANNEES'
);

-- Deadline status
CREATE TYPE deadline_status AS ENUM (
  'OUVERTE',
  'RESPECTEE',
  'DEPASSEE',
  'ANNULEE'
);

-- Teletransmission technical status
CREATE TYPE teletransmission_status AS ENUM (
  'RECU',
  'REJETE',
  'INCOMPLET',
  'EN_COURS',
  'INCONNU'
);

-- Recours types
CREATE TYPE recours_type AS ENUM (
  'CADA',         -- Saisine CADA
  'GRACIEUX',     -- Recours gracieux
  'HIERARCHIQUE', -- Recours hiérarchique
  'TA',           -- Tribunal Administratif
  'CAA',          -- Cour Administrative d'Appel
  'CE'            -- Conseil d'État
);

-- Recours status
CREATE TYPE recours_status AS ENUM (
  'EN_PREPARATION',
  'ENVOYE',
  'EN_COURS',
  'INSTRUCTION',
  'AUDIENCE',
  'AVIS_RENDU',
  'JUGEMENT_RENDU',
  'CLOS'
);

-- Recours outcome
CREATE TYPE recours_issue AS ENUM (
  'FAVORABLE',
  'DEFAVORABLE',
  'MIXTE',
  'DESISTEMENT',
  'SANS_OBJET',
  'IRRECEVABLE',
  'NON_LIEU'
);

-- ============================================================================
-- SECTION 2: LEGAL STATUS REGISTRY (Reference data)
-- ============================================================================

CREATE TABLE public.legal_status_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type civic_entity_type NOT NULL,
  status_code legal_status_code NOT NULL,
  libelle text NOT NULL, -- Human-readable label
  base_legale text, -- Legal reference (e.g., "L2131-1 CGCT")
  effets_juridiques text, -- Description of legal effects
  delay_trigger boolean NOT NULL DEFAULT false, -- Can this status arise from deadline expiry?

  metadata jsonb NOT NULL DEFAULT '{"schemaVersion": 1}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT legal_status_registry_unique UNIQUE (entity_type, status_code)
);

CREATE INDEX idx_legal_status_registry_entity ON public.legal_status_registry(entity_type);
CREATE INDEX idx_legal_status_registry_trigger ON public.legal_status_registry(delay_trigger) WHERE delay_trigger = true;

COMMENT ON TABLE public.legal_status_registry IS 'Reference table of possible legal statuses with their legal basis';
COMMENT ON COLUMN public.legal_status_registry.delay_trigger IS 'True if this status can result from a deadline expiry';

-- ============================================================================
-- SECTION 3: LEGAL STATUS INSTANCE (Actual status of an entity)
-- ============================================================================

CREATE TABLE public.legal_status_instance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type civic_entity_type NOT NULL,
  entity_id uuid NOT NULL,
  status_code legal_status_code NOT NULL,

  -- Validity period
  date_debut date NOT NULL,
  date_fin date, -- NULL = still current

  -- Justification
  justification text,
  base_legale text, -- Specific legal reference for this instance

  -- Evidence
  proof_id uuid REFERENCES public.proof(id) ON DELETE SET NULL,

  -- Who/what created this status
  created_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_by_actor_type civic_actor_type NOT NULL DEFAULT 'HUMAIN',

  metadata jsonb NOT NULL DEFAULT '{"schemaVersion": 1}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_legal_status_entity ON public.legal_status_instance(entity_type, entity_id);
CREATE INDEX idx_legal_status_current ON public.legal_status_instance(entity_type, entity_id)
  WHERE date_fin IS NULL;
CREATE INDEX idx_legal_status_code ON public.legal_status_instance(status_code);
CREATE INDEX idx_legal_status_date ON public.legal_status_instance(date_debut DESC);

-- Trigger for updated_at
CREATE TRIGGER set_legal_status_instance_updated_at
  BEFORE UPDATE ON public.legal_status_instance
  FOR EACH ROW EXECUTE FUNCTION civic_set_updated_at();

COMMENT ON TABLE public.legal_status_instance IS 'Actual legal status instances for entities with temporal validity';
COMMENT ON COLUMN public.legal_status_instance.date_fin IS 'NULL means status is still current';

-- ============================================================================
-- SECTION 4: DEADLINE TEMPLATE (Reference for legal deadlines)
-- ============================================================================

CREATE TABLE public.deadline_template (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type civic_entity_type NOT NULL,
  code text NOT NULL, -- Unique code for this template
  libelle text NOT NULL, -- Human-readable name

  -- Trigger and calculation
  trigger_event deadline_trigger NOT NULL,
  delay_days integer NOT NULL CHECK (delay_days > 0),
  delay_type delay_type NOT NULL DEFAULT 'JOURS_CALENDAIRES',

  -- Legal reference
  base_legale text NOT NULL, -- e.g., "L2131-1 CGCT", "L232-4 CRPA"

  -- Expected action
  action_attendue text NOT NULL, -- What should happen
  action_responsable text, -- Who is responsible

  -- Consequence if deadline passes
  consequence_depassement legal_status_code, -- Status to apply if exceeded
  consequence_description text,

  -- Activation
  is_active boolean NOT NULL DEFAULT true,

  metadata jsonb NOT NULL DEFAULT '{"schemaVersion": 1}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT deadline_template_code_unique UNIQUE (entity_type, code)
);

CREATE INDEX idx_deadline_template_entity ON public.deadline_template(entity_type);
CREATE INDEX idx_deadline_template_active ON public.deadline_template(entity_type, is_active) WHERE is_active = true;

-- Trigger for updated_at
CREATE TRIGGER set_deadline_template_updated_at
  BEFORE UPDATE ON public.deadline_template
  FOR EACH ROW EXECUTE FUNCTION civic_set_updated_at();

COMMENT ON TABLE public.deadline_template IS 'Templates for legal deadlines with trigger conditions and consequences';

-- ============================================================================
-- SECTION 5: DEADLINE INSTANCE (Concrete deadline for an entity)
-- ============================================================================

CREATE TABLE public.deadline_instance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type civic_entity_type NOT NULL,
  entity_id uuid NOT NULL,
  template_id uuid NOT NULL REFERENCES public.deadline_template(id) ON DELETE RESTRICT,

  -- Dates
  start_date date NOT NULL,
  due_date date NOT NULL,

  -- Status
  status deadline_status NOT NULL DEFAULT 'OUVERTE',

  -- Closure info (when respected or exceeded)
  closed_at timestamptz,
  closed_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  closed_proof_id uuid REFERENCES public.proof(id) ON DELETE SET NULL,
  closed_reason text,

  -- Auto-generated status instance (if deadline exceeded and consequence applies)
  generated_status_id uuid REFERENCES public.legal_status_instance(id) ON DELETE SET NULL,

  metadata jsonb NOT NULL DEFAULT '{"schemaVersion": 1}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT deadline_instance_dates_valid CHECK (due_date >= start_date),
  CONSTRAINT deadline_instance_closed_coherent CHECK (
    (status = 'OUVERTE' AND closed_at IS NULL)
    OR (status != 'OUVERTE' AND closed_at IS NOT NULL)
  )
);

-- Indexes
CREATE INDEX idx_deadline_instance_entity ON public.deadline_instance(entity_type, entity_id);
CREATE INDEX idx_deadline_instance_status ON public.deadline_instance(status);
CREATE INDEX idx_deadline_instance_due ON public.deadline_instance(due_date) WHERE status = 'OUVERTE';
-- Note: Cannot use CURRENT_DATE in partial index predicate (must be IMMUTABLE)
-- Overdue filtering is done at query time using the idx_deadline_instance_due index
CREATE INDEX idx_deadline_instance_due_status ON public.deadline_instance(due_date, status);

-- Trigger for updated_at
CREATE TRIGGER set_deadline_instance_updated_at
  BEFORE UPDATE ON public.deadline_instance
  FOR EACH ROW EXECUTE FUNCTION civic_set_updated_at();

COMMENT ON TABLE public.deadline_instance IS 'Concrete deadline instances with tracking and automatic status generation';

-- ============================================================================
-- SECTION 6: TELETRANSMISSION (Transmission to prefecture)
-- ============================================================================

CREATE TABLE public.teletransmission (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acte_id uuid NOT NULL REFERENCES public.acte(id) ON DELETE RESTRICT,

  -- Declared by administration (unverified)
  date_declared date,
  heure_declared time,

  -- Confirmed by proof (AR @CTES)
  date_confirmed date,
  heure_confirmed time,
  proof_id_ar_ctes uuid REFERENCES public.proof(id) ON DELETE SET NULL,

  -- @CTES reference
  numero_ctes text,

  -- Technical status
  statut_technique teletransmission_status NOT NULL DEFAULT 'INCONNU',

  -- Rejection details (if applicable)
  motif_rejet text,

  metadata jsonb NOT NULL DEFAULT '{"schemaVersion": 1}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT teletransmission_acte_unique UNIQUE (acte_id),
  CONSTRAINT teletransmission_confirmed_requires_proof CHECK (
    (date_confirmed IS NULL AND proof_id_ar_ctes IS NULL)
    OR (date_confirmed IS NOT NULL AND proof_id_ar_ctes IS NOT NULL)
  )
);

CREATE INDEX idx_teletransmission_acte ON public.teletransmission(acte_id);
CREATE INDEX idx_teletransmission_status ON public.teletransmission(statut_technique);
CREATE INDEX idx_teletransmission_unconfirmed ON public.teletransmission(date_declared)
  WHERE date_confirmed IS NULL AND date_declared IS NOT NULL;

-- Trigger for updated_at
CREATE TRIGGER set_teletransmission_updated_at
  BEFORE UPDATE ON public.teletransmission
  FOR EACH ROW EXECUTE FUNCTION civic_set_updated_at();

COMMENT ON TABLE public.teletransmission IS 'Transmission records to prefecture with declared/confirmed separation';
COMMENT ON COLUMN public.teletransmission.date_declared IS 'Date claimed by administration (unverified)';
COMMENT ON COLUMN public.teletransmission.date_confirmed IS 'Date confirmed by AR @CTES proof';

-- ============================================================================
-- SECTION 7: RECOURS (Legal appeals)
-- ============================================================================

CREATE TABLE public.recours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collectivite_id uuid NOT NULL REFERENCES public.collectivite(id) ON DELETE RESTRICT,

  -- Type
  type recours_type NOT NULL,

  -- Linked entities (at least one required)
  demande_id uuid REFERENCES public.demande_admin(id) ON DELETE SET NULL,
  acte_id uuid REFERENCES public.acte(id) ON DELETE SET NULL,

  -- Dates
  date_envoi date,
  date_reception_ack date, -- Acknowledgement of receipt
  date_instruction date, -- Start of investigation
  date_audience date, -- Hearing date (for TA/CAA/CE)
  date_decision date, -- Decision date

  -- Destination
  destinataire_org text NOT NULL,
  destinataire_adresse text,
  numero_dossier text, -- Case number at the court/authority

  -- Status
  status recours_status NOT NULL DEFAULT 'EN_PREPARATION',
  issue recours_issue,

  -- Content
  resume_objet text,
  moyens text, -- Legal arguments
  conclusions text, -- What we're asking for

  -- Proofs
  proof_id_envoi uuid REFERENCES public.proof(id) ON DELETE SET NULL,
  proof_id_decision uuid REFERENCES public.proof(id) ON DELETE SET NULL,

  metadata jsonb NOT NULL DEFAULT '{"schemaVersion": 1}'::jsonb,
  -- metadata.pieces_jointes: uuid[]
  -- metadata.delais_applicable: string
  -- metadata.rapporteur: string
  -- metadata.formation: string (for courts)

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.users(id),

  CONSTRAINT recours_has_target CHECK (demande_id IS NOT NULL OR acte_id IS NOT NULL),
  CONSTRAINT recours_issue_requires_status CHECK (
    issue IS NULL OR status IN ('AVIS_RENDU', 'JUGEMENT_RENDU', 'CLOS')
  )
);

-- Indexes
CREATE INDEX idx_recours_collectivite ON public.recours(collectivite_id);
CREATE INDEX idx_recours_type ON public.recours(type);
CREATE INDEX idx_recours_status ON public.recours(status);
CREATE INDEX idx_recours_demande ON public.recours(demande_id) WHERE demande_id IS NOT NULL;
CREATE INDEX idx_recours_acte ON public.recours(acte_id) WHERE acte_id IS NOT NULL;
CREATE INDEX idx_recours_pending ON public.recours(date_envoi)
  WHERE status IN ('ENVOYE', 'EN_COURS', 'INSTRUCTION');

-- Trigger for updated_at
CREATE TRIGGER set_recours_updated_at
  BEFORE UPDATE ON public.recours
  FOR EACH ROW EXECUTE FUNCTION civic_set_updated_at();

COMMENT ON TABLE public.recours IS 'Legal appeals (CADA, TA, etc.) with full lifecycle tracking';

-- ============================================================================
-- SECTION 8: REFERENCE DATA - Legal Status Registry
-- ============================================================================

INSERT INTO public.legal_status_registry (entity_type, status_code, libelle, base_legale, effets_juridiques, delay_trigger) VALUES
-- Acte statuses
('ACTE', 'NON_EXECUTOIRE', 'Non exécutoire', 'L2131-1 CGCT', 'L''acte ne peut être mis en application. Tout acte pris en méconnaissance est nul.', false),
('ACTE', 'EXECUTOIRE', 'Exécutoire', 'L2131-1 CGCT', 'L''acte peut être légalement appliqué après transmission et publicité.', false),
('ACTE', 'SUSPENDU', 'Suspendu', 'L2131-6 CGCT', 'L''exécution de l''acte est temporairement interdite par décision de justice.', false),
('ACTE', 'ANNULE', 'Annulé', 'L2131-6 CGCT', 'L''acte est réputé n''avoir jamais existé. Effets rétroactifs.', false),
('ACTE', 'ABROGE', 'Abrogé', 'L243-2 CRPA', 'L''acte cesse de produire effet pour l''avenir.', false),
('ACTE', 'CADUC', 'Caduc', 'Jurisprudence', 'L''acte a perdu son objet ou sa validité par écoulement du temps.', true),

-- Demande statuses
('DEMANDE', 'REFUS_IMPLICITE', 'Refus implicite', 'L232-4 CRPA', 'Le silence gardé pendant 1 mois vaut décision de rejet. Ouvre droit à recours.', true),
('DEMANDE', 'SILENCE_VAUT_ACCEPTATION', 'Silence vaut acceptation', 'L231-1 CRPA', 'Le silence gardé pendant 2 mois vaut accord (cas limitativement énumérés).', true),
('DEMANDE', 'IRRECEVABLE', 'Irrecevable', 'CRPA', 'La demande ne remplit pas les conditions de recevabilité.', false),

-- Recours statuses
('RECOURS', 'RECOURS_PENDANT', 'Recours pendant', 'CJA', 'Un recours contentieux est en cours d''examen.', false),
('RECOURS', 'DECISION_FAVORABLE', 'Décision favorable', 'CJA', 'Le recours a abouti favorablement.', false),
('RECOURS', 'DECISION_DEFAVORABLE', 'Décision défavorable', 'CJA', 'Le recours a été rejeté.', false),
('RECOURS', 'DECISION_MIXTE', 'Décision mixte', 'CJA', 'Le recours a abouti partiellement.', false),
('RECOURS', 'DESISTEMENT', 'Désistement', 'CJA', 'Le requérant a renoncé à son recours.', false),
('RECOURS', 'NON_LIEU', 'Non-lieu à statuer', 'CJA', 'Le recours est devenu sans objet.', false);

-- ============================================================================
-- SECTION 9: REFERENCE DATA - Deadline Templates
-- ============================================================================

INSERT INTO public.deadline_template (
  entity_type, code, libelle, trigger_event, delay_days, delay_type,
  base_legale, action_attendue, action_responsable,
  consequence_depassement, consequence_description
) VALUES
-- Acte deadlines
('ACTE', 'TRANSMISSION_PREFECTURE', 'Transmission à la préfecture',
 'DATE_ACTE', 15, 'JOURS_CALENDAIRES',
 'L2131-1 CGCT', 'Télétransmission de l''acte au contrôle de légalité', 'Mairie',
 NULL, 'L''acte reste non exécutoire tant que non transmis'),

('ACTE', 'PUBLICITE_AFFICHAGE', 'Affichage en mairie',
 'DATE_ACTE', 8, 'JOURS_CALENDAIRES',
 'L2131-1 CGCT', 'Affichage de l''acte ou mention au registre', 'Mairie',
 NULL, 'Défaut de publicité'),

('ACTE', 'CONTROLE_LEGALITE', 'Délai de contrôle de légalité',
 'DATE_ACTE', 60, 'JOURS_CALENDAIRES',
 'L2131-6 CGCT', 'Délai pendant lequel le préfet peut déférer l''acte', 'Préfecture',
 NULL, 'Au-delà, le préfet ne peut plus déférer l''acte'),

-- Demande deadlines
('DEMANDE', 'REPONSE_CRPA', 'Réponse à demande CRPA',
 'DATE_RECEPTION', 30, 'JOURS_CALENDAIRES',
 'L232-4 CRPA', 'Réponse à la demande de communication de documents', 'Administration destinataire',
 'REFUS_IMPLICITE', 'Naissance d''un refus implicite ouvrant droit à saisine CADA'),

('DEMANDE', 'REPONSE_CRPA_COMPLEXE', 'Réponse à demande CRPA complexe',
 'DATE_RECEPTION', 60, 'JOURS_CALENDAIRES',
 'L232-4 CRPA', 'Réponse à demande nécessitant recherches approfondies', 'Administration destinataire',
 'REFUS_IMPLICITE', 'Extension exceptionnelle du délai'),

-- CADA deadlines
('RECOURS', 'SAISINE_CADA', 'Délai de saisine CADA',
 'DATE_REFUS', 60, 'JOURS_CALENDAIRES',
 'L342-1 CRPA', 'Saisine de la CADA après refus explicite ou implicite', 'Demandeur',
 NULL, 'Forclusion du droit à saisir la CADA'),

('RECOURS', 'AVIS_CADA', 'Délai d''avis CADA',
 'DATE_ENVOI', 30, 'JOURS_CALENDAIRES',
 'R343-3 CRPA', 'Notification de l''avis par la CADA', 'CADA',
 NULL, 'La CADA peut demander une prolongation'),

-- TA deadlines
('RECOURS', 'RECOURS_TA', 'Délai de recours au TA',
 'DATE_NOTIFICATION', 60, 'JOURS_CALENDAIRES',
 'R421-1 CJA', 'Dépôt de la requête au Tribunal Administratif', 'Requérant',
 NULL, 'Forclusion du droit de recours contentieux'),

('RECOURS', 'MEMOIRE_COMPLEMENTAIRE', 'Mémoire complémentaire',
 'DATE_ENVOI', 30, 'JOURS_CALENDAIRES',
 'R411-1 CJA', 'Dépôt du mémoire complémentaire', 'Requérant',
 NULL, 'Le mémoire tardif peut être écarté'),

-- Teletransmission special
('TELETRANSMISSION', 'AR_CTES', 'Accusé réception @CTES',
 'DATE_ENVOI', 3, 'JOURS_OUVRES',
 'Arrêté NOR INTB2423603A', 'Réception de l''AR par la préfecture via @CTES', 'Préfecture',
 NULL, 'Absence d''AR peut indiquer un problème de transmission');

-- ============================================================================
-- SECTION 10: FUNCTIONS FOR DEADLINE MANAGEMENT
-- ============================================================================

-- Function to calculate due date based on delay type
CREATE OR REPLACE FUNCTION calculate_due_date(
  p_start_date date,
  p_delay_days integer,
  p_delay_type delay_type
) RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_due_date date;
  v_days_added integer := 0;
  v_current_date date := p_start_date;
BEGIN
  CASE p_delay_type
    WHEN 'JOURS_CALENDAIRES' THEN
      v_due_date := p_start_date + p_delay_days;

    WHEN 'JOURS_FRANCS' THEN
      -- Jours francs: exclude start and end day
      v_due_date := p_start_date + p_delay_days + 1;

    WHEN 'JOURS_OUVRES' THEN
      -- Working days (Mon-Fri, excluding French holidays would need a holiday table)
      WHILE v_days_added < p_delay_days LOOP
        v_current_date := v_current_date + 1;
        IF EXTRACT(DOW FROM v_current_date) NOT IN (0, 6) THEN
          v_days_added := v_days_added + 1;
        END IF;
      END LOOP;
      v_due_date := v_current_date;

    WHEN 'MOIS' THEN
      v_due_date := p_start_date + (p_delay_days || ' months')::interval;

    WHEN 'ANNEES' THEN
      v_due_date := p_start_date + (p_delay_days || ' years')::interval;

    ELSE
      v_due_date := p_start_date + p_delay_days;
  END CASE;

  RETURN v_due_date;
END;
$$;

COMMENT ON FUNCTION calculate_due_date IS 'Calculates due date based on delay type (calendar days, working days, etc.)';

-- Function to create deadline instances for a new acte
CREATE OR REPLACE FUNCTION create_acte_deadlines(p_acte_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_acte record;
  v_template record;
  v_count integer := 0;
  v_start_date date;
  v_due_date date;
BEGIN
  -- Get acte info
  SELECT * INTO v_acte FROM public.acte WHERE id = p_acte_id AND valid_to IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acte % not found or superseded', p_acte_id;
  END IF;

  -- Create deadlines for each applicable template
  FOR v_template IN
    SELECT * FROM public.deadline_template
    WHERE entity_type = 'ACTE' AND is_active = true
  LOOP
    -- Determine start date based on trigger event
    CASE v_template.trigger_event
      WHEN 'DATE_ACTE' THEN
        v_start_date := v_acte.date_acte;
      WHEN 'DATE_SEANCE' THEN
        v_start_date := COALESCE(v_acte.date_seance, v_acte.date_acte);
      ELSE
        v_start_date := v_acte.date_acte;
    END CASE;

    -- Calculate due date
    v_due_date := calculate_due_date(v_start_date, v_template.delay_days, v_template.delay_type);

    -- Insert deadline instance
    INSERT INTO public.deadline_instance (
      entity_type, entity_id, template_id,
      start_date, due_date, status
    ) VALUES (
      'ACTE', p_acte_id, v_template.id,
      v_start_date, v_due_date, 'OUVERTE'
    ) ON CONFLICT DO NOTHING;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION create_acte_deadlines IS 'Creates deadline instances for a new acte based on active templates';

-- Function to create deadline instances for a demande
CREATE OR REPLACE FUNCTION create_demande_deadlines(p_demande_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_demande record;
  v_template record;
  v_count integer := 0;
  v_start_date date;
  v_due_date date;
BEGIN
  SELECT * INTO v_demande FROM public.demande_admin WHERE id = p_demande_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demande % not found', p_demande_id;
  END IF;

  FOR v_template IN
    SELECT * FROM public.deadline_template
    WHERE entity_type = 'DEMANDE' AND is_active = true
  LOOP
    CASE v_template.trigger_event
      WHEN 'DATE_ENVOI' THEN
        v_start_date := v_demande.date_envoi;
      WHEN 'DATE_RECEPTION' THEN
        -- Assume reception = envoi + 2 days for LRAR
        v_start_date := v_demande.date_envoi + 2;
      ELSE
        v_start_date := v_demande.date_envoi;
    END CASE;

    v_due_date := calculate_due_date(v_start_date, v_template.delay_days, v_template.delay_type);

    INSERT INTO public.deadline_instance (
      entity_type, entity_id, template_id,
      start_date, due_date, status
    ) VALUES (
      'DEMANDE', p_demande_id, v_template.id,
      v_start_date, v_due_date, 'OUVERTE'
    ) ON CONFLICT DO NOTHING;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION create_demande_deadlines IS 'Creates deadline instances for a new demande based on active templates';

-- Function to process overdue deadlines (to be called by cron)
CREATE OR REPLACE FUNCTION process_overdue_deadlines()
RETURNS TABLE(
  deadline_id uuid,
  entity_type civic_entity_type,
  entity_id uuid,
  status_created boolean,
  status_code legal_status_code
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deadline record;
  v_template record;
  v_status_id uuid;
BEGIN
  FOR v_deadline IN
    SELECT di.*, dt.consequence_depassement, dt.consequence_description, dt.libelle
    FROM public.deadline_instance di
    JOIN public.deadline_template dt ON di.template_id = dt.id
    WHERE di.status = 'OUVERTE'
      AND di.due_date < CURRENT_DATE
  LOOP
    -- Mark deadline as exceeded
    UPDATE public.deadline_instance
    SET status = 'DEPASSEE',
        closed_at = now(),
        closed_reason = 'Délai dépassé automatiquement'
    WHERE id = v_deadline.id;

    -- Create legal status instance if consequence defined
    IF v_deadline.consequence_depassement IS NOT NULL THEN
      INSERT INTO public.legal_status_instance (
        entity_type, entity_id, status_code,
        date_debut, justification,
        created_by_actor_type
      ) VALUES (
        v_deadline.entity_type,
        v_deadline.entity_id,
        v_deadline.consequence_depassement,
        v_deadline.due_date,
        format('Statut généré automatiquement suite au dépassement du délai "%s" (échéance: %s)',
               v_deadline.libelle, v_deadline.due_date),
        'CRON'
      ) RETURNING id INTO v_status_id;

      -- Link the status to the deadline
      UPDATE public.deadline_instance
      SET generated_status_id = v_status_id
      WHERE id = v_deadline.id;

      -- Update demande status if applicable
      IF v_deadline.entity_type = 'DEMANDE' AND v_deadline.consequence_depassement = 'REFUS_IMPLICITE' THEN
        UPDATE public.demande_admin
        SET status = 'REFUS_IMPLICITE',
            updated_at = now()
        WHERE id = v_deadline.entity_id
          AND status = 'EN_ATTENTE';
      END IF;

      -- Log in audit
      INSERT INTO public.civic_audit_log (
        actor_type, action, entity_type, entity_id, payload
      ) VALUES (
        'CRON', 'UPDATE', v_deadline.entity_type, v_deadline.entity_id,
        jsonb_build_object(
          'deadline_id', v_deadline.id,
          'deadline_exceeded', true,
          'status_created', v_deadline.consequence_depassement,
          'status_instance_id', v_status_id
        )
      );

      RETURN QUERY SELECT v_deadline.id, v_deadline.entity_type, v_deadline.entity_id, true, v_deadline.consequence_depassement;
    ELSE
      -- Log deadline exceeded without consequence
      INSERT INTO public.civic_audit_log (
        actor_type, action, entity_type, entity_id, payload
      ) VALUES (
        'CRON', 'UPDATE', v_deadline.entity_type, v_deadline.entity_id,
        jsonb_build_object(
          'deadline_id', v_deadline.id,
          'deadline_exceeded', true,
          'status_created', false
        )
      );

      RETURN QUERY SELECT v_deadline.id, v_deadline.entity_type, v_deadline.entity_id, false, NULL::legal_status_code;
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION process_overdue_deadlines IS 'Processes all overdue deadlines, marking them exceeded and creating consequent legal statuses';

-- ============================================================================
-- SECTION 11: RLS POLICIES FOR NEW TABLES
-- ============================================================================

ALTER TABLE public.legal_status_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_status_instance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deadline_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deadline_instance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teletransmission ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recours ENABLE ROW LEVEL SECURITY;

-- Legal status registry: public read
CREATE POLICY legal_status_registry_select ON public.legal_status_registry
  FOR SELECT USING (true);

CREATE POLICY legal_status_registry_admin ON public.legal_status_registry
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.civic_user_profile
      WHERE id = auth.uid() AND role = 'ADMIN_SYSTEM'
    )
  );

-- Legal status instance: public read, admin write
CREATE POLICY legal_status_instance_select ON public.legal_status_instance
  FOR SELECT USING (true);

CREATE POLICY legal_status_instance_insert ON public.legal_status_instance
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.civic_user_profile
      WHERE id = auth.uid() AND role IN ('ADMIN_SYSTEM', 'LEGAL_REVIEWER')
    )
  );

CREATE POLICY legal_status_instance_update ON public.legal_status_instance
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.civic_user_profile
      WHERE id = auth.uid() AND role IN ('ADMIN_SYSTEM', 'LEGAL_REVIEWER')
    )
  );

-- Deadline template: public read
CREATE POLICY deadline_template_select ON public.deadline_template
  FOR SELECT USING (true);

CREATE POLICY deadline_template_admin ON public.deadline_template
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.civic_user_profile
      WHERE id = auth.uid() AND role = 'ADMIN_SYSTEM'
    )
  );

-- Deadline instance: public read, admin write
CREATE POLICY deadline_instance_select ON public.deadline_instance
  FOR SELECT USING (true);

CREATE POLICY deadline_instance_insert ON public.deadline_instance
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.civic_user_profile
      WHERE id = auth.uid() AND role IN ('ADMIN_SYSTEM', 'LEGAL_REVIEWER', 'CITIZEN_REVIEWER')
    )
  );

CREATE POLICY deadline_instance_update ON public.deadline_instance
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.civic_user_profile
      WHERE id = auth.uid() AND role IN ('ADMIN_SYSTEM', 'LEGAL_REVIEWER')
    )
  );

-- Teletransmission: public read, admin write
CREATE POLICY teletransmission_select ON public.teletransmission
  FOR SELECT USING (true);

CREATE POLICY teletransmission_insert ON public.teletransmission
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.civic_user_profile
      WHERE id = auth.uid() AND role IN ('ADMIN_SYSTEM', 'LEGAL_REVIEWER', 'CITIZEN_REVIEWER')
    )
  );

CREATE POLICY teletransmission_update ON public.teletransmission
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.civic_user_profile
      WHERE id = auth.uid() AND role IN ('ADMIN_SYSTEM', 'LEGAL_REVIEWER')
    )
  );

-- Recours: public read, admin write
CREATE POLICY recours_select ON public.recours
  FOR SELECT USING (true);

CREATE POLICY recours_insert ON public.recours
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.civic_user_profile
      WHERE id = auth.uid() AND role IN ('ADMIN_SYSTEM', 'LEGAL_REVIEWER')
    )
  );

CREATE POLICY recours_update ON public.recours
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.civic_user_profile
      WHERE id = auth.uid() AND role IN ('ADMIN_SYSTEM', 'LEGAL_REVIEWER')
    )
  );

-- ============================================================================
-- SECTION 12: HELPER VIEWS
-- ============================================================================

-- View: Overdue deadlines
CREATE VIEW public.v_deadlines_overdue AS
SELECT
  di.*,
  dt.libelle AS template_libelle,
  dt.base_legale,
  dt.consequence_depassement,
  dt.action_attendue,
  CURRENT_DATE - di.due_date AS days_overdue
FROM public.deadline_instance di
JOIN public.deadline_template dt ON di.template_id = dt.id
WHERE di.status = 'OUVERTE'
  AND di.due_date < CURRENT_DATE
ORDER BY di.due_date ASC;

COMMENT ON VIEW public.v_deadlines_overdue IS 'Deadlines that are past due and still open';

-- View: Upcoming deadlines (next 30 days)
CREATE VIEW public.v_deadlines_upcoming AS
SELECT
  di.*,
  dt.libelle AS template_libelle,
  dt.base_legale,
  dt.action_attendue,
  di.due_date - CURRENT_DATE AS days_remaining
FROM public.deadline_instance di
JOIN public.deadline_template dt ON di.template_id = dt.id
WHERE di.status = 'OUVERTE'
  AND di.due_date >= CURRENT_DATE
  AND di.due_date <= CURRENT_DATE + 30
ORDER BY di.due_date ASC;

COMMENT ON VIEW public.v_deadlines_upcoming IS 'Open deadlines due within the next 30 days';

-- View: Current legal status of entities
CREATE VIEW public.v_legal_status_current AS
SELECT DISTINCT ON (entity_type, entity_id)
  lsi.*,
  lsr.libelle,
  lsr.base_legale AS registry_base_legale,
  lsr.effets_juridiques
FROM public.legal_status_instance lsi
JOIN public.legal_status_registry lsr
  ON lsi.entity_type = lsr.entity_type AND lsi.status_code = lsr.status_code
WHERE lsi.date_fin IS NULL
ORDER BY entity_type, entity_id, lsi.date_debut DESC;

COMMENT ON VIEW public.v_legal_status_current IS 'Current (most recent active) legal status for each entity';

-- View: Transmission status summary
CREATE VIEW public.v_transmission_summary AS
SELECT
  c.id AS collectivite_id,
  c.nom_officiel AS collectivite,
  COUNT(a.id) AS total_actes,
  COUNT(t.id) FILTER (WHERE t.date_confirmed IS NOT NULL) AS transmis_confirmes,
  COUNT(t.id) FILTER (WHERE t.date_declared IS NOT NULL AND t.date_confirmed IS NULL) AS transmis_declares_non_confirmes,
  COUNT(a.id) FILTER (WHERE t.id IS NULL) AS non_transmis,
  COUNT(t.id) FILTER (WHERE t.statut_technique = 'REJETE') AS rejetes
FROM public.acte a
JOIN public.collectivite c ON a.collectivite_id = c.id
LEFT JOIN public.teletransmission t ON t.acte_id = a.id
WHERE a.valid_to IS NULL
GROUP BY c.id, c.nom_officiel;

COMMENT ON VIEW public.v_transmission_summary IS 'Summary statistics of act transmissions by collectivity';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
