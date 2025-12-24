-- ============================================================================
-- Migration: Civic Acts Control System - Phase 1: Core Schema
-- Description: Base tables for municipal acts tracking with versioning,
--              proofs, administrative requests, and role-based governance
-- Version: 1.0.0
-- Date: 2025-12-04
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- SECTION 1: ENUMS (Type-safe constraints)
-- ============================================================================

-- User roles for the civic acts system
CREATE TYPE civic_user_role AS ENUM (
  'ADMIN_SYSTEM',
  'CITIZEN_REVIEWER',
  'LEGAL_REVIEWER',
  'PUBLISHER',
  'TECH_ONLY'
);

-- User organisation types
CREATE TYPE civic_organisation AS ENUM (
  'CITOYEN',
  'COLLECTIF',
  'ASSO',
  'AVOCAT',
  'COLLECTIVITE',
  'PREFET',
  'JOURNALISTE',
  'AUTRE'
);

-- Collectivity types
CREATE TYPE collectivite_type AS ENUM (
  'COMMUNE',
  'EPCI',
  'DEPARTEMENT',
  'REGION',
  'SYNDICAT'
);

-- Municipal act types (French administrative law categories)
CREATE TYPE acte_type AS ENUM (
  'DEL',        -- Délibération
  'ARR',        -- Arrêté
  'BUD',        -- Budget / Décision modificative
  'MAR',        -- Marché public
  'URB',        -- Urbanisme (permis, PLU, etc.)
  'RH',         -- Ressources humaines
  'PATRIMONIAL',-- Cession, acquisition, bail
  'CONVENTION', -- Convention, avenant
  'SUBVENTION', -- Attribution de subvention
  'AUTRE'
);

-- Proof types
CREATE TYPE proof_type AS ENUM (
  'ACTE_PDF',       -- PDF de l'acte original
  'AR_CTES',        -- Accusé réception @CTES (préfecture)
  'AR_LRAR',        -- Accusé réception LRAR
  'REPONSE_MAIRIE', -- Réponse de la mairie
  'AVIS_CADA',      -- Avis de la CADA
  'JUGEMENT_TA',    -- Jugement du Tribunal Administratif
  'JUGEMENT_CE',    -- Arrêt du Conseil d'État
  'EMAIL',          -- Email avec entêtes
  'CAPTURE_WEB',    -- Capture d'écran horodatée
  'TELERECEPISSE',  -- Télérecépissé de dépôt
  'AUTRE'
);

-- Source organisations
CREATE TYPE source_org AS ENUM (
  'MAIRIE',
  'PREFECTURE',
  'CADA',
  'TA',
  'CE',
  'CITOYEN',
  'PRESSE',
  'AUTRE'
);

-- Probative force levels (legal weight of evidence)
CREATE TYPE probative_force AS ENUM (
  'FAIBLE',           -- Déclaration unilatérale, capture web
  'MOYENNE',          -- Document officiel sans AR
  'FORTE',            -- Document avec AR ou horodatage certifié
  'JURIDICTIONNELLE'  -- Décision de justice
);

-- Entity types for polymorphic relations
CREATE TYPE civic_entity_type AS ENUM (
  'ACTE',
  'DEMANDE',
  'RECOURS',
  'PUBLICATION',
  'TELETRANSMISSION'
);

-- Proof link roles
CREATE TYPE proof_role AS ENUM (
  'PIECE_PRINCIPALE',
  'ANNEXE',
  'ACCUSE_RECEPTION',
  'JUSTIFICATIF',
  'REFUTATION',
  'CONTEXTE'
);

-- Administrative request types
CREATE TYPE demande_type AS ENUM (
  'CRPA',         -- Demande CRPA (accès documents administratifs)
  'INFO',         -- Demande d'information simple
  'RECLAMATION',  -- Réclamation formelle
  'SIGNALEMENT',  -- Signalement d'anomalie
  'AUTRE'
);

-- Sending modes
CREATE TYPE mode_envoi AS ENUM (
  'MAIL',
  'LRAR',
  'DEPOT',
  'TELESERVICE',
  'FAX',
  'AUTRE'
);

