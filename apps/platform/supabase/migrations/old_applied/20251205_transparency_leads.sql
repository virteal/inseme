-- ============================================================================
-- TRANSPARENCY LEADS - Gestion des prospects engagement transparence
-- Association C.O.R.S.I.C.A. - 100% gratuit et open source
-- ============================================================================
-- Ce fichier crée la table pour collecter et gérer les leads issus de la
-- landing page transparence (listes électorales, maires, collectifs, citoyens)
-- ============================================================================

-- Table principale des leads
CREATE TABLE IF NOT EXISTS transparency_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Type de lead
  lead_type TEXT NOT NULL CHECK (lead_type IN (
    'liste_electorale',  -- Liste électorale municipales
    'maire_elu',         -- Maire ou élu(e) en fonction
    'collectif_citoyen', -- Association, comité citoyen
    'citoyen_engage'     -- Citoyen individuel
  )),

  -- Niveau de maturité (1-4)
  maturity_level INTEGER NOT NULL DEFAULT 1 CHECK (maturity_level BETWEEN 1 AND 4),
  -- 1: Intéressé (veut en savoir plus)
  -- 2: Convaincu (s'engage publiquement)
  -- 3: Actif (déploie une instance)
  -- 4: Exemplaire (publie des données)

  -- Informations de contact
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,

  -- Commune concernée
  commune_name TEXT NOT NULL,
  commune_insee TEXT,  -- Code INSEE si connu

  -- Organisation (pour listes et collectifs)
  organization_name TEXT,

  -- Message libre
  message TEXT,

  -- Engagements
  accepted_charter BOOLEAN DEFAULT FALSE,  -- A signé la charte
  accepted_contact BOOLEAN DEFAULT TRUE,   -- Accepte d'être recontacté

  -- Source et tracking
  source TEXT DEFAULT 'landing_page',  -- landing_page, referral, social, etc.
  referrer_url TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,

  -- Métadonnées
  metadata JSONB DEFAULT '{}',

  -- Suivi interne
  status TEXT DEFAULT 'new' CHECK (status IN (
    'new',           -- Nouveau lead
    'contacted',     -- Premier contact effectué
    'qualified',     -- Lead qualifié
    'onboarding',    -- En cours d'onboarding
    'active',        -- Instance déployée
    'churned',       -- Abandonné
    'duplicate'      -- Doublon
  )),

  notes TEXT,  -- Notes internes de suivi
  assigned_to UUID REFERENCES auth.users(id),  -- Bénévole assigné

  -- Instance liée (si déployée)
  instance_id UUID REFERENCES saas_instances(id),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  contacted_at TIMESTAMPTZ,  -- Date du premier contact
  converted_at TIMESTAMPTZ   -- Date de conversion (instance créée)
);

-- Index pour les recherches courantes
CREATE INDEX idx_transparency_leads_type ON transparency_leads(lead_type);
CREATE INDEX idx_transparency_leads_status ON transparency_leads(status);
CREATE INDEX idx_transparency_leads_commune ON transparency_leads(commune_name);
CREATE INDEX idx_transparency_leads_email ON transparency_leads(email);
CREATE INDEX idx_transparency_leads_created ON transparency_leads(created_at DESC);
CREATE INDEX idx_transparency_leads_maturity ON transparency_leads(maturity_level);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_transparency_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_transparency_leads_updated_at
  BEFORE UPDATE ON transparency_leads
  FOR EACH ROW
  EXECUTE FUNCTION update_transparency_leads_updated_at();

-- Vue pour le tableau de bord des leads
CREATE OR REPLACE VIEW transparency_leads_dashboard AS
SELECT
  -- Totaux par type
  COUNT(*) FILTER (WHERE lead_type = 'liste_electorale') AS listes_electorales,
  COUNT(*) FILTER (WHERE lead_type = 'maire_elu') AS maires_elus,
  COUNT(*) FILTER (WHERE lead_type = 'collectif_citoyen') AS collectifs,
  COUNT(*) FILTER (WHERE lead_type = 'citoyen_engage') AS citoyens,

  -- Totaux par statut
  COUNT(*) FILTER (WHERE status = 'new') AS nouveaux,
  COUNT(*) FILTER (WHERE status = 'contacted') AS contactes,
  COUNT(*) FILTER (WHERE status = 'qualified') AS qualifies,
  COUNT(*) FILTER (WHERE status = 'onboarding') AS en_onboarding,
  COUNT(*) FILTER (WHERE status = 'active') AS actifs,

  -- Totaux par maturité
  COUNT(*) FILTER (WHERE maturity_level = 1) AS niveau_interesse,
  COUNT(*) FILTER (WHERE maturity_level = 2) AS niveau_convaincu,
  COUNT(*) FILTER (WHERE maturity_level = 3) AS niveau_actif,
  COUNT(*) FILTER (WHERE maturity_level = 4) AS niveau_exemplaire,

  -- Charte
  COUNT(*) FILTER (WHERE accepted_charter = TRUE) AS signataires_charte,

  -- Communes uniques
  COUNT(DISTINCT commune_name) AS communes_couvertes,

  -- Taux de conversion
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE status = 'active') / NULLIF(COUNT(*), 0),
    1
  ) AS taux_conversion_pct,

  -- Total
  COUNT(*) AS total_leads
