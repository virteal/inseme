-- ===========================================================================
-- Migration: Phase 3 - Human-in-the-Loop (Garde-fou humain)
-- Projet: Système citoyen de contrôle des actes municipaux
-- Date: 2024-12-04
-- ===========================================================================
-- Cette migration ajoute les tables et fonctions nécessaires pour:
-- 1. File d'attente des actions sortantes (emails, courriers)
-- 2. Système de publication citoyenne avec validation
-- 3. Journal de responsabilité des acteurs
-- ===========================================================================

-- ===========================================================================
-- ENUMS
-- ===========================================================================

-- Type d'action sortante
DO $$ BEGIN
  CREATE TYPE outgoing_action_type AS ENUM (
  'EMAIL_MAIRIE',
  'EMAIL_PREFECTURE',
  'EMAIL_CADA',
  'COURRIER_LRAR',
  'PUBLICATION_WEB',
  'NOTIFICATION_PREFET',
  'SAISINE_TA',
  'AUTRE'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Statut d'une action sortante
DO $$ BEGIN
  CREATE TYPE outgoing_action_status AS ENUM (
  'PENDING',      -- En attente de validation
  'APPROVED',     -- Approuvée, prête à envoyer
  'SENT',         -- Envoyée
  'CONFIRMED',    -- Réception confirmée
  'FAILED',       -- Échec d'envoi
  'CANCELLED',    -- Annulée
  'REJECTED'      -- Rejetée par le validateur
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Type de publication citoyenne
DO $$ BEGIN
  CREATE TYPE publication_type AS ENUM (
  'ANALYSE_ACTE',
  'SIGNALEMENT',
  'TEMOIGNAGE',
  'SYNTHESE',
  'ALERTE',
  'AUTRE'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Statut de publication
DO $$ BEGIN
  CREATE TYPE publication_status AS ENUM (
  'DRAFT',        -- Brouillon
  'PENDING',      -- En attente de modération
  'APPROVED',     -- Publiée
  'REJECTED',     -- Rejetée
  'ARCHIVED'      -- Archivée
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Type de responsabilité
DO $$ BEGIN
  CREATE TYPE responsibility_type AS ENUM (
  'CREATION',
  'MODIFICATION',
  'VALIDATION',
  'REJECTION',
  'ENVOI',
  'RECEPTION',
  'SIGNALEMENT',
  'AUTRE'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ===========================================================================
-- TABLE: outgoing_action
-- ===========================================================================
-- File d'attente des actions sortantes avec validation humaine obligatoire

CREATE TABLE IF NOT EXISTS outgoing_action (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Contexte
  collectivite_id UUID NOT NULL REFERENCES collectivite(id),
  acte_id UUID REFERENCES acte(id),
  demande_admin_id UUID REFERENCES demande_admin(id),

  -- Type et contenu
  action_type outgoing_action_type NOT NULL,
  status outgoing_action_status NOT NULL DEFAULT 'PENDING',

  -- Destinataire
  destinataire_nom TEXT,
  destinataire_email TEXT,
  destinataire_adresse TEXT,

  -- Contenu
  sujet TEXT NOT NULL,
  corps TEXT NOT NULL,
  pieces_jointes JSONB DEFAULT '[]'::jsonb,

  -- Métadonnées
  priority INTEGER DEFAULT 5, -- 1=urgent, 10=faible
  date_butoir DATE,
  motif TEXT,

  -- Validation
  created_by UUID NOT NULL REFERENCES auth.users(id),
  validated_by UUID REFERENCES auth.users(id),
  validated_at TIMESTAMPTZ,
  validation_note TEXT,

  -- Envoi
  sent_at TIMESTAMPTZ,
  sent_by UUID REFERENCES auth.users(id),
  send_method TEXT,
  send_reference TEXT,

  -- Confirmation
  confirmed_at TIMESTAMPTZ,
  confirmation_proof_id UUID REFERENCES proof(id),

  -- Échec
  failure_reason TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_outgoing_action_status ON outgoing_action(status);
CREATE INDEX IF NOT EXISTS idx_outgoing_action_collectivite ON outgoing_action(collectivite_id);
CREATE INDEX IF NOT EXISTS idx_outgoing_action_pending ON outgoing_action(status, priority) WHERE status = 'PENDING';

-- ===========================================================================
-- TABLE: publication_citoyenne
-- ===========================================================================
-- Publications citoyennes avec modération

CREATE TABLE IF NOT EXISTS publication_citoyenne (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Contexte
  collectivite_id UUID NOT NULL REFERENCES collectivite(id),
  acte_id UUID REFERENCES acte(id),
  demande_admin_id UUID REFERENCES demande_admin(id),

  -- Type et statut
  publication_type publication_type NOT NULL,
  status publication_status NOT NULL DEFAULT 'DRAFT',

  -- Contenu
  titre TEXT NOT NULL,
  resume TEXT,
  contenu TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',

  -- Auteur
  author_id UUID NOT NULL REFERENCES auth.users(id),
  author_pseudonym TEXT, -- Possibilité de publier sous pseudo
  is_anonymous BOOLEAN DEFAULT FALSE,

  -- Modération
  moderated_by UUID REFERENCES auth.users(id),
  moderated_at TIMESTAMPTZ,
  moderation_note TEXT,
  rejection_reason TEXT,

  -- Engagement
  views_count INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,

  -- Métadonnées
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ
);

-- Index
CREATE INDEX IF NOT EXISTS idx_publication_status ON publication_citoyenne(status);
CREATE INDEX IF NOT EXISTS idx_publication_author ON publication_citoyenne(author_id);
CREATE INDEX IF NOT EXISTS idx_publication_collectivite ON publication_citoyenne(collectivite_id);
CREATE INDEX IF NOT EXISTS idx_publication_acte ON publication_citoyenne(acte_id) WHERE acte_id IS NOT NULL;

-- ===========================================================================
-- TABLE: responsibility_log
-- ===========================================================================
-- Journal immuable des responsabilités

CREATE TABLE IF NOT EXISTS responsibility_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Qui
  actor_id UUID NOT NULL REFERENCES auth.users(id),
  actor_role TEXT NOT NULL, -- Role au moment de l'action

  -- Quoi
  responsibility_type responsibility_type NOT NULL,
  action_description TEXT NOT NULL,

  -- Sur quoi
  entity_type TEXT NOT NULL, -- 'acte', 'demande_admin', 'outgoing_action', 'publication', etc.
  entity_id UUID NOT NULL,

  -- Contexte
  collectivite_id UUID REFERENCES collectivite(id),

  -- Détails
  before_state JSONB,
  after_state JSONB,
  reason TEXT,

  -- Vérification
  ip_address INET,
  user_agent TEXT,
  checksum TEXT, -- Hash pour vérifier l'intégrité

  -- Timestamp immuable
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_responsibility_actor ON responsibility_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_responsibility_entity ON responsibility_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_responsibility_date ON responsibility_log(logged_at);

-- ===========================================================================
-- TABLE: verification_queue
-- ===========================================================================
-- File d'attente des preuves à vérifier

CREATE TABLE IF NOT EXISTS verification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Preuve à vérifier
  proof_id UUID NOT NULL REFERENCES proof(id),

  -- Statut
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'VERIFIED', 'REJECTED')),
  priority INTEGER DEFAULT 5,

  -- Assignation
  assigned_to UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ,

  -- Vérification
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  verification_note TEXT,

  -- Rejet
  rejection_reason TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_verification_queue_status ON verification_queue(status);
CREATE INDEX IF NOT EXISTS idx_verification_queue_pending ON verification_queue(priority) WHERE status = 'PENDING';

-- ===========================================================================
-- FONCTION: log_responsibility
-- ===========================================================================
-- Fonction pour enregistrer une action dans le journal de responsabilité

CREATE OR REPLACE FUNCTION log_responsibility(
  p_actor_id UUID,
  p_actor_role TEXT,
  p_type responsibility_type,
  p_description TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_collectivite_id UUID DEFAULT NULL,
  p_before_state JSONB DEFAULT NULL,
  p_after_state JSONB DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
  v_checksum TEXT;
BEGIN
  -- Calculer le checksum pour l'intégrité
  v_checksum := encode(
    sha256(
      (p_actor_id::text || p_type::text || p_entity_type || p_entity_id::text || now()::text)::bytea
    ),
    'hex'
  );

  INSERT INTO responsibility_log (
    actor_id,
    actor_role,
    responsibility_type,
    action_description,
    entity_type,
    entity_id,
    collectivite_id,
    before_state,
    after_state,
    reason,
    ip_address,
    user_agent,
    checksum
  ) VALUES (
    p_actor_id,
    p_actor_role,
    p_type,
    p_description,
    p_entity_type,
    p_entity_id,
    p_collectivite_id,
    p_before_state,
    p_after_state,
    p_reason,
    p_ip_address,
    p_user_agent,
    v_checksum
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================================================
-- FONCTION: approve_outgoing_action
-- ===========================================================================
-- Fonction pour approuver une action sortante

CREATE OR REPLACE FUNCTION approve_outgoing_action(
  p_action_id UUID,
  p_validator_id UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_action outgoing_action%ROWTYPE;
BEGIN
  -- Récupérer l'action
  SELECT * INTO v_action FROM outgoing_action WHERE id = p_action_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Action non trouvée';
  END IF;

  IF v_action.status != 'PENDING' THEN
    RAISE EXCEPTION 'Action non en attente de validation';
  END IF;

  -- Mettre à jour
  UPDATE outgoing_action SET
    status = 'APPROVED',
    validated_by = p_validator_id,
    validated_at = now(),
    validation_note = p_note,
    updated_at = now()
  WHERE id = p_action_id;

  -- Logger la responsabilité
  PERFORM log_responsibility(
    p_validator_id,
    'VALIDATEUR',
    'VALIDATION',
    'Approbation action sortante: ' || v_action.sujet,
    'outgoing_action',
    p_action_id,
    v_action.collectivite_id,
    row_to_json(v_action)::jsonb,
    NULL,
    p_note
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================================================
-- FONCTION: reject_outgoing_action
-- ===========================================================================

CREATE OR REPLACE FUNCTION reject_outgoing_action(
  p_action_id UUID,
  p_validator_id UUID,
  p_reason TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_action outgoing_action%ROWTYPE;
BEGIN
  SELECT * INTO v_action FROM outgoing_action WHERE id = p_action_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Action non trouvée';
  END IF;

  UPDATE outgoing_action SET
    status = 'REJECTED',
    validated_by = p_validator_id,
    validated_at = now(),
    validation_note = p_reason,
    updated_at = now()
  WHERE id = p_action_id;

  PERFORM log_responsibility(
    p_validator_id,
    'VALIDATEUR',
    'REJECTION',
    'Rejet action sortante: ' || v_action.sujet,
    'outgoing_action',
    p_action_id,
    v_action.collectivite_id,
    row_to_json(v_action)::jsonb,
    NULL,
    p_reason
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================================================
-- FONCTION: mark_action_sent
-- ===========================================================================

CREATE OR REPLACE FUNCTION mark_action_sent(
  p_action_id UUID,
  p_sender_id UUID,
  p_method TEXT,
  p_reference TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_action outgoing_action%ROWTYPE;
BEGIN
  SELECT * INTO v_action FROM outgoing_action WHERE id = p_action_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Action non trouvée';
  END IF;

  IF v_action.status != 'APPROVED' THEN
    RAISE EXCEPTION 'Action non approuvée';
  END IF;

  UPDATE outgoing_action SET
    status = 'SENT',
    sent_at = now(),
    sent_by = p_sender_id,
    send_method = p_method,
    send_reference = p_reference,
    updated_at = now()
  WHERE id = p_action_id;

  PERFORM log_responsibility(
    p_sender_id,
    'EXPEDITEUR',
    'ENVOI',
    'Envoi action: ' || v_action.sujet || ' via ' || p_method,
    'outgoing_action',
    p_action_id,
    v_action.collectivite_id,
    row_to_json(v_action)::jsonb,
    NULL,
    'Référence: ' || COALESCE(p_reference, 'N/A')
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================================================
-- VUES
-- ===========================================================================

-- Vue des actions en attente de validation
CREATE OR REPLACE VIEW v_actions_pending AS
SELECT
  oa.*,
  c.nom_officiel AS collectivite_nom,
  a.numero_interne AS acte_numero,
  a.objet_court AS acte_objet,
  u.email AS creator_email,
  (
    SELECT COUNT(*) FROM outgoing_action
    WHERE collectivite_id = oa.collectivite_id
    AND status = 'PENDING'
  ) AS pending_count_collectivite
FROM outgoing_action oa
LEFT JOIN collectivite c ON c.id = oa.collectivite_id
LEFT JOIN acte a ON a.id = oa.acte_id
LEFT JOIN auth.users u ON u.id = oa.created_by
WHERE oa.status = 'PENDING'
ORDER BY oa.priority ASC, oa.created_at ASC;

-- Vue des publications en attente de modération
CREATE OR REPLACE VIEW v_publications_pending AS
SELECT
  pc.*,
  c.nom_officiel AS collectivite_nom,
  a.numero_interne AS acte_numero,
  u.email AS author_email,
  (
    SELECT COUNT(*) FROM publication_citoyenne
    WHERE status = 'PENDING'
  ) AS total_pending
FROM publication_citoyenne pc
LEFT JOIN collectivite c ON c.id = pc.collectivite_id
LEFT JOIN acte a ON a.id = pc.acte_id
LEFT JOIN auth.users u ON u.id = pc.author_id
WHERE pc.status = 'PENDING'
ORDER BY pc.created_at ASC;

-- Vue des preuves à vérifier
DROP VIEW IF EXISTS v_proofs_to_verify;
CREATE OR REPLACE VIEW v_proofs_to_verify AS
SELECT
  vq.*,
  p.type AS proof_type,
  p.original_filename AS proof_label,
  p.storage_url AS url_fichier,
  p.date_emission AS date_constat,
  u.email AS uploader_email,
  -- Extract acte_id from polymorphic link
  (SELECT entity_id FROM proof_link WHERE proof_id = p.id AND entity_type = 'ACTE' LIMIT 1) AS acte_id,
  -- Extract demande_admin_id from polymorphic link
  (SELECT entity_id FROM proof_link WHERE proof_id = p.id AND entity_type = 'DEMANDE' LIMIT 1) AS demande_admin_id
FROM verification_queue vq
JOIN proof p ON p.id = vq.proof_id
LEFT JOIN auth.users u ON u.id = p.created_by
WHERE vq.status IN ('PENDING', 'IN_PROGRESS')
ORDER BY vq.priority ASC, vq.created_at ASC;

-- Vue du journal de responsabilité récent
CREATE OR REPLACE VIEW v_responsibility_recent AS
SELECT
  rl.*,
  u.email AS actor_email,
  c.nom_officiel AS collectivite_nom
FROM responsibility_log rl
LEFT JOIN auth.users u ON u.id = rl.actor_id
LEFT JOIN collectivite c ON c.id = rl.collectivite_id
ORDER BY rl.logged_at DESC
LIMIT 100;

-- ===========================================================================
-- TRIGGERS
-- ===========================================================================

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_outgoing_action_timestamp
  BEFORE UPDATE ON outgoing_action
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_publication_timestamp
  BEFORE UPDATE ON publication_citoyenne
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_verification_queue_timestamp
  BEFORE UPDATE ON verification_queue
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ===========================================================================
-- RLS POLICIES
-- ===========================================================================

-- Activer RLS
ALTER TABLE outgoing_action ENABLE ROW LEVEL SECURITY;
ALTER TABLE publication_citoyenne ENABLE ROW LEVEL SECURITY;
ALTER TABLE responsibility_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_queue ENABLE ROW LEVEL SECURITY;

-- Policies pour outgoing_action
CREATE POLICY outgoing_action_select_policy ON outgoing_action
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM civic_user_profile
      WHERE role IN ('CITIZEN_REVIEWER', 'LEGAL_REVIEWER', 'PUBLISHER', 'ADMIN_SYSTEM')
    )
  );

CREATE POLICY outgoing_action_insert_policy ON outgoing_action
  FOR INSERT WITH CHECK (
    auth.uid() = created_by
    AND auth.uid() IN (
      SELECT id FROM civic_user_profile
      WHERE role IN ('CITIZEN_REVIEWER', 'LEGAL_REVIEWER', 'PUBLISHER', 'ADMIN_SYSTEM')
    )
  );

CREATE POLICY outgoing_action_update_policy ON outgoing_action
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT id FROM civic_user_profile
      WHERE role IN ('LEGAL_REVIEWER', 'ADMIN_SYSTEM')
    )
  );

-- Policies pour publication_citoyenne
CREATE POLICY publication_select_public_policy ON publication_citoyenne
  FOR SELECT USING (
    status = 'APPROVED' OR author_id = auth.uid()
  );

CREATE POLICY publication_insert_policy ON publication_citoyenne
  FOR INSERT WITH CHECK (
    auth.uid() = author_id
  );

CREATE POLICY publication_update_own_policy ON publication_citoyenne
  FOR UPDATE USING (
    author_id = auth.uid() AND status = 'DRAFT'
  );

CREATE POLICY publication_moderate_policy ON publication_citoyenne
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT id FROM civic_user_profile
      WHERE role IN ('LEGAL_REVIEWER', 'PUBLISHER', 'ADMIN_SYSTEM')
    )
  );

-- Policies pour responsibility_log (lecture seule pour tous les rôles)
CREATE POLICY responsibility_log_select_policy ON responsibility_log
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM civic_user_profile
      WHERE role IN ('CITIZEN_REVIEWER', 'LEGAL_REVIEWER', 'PUBLISHER', 'ADMIN_SYSTEM')
    )
  );

-- Policies pour verification_queue
CREATE POLICY verification_queue_select_policy ON verification_queue
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM civic_user_profile
      WHERE role IN ('LEGAL_REVIEWER', 'ADMIN_SYSTEM')
    )
  );

CREATE POLICY verification_queue_update_policy ON verification_queue
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT id FROM civic_user_profile
      WHERE role IN ('LEGAL_REVIEWER', 'ADMIN_SYSTEM')
    )
  );

-- ===========================================================================
-- COMMENTAIRES
-- ===========================================================================

COMMENT ON TABLE outgoing_action IS 'File d''attente des actions sortantes avec validation humaine obligatoire';
COMMENT ON TABLE publication_citoyenne IS 'Publications citoyennes avec modération avant publication';
COMMENT ON TABLE responsibility_log IS 'Journal immuable des actions et responsabilités';
COMMENT ON TABLE verification_queue IS 'File d''attente des preuves à vérifier';

COMMENT ON FUNCTION log_responsibility IS 'Enregistre une action dans le journal de responsabilité avec checksum';
COMMENT ON FUNCTION approve_outgoing_action IS 'Approuve une action sortante (HITL)';
COMMENT ON FUNCTION reject_outgoing_action IS 'Rejette une action sortante (HITL)';
COMMENT ON FUNCTION mark_action_sent IS 'Marque une action comme envoyée';