-- Administrative request status
CREATE TYPE demande_status AS ENUM (
  'EN_ATTENTE',
  'REPONDU_PARTIEL',
  'REPONDU_COMPLET',
  'REFUS_EXPLICITE',
  'REFUS_IMPLICITE',
  'IRRECEVABLE',
  'CLOTURE'
);

-- Response types
CREATE TYPE reponse_type AS ENUM (
  'ACCES_TOTAL',
  'ACCES_PARTIEL',
  'REFUS_MOTIVE',
  'SILENCE',
  'INCOMPETENCE',
  'IRRECEVABILITE',
  'AUTRE'
);

-- ============================================================================
-- SECTION 2: USER PROFILE (Role-based access control)
-- ============================================================================

CREATE TABLE public.civic_user_profile (
  id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  role civic_user_role NOT NULL DEFAULT 'CITIZEN_REVIEWER',
  organisation civic_organisation NOT NULL DEFAULT 'CITOYEN',
  organisation_name text, -- Nom précis de l'organisation si applicable
  collectivite_id uuid, -- FK vers collectivite, pour filtrage multi-commune
  email_notifications boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{"schemaVersion": 1}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for role-based queries
CREATE INDEX idx_civic_user_profile_role ON public.civic_user_profile(role);
CREATE INDEX idx_civic_user_profile_collectivite ON public.civic_user_profile(collectivite_id) WHERE collectivite_id IS NOT NULL;

COMMENT ON TABLE public.civic_user_profile IS 'Extended user profile for civic acts system with role-based access control';
COMMENT ON COLUMN public.civic_user_profile.role IS 'User role determining permissions in the civic acts system';
COMMENT ON COLUMN public.civic_user_profile.collectivite_id IS 'Optional link to a collectivity for multi-commune RLS filtering';

-- ============================================================================
-- SECTION 3: COLLECTIVITE (Local authorities)
-- ============================================================================

CREATE TABLE public.collectivite (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type collectivite_type NOT NULL DEFAULT 'COMMUNE',
  code_insee text NOT NULL,
  nom_officiel text NOT NULL,
  nom_courant text, -- Nom usuel si différent
  departement text NOT NULL,
  region text NOT NULL,
  siren text, -- Numéro SIREN de la collectivité
  site_web text,
  email_contact text,
  date_activation_systeme date, -- Date d'activation du suivi
  population integer CHECK (population IS NULL OR population >= 0),
  metadata jsonb NOT NULL DEFAULT '{"schemaVersion": 1}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT collectivite_code_insee_unique UNIQUE (code_insee),
  CONSTRAINT collectivite_siren_unique UNIQUE (siren)
);

-- Indexes
CREATE INDEX idx_collectivite_type ON public.collectivite(type);
CREATE INDEX idx_collectivite_departement ON public.collectivite(departement);
CREATE INDEX idx_collectivite_nom ON public.collectivite(nom_officiel);

COMMENT ON TABLE public.collectivite IS 'Local authorities (communes, EPCI, etc.) tracked by the system';
COMMENT ON COLUMN public.collectivite.code_insee IS 'Official INSEE code for the collectivity';
COMMENT ON COLUMN public.collectivite.date_activation_systeme IS 'Date when tracking started for this collectivity';

-- Add FK constraint on civic_user_profile now that collectivite exists
ALTER TABLE public.civic_user_profile
  ADD CONSTRAINT civic_user_profile_collectivite_fkey
  FOREIGN KEY (collectivite_id) REFERENCES public.collectivite(id) ON DELETE SET NULL;

-- ============================================================================
-- SECTION 4: ACTE (Municipal acts with strict versioning)
-- ============================================================================

CREATE TABLE public.acte (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collectivite_id uuid NOT NULL REFERENCES public.collectivite(id) ON DELETE RESTRICT,

  -- Identification
  type_acte acte_type NOT NULL,
  numero_interne text, -- Numéro de délibération/arrêté interne
  numero_actes text, -- Numéro au registre des actes
  objet_court text NOT NULL, -- Objet succinct (< 200 chars)
  objet_complet text, -- Objet complet si disponible

  -- Dates
  date_acte date NOT NULL, -- Date de l'acte
  date_seance date, -- Date de la séance (pour délibérations)

  -- Context
  organe text, -- Conseil municipal, Maire, Adjoint...
  rapporteur text, -- Nom du rapporteur

  -- Exécution: séparation déclaré vs prouvé
  exec_declared boolean NOT NULL DEFAULT false,
  exec_declared_date date,
  exec_confirmed boolean NOT NULL DEFAULT false,
  exec_confirmed_date date,
  exec_proof_id uuid, -- FK vers proof (ajoutée après création de proof)

  -- Versioning (strict: no destructive updates)
  version integer NOT NULL DEFAULT 1,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_to timestamptz, -- NULL = version courante
  supersedes_id uuid REFERENCES public.acte(id), -- Version précédente

  -- Extended data (JSONB for flexibility)
  metadata jsonb NOT NULL DEFAULT '{"schemaVersion": 1}'::jsonb,
  -- metadata.montant_eur: numeric
  -- metadata.votes: { pour: int, contre: int, abstentions: int, non_participants: int }
  -- metadata.keywords: string[]
  -- metadata.domaine: string (finances, urbanisme, etc.)
  -- metadata.beneficiaires: string[]
  -- metadata.source_url: string

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.users(id),

  CONSTRAINT acte_version_positive CHECK (version > 0),
  CONSTRAINT acte_valid_dates CHECK (valid_to IS NULL OR valid_to > valid_from),
  CONSTRAINT acte_date_seance_coherent CHECK (date_seance IS NULL OR date_seance <= date_acte)
);

-- Indexes for common queries
CREATE INDEX idx_acte_collectivite ON public.acte(collectivite_id);
CREATE INDEX idx_acte_type ON public.acte(type_acte);
CREATE INDEX idx_acte_date ON public.acte(date_acte DESC);
CREATE INDEX idx_acte_numero ON public.acte(numero_interne) WHERE numero_interne IS NOT NULL;
CREATE INDEX idx_acte_current ON public.acte(id) WHERE valid_to IS NULL; -- Only current versions
CREATE INDEX idx_acte_supersedes ON public.acte(supersedes_id) WHERE supersedes_id IS NOT NULL;

-- Partial index for unconfirmed executions (for alerts)
CREATE INDEX idx_acte_exec_unconfirmed ON public.acte(collectivite_id, date_acte)
  WHERE exec_declared = true AND exec_confirmed = false AND valid_to IS NULL;

-- GIN index for metadata searches
CREATE INDEX idx_acte_metadata ON public.acte USING GIN (metadata);

COMMENT ON TABLE public.acte IS 'Municipal acts (délibérations, arrêtés, etc.) with strict versioning';
COMMENT ON COLUMN public.acte.valid_to IS 'NULL indicates current version; set when superseded';
COMMENT ON COLUMN public.acte.exec_declared IS 'Execution claimed by administration (unverified)';
COMMENT ON COLUMN public.acte.exec_confirmed IS 'Execution confirmed by proof (AR @CTES, etc.)';

-- ============================================================================
-- SECTION 5: PROOF (Evidence with verification workflow)
-- ============================================================================

CREATE TABLE public.proof (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Classification
  type proof_type NOT NULL,
  source_org source_org NOT NULL,

  -- Dates
  date_emission date, -- Date on the document
  date_reception date, -- Date received

  -- Storage
  hash_sha256 text NOT NULL, -- For integrity verification
  storage_url text NOT NULL, -- Supabase Storage URL
  original_filename text,
  file_size_bytes bigint,
  mime_type text,

  -- Legal weight
  probative_force probative_force NOT NULL DEFAULT 'FAIBLE',

  -- Human verification workflow
  verified_by_human boolean NOT NULL DEFAULT false,
  verified_by_user_id uuid REFERENCES public.users(id),
  verified_at timestamptz,
  verification_notes text,

  -- Metadata
  metadata jsonb NOT NULL DEFAULT '{"schemaVersion": 1}'::jsonb,
  -- metadata.description: string
  -- metadata.ocr_text: string (if OCR performed)
  -- metadata.pages: int
  -- metadata.extracted_date: date (from OCR/parsing)

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.users(id),

  CONSTRAINT proof_hash_valid CHECK (length(hash_sha256) = 64), -- SHA-256 = 64 hex chars
  CONSTRAINT proof_verification_coherent CHECK (
    (verified_by_human = false AND verified_by_user_id IS NULL AND verified_at IS NULL)
    OR (verified_by_human = true AND verified_by_user_id IS NOT NULL AND verified_at IS NOT NULL)
  )
);

-- Indexes
CREATE INDEX idx_proof_type ON public.proof(type);
CREATE INDEX idx_proof_source ON public.proof(source_org);
CREATE INDEX idx_proof_verified ON public.proof(verified_by_human);
CREATE INDEX idx_proof_hash ON public.proof(hash_sha256);
CREATE INDEX idx_proof_unverified ON public.proof(created_at DESC) WHERE verified_by_human = false;

COMMENT ON TABLE public.proof IS 'Evidence documents with cryptographic integrity and human verification workflow';
COMMENT ON COLUMN public.proof.hash_sha256 IS 'SHA-256 hash of file content for integrity verification';
COMMENT ON COLUMN public.proof.probative_force IS 'Legal weight of evidence (FAIBLE to JURIDICTIONNELLE)';

-- Add FK from acte to proof now that proof exists
ALTER TABLE public.acte
  ADD CONSTRAINT acte_exec_proof_fkey
  FOREIGN KEY (exec_proof_id) REFERENCES public.proof(id) ON DELETE SET NULL;

-- ============================================================================
-- SECTION 6: PROOF_LINK (Polymorphic links between proofs and entities)
-- ============================================================================

CREATE TABLE public.proof_link (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proof_id uuid NOT NULL REFERENCES public.proof(id) ON DELETE CASCADE,
  entity_type civic_entity_type NOT NULL,
  entity_id uuid NOT NULL,
  role proof_role NOT NULL DEFAULT 'PIECE_PRINCIPALE',

  -- Optional ordering for multiple pieces
  piece_number integer,

  metadata jsonb NOT NULL DEFAULT '{"schemaVersion": 1}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT proof_link_unique UNIQUE (proof_id, entity_type, entity_id, role)
);

-- Indexes for lookups in both directions
CREATE INDEX idx_proof_link_proof ON public.proof_link(proof_id);
CREATE INDEX idx_proof_link_entity ON public.proof_link(entity_type, entity_id);
CREATE INDEX idx_proof_link_entity_role ON public.proof_link(entity_type, entity_id, role);

COMMENT ON TABLE public.proof_link IS 'Polymorphic many-to-many links between proofs and various entities';
COMMENT ON COLUMN public.proof_link.piece_number IS 'For ordering multiple proofs (PIECE 1, PIECE 2, etc.)';

-- ============================================================================
-- SECTION 7: DEMANDE_ADMIN (Administrative requests: CRPA, etc.)
-- ============================================================================

CREATE TABLE public.demande_admin (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collectivite_id uuid NOT NULL REFERENCES public.collectivite(id) ON DELETE RESTRICT,
  acte_id uuid REFERENCES public.acte(id) ON DELETE SET NULL, -- Optional: may target multiple acts

  -- Request details
  type_demande demande_type NOT NULL,
  destinataire_org text NOT NULL, -- e.g., "Mairie de Corte"
  destinataire_contact text, -- Specific person or service
  destinataire_email text,

  -- Sending
  date_envoi date NOT NULL,
  mode_envoi mode_envoi NOT NULL,

  -- Content
  objet text NOT NULL, -- Subject line
  texte_envoye text, -- Full text of request

  -- Status
  status demande_status NOT NULL DEFAULT 'EN_ATTENTE',

  -- References
  reference_interne text, -- Our internal reference
  reference_admin text, -- Reference given by administration

  metadata jsonb NOT NULL DEFAULT '{"schemaVersion": 1}'::jsonb,
  -- metadata.actes_concernes: uuid[] (if multiple acts)
  -- metadata.pieces_demandees: string[]
  -- metadata.fondement_juridique: string

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.users(id),

  CONSTRAINT demande_admin_date_valid CHECK (date_envoi <= CURRENT_DATE + INTERVAL '1 day')
);

-- Indexes
CREATE INDEX idx_demande_admin_collectivite ON public.demande_admin(collectivite_id);
CREATE INDEX idx_demande_admin_acte ON public.demande_admin(acte_id) WHERE acte_id IS NOT NULL;
CREATE INDEX idx_demande_admin_status ON public.demande_admin(status);
CREATE INDEX idx_demande_admin_date ON public.demande_admin(date_envoi DESC);
CREATE INDEX idx_demande_admin_pending ON public.demande_admin(date_envoi) WHERE status = 'EN_ATTENTE';

COMMENT ON TABLE public.demande_admin IS 'Administrative requests (CRPA, info requests, etc.)';
COMMENT ON COLUMN public.demande_admin.acte_id IS 'Optional: may be NULL if request concerns multiple acts';

-- ============================================================================
-- SECTION 8: REPONSE_ADMIN (Responses to administrative requests)
-- ============================================================================

CREATE TABLE public.reponse_admin (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demande_id uuid NOT NULL REFERENCES public.demande_admin(id) ON DELETE CASCADE,

  -- Reception
  date_reception date NOT NULL,

  -- Response details
  type_reponse reponse_type NOT NULL,
  resume text, -- Summary of response

  -- Linked proof (the actual response document)
  proof_id uuid REFERENCES public.proof(id) ON DELETE SET NULL,

  metadata jsonb NOT NULL DEFAULT '{"schemaVersion": 1}'::jsonb,
  -- metadata.documents_fournis: string[]
  -- metadata.documents_refuses: string[]
  -- metadata.motif_refus: string

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.users(id)
);

-- Indexes
CREATE INDEX idx_reponse_admin_demande ON public.reponse_admin(demande_id);
CREATE INDEX idx_reponse_admin_type ON public.reponse_admin(type_reponse);
CREATE INDEX idx_reponse_admin_date ON public.reponse_admin(date_reception DESC);

COMMENT ON TABLE public.reponse_admin IS 'Responses received to administrative requests';

-- ============================================================================
-- SECTION 9: VERSIONING FUNCTION
-- ============================================================================

-- Function to create a new version of an acte (never destructive update)
CREATE OR REPLACE FUNCTION update_acte_versioned(
  p_acte_id uuid,
  p_payload jsonb,
  p_user_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_acte record;
  v_new_id uuid;
  v_new_version integer;
BEGIN
  -- Get current version
  SELECT * INTO v_old_acte
  FROM public.acte
  WHERE id = p_acte_id AND valid_to IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acte % not found or already superseded', p_acte_id;
  END IF;

  -- Calculate new version
  v_new_version := v_old_acte.version + 1;
  v_new_id := gen_random_uuid();

  -- Close old version
  UPDATE public.acte
  SET valid_to = now(),
      updated_at = now()
  WHERE id = p_acte_id;

  -- Create new version with updated fields
  INSERT INTO public.acte (
    id, collectivite_id, type_acte, numero_interne, numero_actes,
    objet_court, objet_complet, date_acte, date_seance, organe, rapporteur,
    exec_declared, exec_declared_date, exec_confirmed, exec_confirmed_date, exec_proof_id,
    version, valid_from, valid_to, supersedes_id,
    metadata, created_at, updated_at, created_by
  )
  SELECT
    v_new_id,
    COALESCE((p_payload->>'collectivite_id')::uuid, v_old_acte.collectivite_id),
    COALESCE((p_payload->>'type_acte')::acte_type, v_old_acte.type_acte),
    COALESCE(p_payload->>'numero_interne', v_old_acte.numero_interne),
    COALESCE(p_payload->>'numero_actes', v_old_acte.numero_actes),
    COALESCE(p_payload->>'objet_court', v_old_acte.objet_court),
    COALESCE(p_payload->>'objet_complet', v_old_acte.objet_complet),
    COALESCE((p_payload->>'date_acte')::date, v_old_acte.date_acte),
    COALESCE((p_payload->>'date_seance')::date, v_old_acte.date_seance),
    COALESCE(p_payload->>'organe', v_old_acte.organe),
    COALESCE(p_payload->>'rapporteur', v_old_acte.rapporteur),
    COALESCE((p_payload->>'exec_declared')::boolean, v_old_acte.exec_declared),
    COALESCE((p_payload->>'exec_declared_date')::date, v_old_acte.exec_declared_date),
    COALESCE((p_payload->>'exec_confirmed')::boolean, v_old_acte.exec_confirmed),
    COALESCE((p_payload->>'exec_confirmed_date')::date, v_old_acte.exec_confirmed_date),
    COALESCE((p_payload->>'exec_proof_id')::uuid, v_old_acte.exec_proof_id),
    v_new_version,
    now(), -- valid_from
    NULL,  -- valid_to (current)
    p_acte_id, -- supersedes_id
    COALESCE(p_payload->'metadata', v_old_acte.metadata),
    v_old_acte.created_at, -- preserve original creation date
    now(),
    p_user_id;

  -- Log the versioning operation
  INSERT INTO public.civic_audit_log (
    user_id, actor_type, action, entity_type, entity_id,
    payload, created_at
  ) VALUES (
    p_user_id,
    'HUMAIN',
    'UPDATE',
    'ACTE',
    v_new_id,
    jsonb_build_object(
      'previous_version_id', p_acte_id,
      'previous_version', v_old_acte.version,
      'new_version', v_new_version,
      'changes', p_payload
    ),
    now()
  );

  RETURN v_new_id;
END;
$$;

COMMENT ON FUNCTION update_acte_versioned IS 'Creates a new version of an acte, closing the previous one (no destructive updates)';

-- ============================================================================
-- SECTION 10: AUDIT LOG (Forward declaration for versioning function)
-- ============================================================================

-- Actor types for audit
CREATE TYPE civic_actor_type AS ENUM (
  'HUMAIN',
  'IA',
  'SCRIPT_SYSTEME',
  'CRON'
);

-- Action types for audit
CREATE TYPE civic_audit_action AS ENUM (
  'CREATE',
  'UPDATE',
  'DELETE',
  'APPROVE',
  'REJECT',
  'SEND',
  'PUBLISH',
  'VERIFY',
  'LOGIN',
  'EXPORT',
  'VERSION'
);

CREATE TABLE public.civic_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  actor_type civic_actor_type NOT NULL DEFAULT 'HUMAIN',
  action civic_audit_action NOT NULL,
  entity_type civic_entity_type NOT NULL,
  entity_id uuid NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for audit queries
CREATE INDEX idx_civic_audit_log_user ON public.civic_audit_log(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_civic_audit_log_entity ON public.civic_audit_log(entity_type, entity_id);
CREATE INDEX idx_civic_audit_log_action ON public.civic_audit_log(action);
CREATE INDEX idx_civic_audit_log_date ON public.civic_audit_log(created_at DESC);
CREATE INDEX idx_civic_audit_log_actor_type ON public.civic_audit_log(actor_type);

COMMENT ON TABLE public.civic_audit_log IS 'Complete audit trail for all civic acts system operations';
COMMENT ON COLUMN public.civic_audit_log.actor_type IS 'Distinguishes human, AI, script, and cron actions';

-- ============================================================================
-- SECTION 11: UPDATED_AT TRIGGER
-- ============================================================================

-- Generic trigger function for updated_at
CREATE OR REPLACE FUNCTION civic_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER set_civic_user_profile_updated_at
  BEFORE UPDATE ON public.civic_user_profile
  FOR EACH ROW EXECUTE FUNCTION civic_set_updated_at();

CREATE TRIGGER set_collectivite_updated_at
  BEFORE UPDATE ON public.collectivite
  FOR EACH ROW EXECUTE FUNCTION civic_set_updated_at();

CREATE TRIGGER set_acte_updated_at
  BEFORE UPDATE ON public.acte
  FOR EACH ROW EXECUTE FUNCTION civic_set_updated_at();

CREATE TRIGGER set_proof_updated_at
  BEFORE UPDATE ON public.proof
  FOR EACH ROW EXECUTE FUNCTION civic_set_updated_at();

CREATE TRIGGER set_demande_admin_updated_at
  BEFORE UPDATE ON public.demande_admin
  FOR EACH ROW EXECUTE FUNCTION civic_set_updated_at();

CREATE TRIGGER set_reponse_admin_updated_at
  BEFORE UPDATE ON public.reponse_admin
  FOR EACH ROW EXECUTE FUNCTION civic_set_updated_at();

-- ============================================================================
-- SECTION 12: INITIAL DATA (Reference data for Corte)
-- ============================================================================

-- Insert Corte as first collectivity
INSERT INTO public.collectivite (
  type, code_insee, nom_officiel, nom_courant,
  departement, region, site_web, date_activation_systeme, population
) VALUES (
  'COMMUNE',
  '2B096',
  'Commune de Corte',
  'Corte',
  'Haute-Corse',
  'Corse',
  'https://www.mairie-corte.fr',
  CURRENT_DATE,
  7737
);

-- ============================================================================
-- SECTION 13: RLS POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.civic_user_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collectivite ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acte ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proof ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proof_link ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demande_admin ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reponse_admin ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.civic_audit_log ENABLE ROW LEVEL SECURITY;

-- Collectivite: public read, admin write
CREATE POLICY collectivite_select_all ON public.collectivite
  FOR SELECT USING (true);

CREATE POLICY collectivite_insert_admin ON public.collectivite
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.civic_user_profile
      WHERE id = auth.uid() AND role IN ('ADMIN_SYSTEM', 'LEGAL_REVIEWER')
    )
  );

CREATE POLICY collectivite_update_admin ON public.collectivite
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.civic_user_profile
      WHERE id = auth.uid() AND role IN ('ADMIN_SYSTEM', 'LEGAL_REVIEWER')
    )
  );