FROM transparency_leads
WHERE status != 'duplicate';

-- Table pour les signatures de charte (audit trail)
CREATE TABLE IF NOT EXISTS charter_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES transparency_leads(id) ON DELETE CASCADE,

  -- Détails de la signature
  signer_name TEXT NOT NULL,
  signer_email TEXT NOT NULL,
  signer_role TEXT,  -- Tête de liste, maire, président association, etc.
  organization_name TEXT,
  commune_name TEXT NOT NULL,

  -- Version de la charte signée
  charter_version TEXT DEFAULT '1.0',
  charter_hash TEXT,  -- Hash SHA256 du texte de la charte

  -- Engagement spécifique (JSON des 8 points)
  commitments JSONB DEFAULT '[]',

  -- Signature
  ip_address INET,
  user_agent TEXT,
  signed_at TIMESTAMPTZ DEFAULT now(),

  -- Vérification
  verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_charter_signatures_lead ON charter_signatures(lead_id);
CREATE INDEX idx_charter_signatures_commune ON charter_signatures(commune_name);
CREATE INDEX idx_charter_signatures_signed ON charter_signatures(signed_at DESC);

-- Table pour le suivi des interactions
CREATE TABLE IF NOT EXISTS lead_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES transparency_leads(id) ON DELETE CASCADE,

  -- Type d'interaction
  interaction_type TEXT NOT NULL CHECK (interaction_type IN (
    'email_sent',      -- Email envoyé
    'email_opened',    -- Email ouvert
    'email_clicked',   -- Clic dans email
    'call',            -- Appel téléphonique
    'meeting',         -- Réunion/visio
    'demo',            -- Démonstration
    'onboarding',      -- Session onboarding
    'support',         -- Support technique
    'note'             -- Note interne
  )),

  -- Détails
  subject TEXT,
  content TEXT,
  outcome TEXT,  -- Résultat de l'interaction

  -- Qui a fait l'interaction
  performed_by UUID REFERENCES auth.users(id),
  performed_at TIMESTAMPTZ DEFAULT now(),

  -- Métadonnées
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_lead_interactions_lead ON lead_interactions(lead_id);
CREATE INDEX idx_lead_interactions_type ON lead_interactions(interaction_type);
CREATE INDEX idx_lead_interactions_date ON lead_interactions(performed_at DESC);

-- RLS Policies
ALTER TABLE transparency_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE charter_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_interactions ENABLE ROW LEVEL SECURITY;

-- Politique: insertion publique (formulaire landing page)
CREATE POLICY "Allow public lead creation"
  ON transparency_leads FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Politique: les admins peuvent tout voir
CREATE POLICY "Admins can view all leads"
  ON transparency_leads FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- Politique: les admins peuvent modifier
CREATE POLICY "Admins can update leads"
  ON transparency_leads FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- Même logique pour les signatures de charte
CREATE POLICY "Allow public charter signature"
  ON charter_signatures FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can view signatures"
  ON charter_signatures FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- Interactions: admins only
CREATE POLICY "Admins can manage interactions"
  ON lead_interactions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- Fonction pour obtenir les stats par commune (pour la carte)
CREATE OR REPLACE FUNCTION get_commune_transparency_stats()
RETURNS TABLE (
  commune_name TEXT,
  commune_insee TEXT,
  total_leads INTEGER,
  active_instances INTEGER,
  charter_signers INTEGER,
  best_score INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    tl.commune_name,
    tl.commune_insee,
    COUNT(DISTINCT tl.id)::INTEGER AS total_leads,
    COUNT(DISTINCT tl.instance_id)::INTEGER AS active_instances,
    COUNT(DISTINCT cs.id)::INTEGER AS charter_signers,
    COALESCE(MAX(si.metadata->>'transparency_score')::INTEGER, 0) AS best_score
  FROM transparency_leads tl
  LEFT JOIN charter_signatures cs ON cs.lead_id = tl.id
  LEFT JOIN saas_instances si ON si.id = tl.instance_id
  WHERE tl.status != 'duplicate'
  GROUP BY tl.commune_name, tl.commune_insee
  ORDER BY COUNT(DISTINCT tl.id) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Commentaires
COMMENT ON TABLE transparency_leads IS 'Leads collectés via la landing page transparence';
COMMENT ON TABLE charter_signatures IS 'Signatures de la charte transparence avec audit trail';
COMMENT ON TABLE lead_interactions IS 'Historique des interactions avec les leads';
COMMENT ON VIEW transparency_leads_dashboard IS 'Tableau de bord agrégé des leads';