-- Acte: public read (current versions only), admin write
CREATE POLICY acte_select_current ON public.acte
  FOR SELECT USING (valid_to IS NULL);

-- Allow viewing historical versions for admins
CREATE POLICY acte_select_history_admin ON public.acte
  FOR SELECT USING (
    valid_to IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.civic_user_profile
      WHERE id = auth.uid() AND role IN ('ADMIN_SYSTEM', 'LEGAL_REVIEWER')
    )
  );

CREATE POLICY acte_insert_admin ON public.acte
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.civic_user_profile
      WHERE id = auth.uid() AND role IN ('ADMIN_SYSTEM', 'LEGAL_REVIEWER', 'CITIZEN_REVIEWER')
    )
  );

CREATE POLICY acte_update_admin ON public.acte
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.civic_user_profile
      WHERE id = auth.uid() AND role IN ('ADMIN_SYSTEM', 'LEGAL_REVIEWER')
    )
  );

-- Proof: public read verified, admin all
CREATE POLICY proof_select_verified ON public.proof
  FOR SELECT USING (verified_by_human = true);

CREATE POLICY proof_select_unverified_admin ON public.proof
  FOR SELECT USING (
    verified_by_human = false AND
    EXISTS (
      SELECT 1 FROM public.civic_user_profile
      WHERE id = auth.uid() AND role IN ('ADMIN_SYSTEM', 'LEGAL_REVIEWER', 'CITIZEN_REVIEWER')
    )
  );

CREATE POLICY proof_insert_reviewer ON public.proof
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.civic_user_profile
      WHERE id = auth.uid() AND role IN ('ADMIN_SYSTEM', 'LEGAL_REVIEWER', 'CITIZEN_REVIEWER')
    )
  );

CREATE POLICY proof_update_reviewer ON public.proof
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.civic_user_profile
      WHERE id = auth.uid() AND role IN ('ADMIN_SYSTEM', 'LEGAL_REVIEWER', 'CITIZEN_REVIEWER')
    )
  );

-- Proof_link: public read, reviewer write
CREATE POLICY proof_link_select_all ON public.proof_link
  FOR SELECT USING (true);

CREATE POLICY proof_link_insert_reviewer ON public.proof_link
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.civic_user_profile
      WHERE id = auth.uid() AND role IN ('ADMIN_SYSTEM', 'LEGAL_REVIEWER', 'CITIZEN_REVIEWER')
    )
  );

-- Demande_admin: public read, reviewer write
CREATE POLICY demande_admin_select_all ON public.demande_admin
  FOR SELECT USING (true);

CREATE POLICY demande_admin_insert_reviewer ON public.demande_admin
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.civic_user_profile
      WHERE id = auth.uid() AND role IN ('ADMIN_SYSTEM', 'LEGAL_REVIEWER', 'CITIZEN_REVIEWER')
    )
  );

CREATE POLICY demande_admin_update_reviewer ON public.demande_admin
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.civic_user_profile
      WHERE id = auth.uid() AND role IN ('ADMIN_SYSTEM', 'LEGAL_REVIEWER')
    )
  );

-- Reponse_admin: public read, reviewer write
CREATE POLICY reponse_admin_select_all ON public.reponse_admin
  FOR SELECT USING (true);

CREATE POLICY reponse_admin_insert_reviewer ON public.reponse_admin
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.civic_user_profile
      WHERE id = auth.uid() AND role IN ('ADMIN_SYSTEM', 'LEGAL_REVIEWER', 'CITIZEN_REVIEWER')
    )
  );

-- Civic_user_profile: own profile or admin
CREATE POLICY civic_user_profile_select_own ON public.civic_user_profile
  FOR SELECT USING (id = auth.uid());

CREATE POLICY civic_user_profile_select_admin ON public.civic_user_profile
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.civic_user_profile
      WHERE id = auth.uid() AND role = 'ADMIN_SYSTEM'
    )
  );

CREATE POLICY civic_user_profile_update_own ON public.civic_user_profile
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY civic_user_profile_insert_self ON public.civic_user_profile
  FOR INSERT WITH CHECK (id = auth.uid());

-- Audit log: insert only for all, select for admin
CREATE POLICY civic_audit_log_insert_all ON public.civic_audit_log
  FOR INSERT WITH CHECK (true);

CREATE POLICY civic_audit_log_select_admin ON public.civic_audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.civic_user_profile
      WHERE id = auth.uid() AND role = 'ADMIN_SYSTEM'
    )
  );

-- ============================================================================
-- SECTION 14: HELPER VIEWS
-- ============================================================================

-- View: Current actes only (most common query)
CREATE VIEW public.v_actes_current AS
SELECT *
FROM public.acte
WHERE valid_to IS NULL;

COMMENT ON VIEW public.v_actes_current IS 'Current versions of all actes (excludes superseded versions)';

-- View: Unverified proofs queue
CREATE VIEW public.v_proofs_to_verify AS
SELECT
  p.*,
  pl.entity_type,
  pl.entity_id,
  pl.role AS link_role
FROM public.proof p
LEFT JOIN public.proof_link pl ON pl.proof_id = p.id
WHERE p.verified_by_human = false
ORDER BY p.created_at DESC;

COMMENT ON VIEW public.v_proofs_to_verify IS 'Queue of proofs awaiting human verification';

-- View: Pending administrative requests
CREATE VIEW public.v_demandes_pending AS
SELECT
  d.*,
  c.nom_officiel AS collectivite_nom,
  a.objet_court AS acte_objet,
  a.date_acte
FROM public.demande_admin d
JOIN public.collectivite c ON d.collectivite_id = c.id
LEFT JOIN public.acte a ON d.acte_id = a.id AND a.valid_to IS NULL
WHERE d.status = 'EN_ATTENTE'
ORDER BY d.date_envoi ASC;

COMMENT ON VIEW public.v_demandes_pending IS 'Administrative requests awaiting response';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
