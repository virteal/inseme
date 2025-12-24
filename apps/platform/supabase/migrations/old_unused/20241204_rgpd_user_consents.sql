-- Migration: Création de la table user_consents pour le journal des consentements RGPD
-- Conformité RGPD - Article 7 (Conditions du consentement)
-- Date: 2025-12-04

-- ============================================================================
-- TABLE: user_consents
-- Journal auditable de tous les consentements utilisateur
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_consents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,

  -- Type de consentement
  consent_type text NOT NULL CHECK (consent_type IN (
    'rgpd_general',           -- Consentement général RGPD
    'public_profile',         -- Affichage public du profil
    'ia_analysis',            -- Analyse par IA des contributions
    'newsletter',             -- Réception de newsletters
    'notification_email'      -- Notifications par email
  )),

  -- Valeur du consentement
  granted boolean NOT NULL DEFAULT false,

  -- Métadonnées de traçabilité
  consent_version text NOT NULL DEFAULT '1.0',  -- Version du texte de consentement
  consent_text_hash text,                        -- Hash SHA-256 du texte présenté
  source text NOT NULL CHECK (source IN ('web', 'mobile', 'api', 'admin')),

  -- Contexte de collecte
  ip_hash text,                                  -- Hash de l'IP (pas l'IP brute)
  user_agent_category text,                      -- Catégorie simplifiée (mobile/desktop/tablet)

  -- Timestamps
  granted_at timestamp with time zone,
  revoked_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),

  -- Contraintes
  CONSTRAINT user_consents_pkey PRIMARY KEY (id),
  CONSTRAINT user_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,

  -- Un seul enregistrement actif par type de consentement par utilisateur
  CONSTRAINT user_consents_unique_active UNIQUE (user_id, consent_type)
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_user_consents_user_id ON public.user_consents(user_id);
CREATE INDEX IF NOT EXISTS idx_user_consents_type ON public.user_consents(consent_type);
CREATE INDEX IF NOT EXISTS idx_user_consents_granted ON public.user_consents(granted) WHERE granted = true;

-- ============================================================================
-- TABLE: consent_audit_log
-- Historique complet des changements de consentement (append-only)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.consent_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,  -- Nullable pour permettre ON DELETE SET NULL
  consent_type text NOT NULL,

  -- Ancien et nouveau statut
  previous_value boolean,
  new_value boolean NOT NULL,

  -- Contexte
  change_reason text,
  consent_version text NOT NULL,
  source text NOT NULL,

  -- Timestamp immuable
  changed_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT consent_audit_log_pkey PRIMARY KEY (id),
  CONSTRAINT consent_audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL
);

-- Index pour l'audit
CREATE INDEX IF NOT EXISTS idx_consent_audit_user_id ON public.consent_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_consent_audit_changed_at ON public.consent_audit_log(changed_at DESC);

-- ============================================================================
-- FONCTION: Trigger BEFORE pour mettre à jour les timestamps
-- ============================================================================

CREATE OR REPLACE FUNCTION update_consent_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();

  -- Si le consentement est révoqué, enregistrer la date
  IF NEW.granted = false AND OLD.granted = true THEN
    NEW.revoked_at = now();
  END IF;

  -- Si le consentement est accordé, enregistrer la date
  IF NEW.granted = true AND (OLD.granted = false OR OLD.granted IS NULL) THEN
    NEW.granted_at = now();
    NEW.revoked_at = NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FONCTION: Trigger AFTER pour auditer les changements de consentement
-- ============================================================================

CREATE OR REPLACE FUNCTION log_consent_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Log le changement dans la table d'audit
  INSERT INTO public.consent_audit_log (
    user_id,
    consent_type,
    previous_value,
    new_value,
    consent_version,
    source,
    change_reason
  ) VALUES (
    COALESCE(NEW.user_id, OLD.user_id),
    COALESCE(NEW.consent_type, OLD.consent_type),
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.granted END,
    CASE WHEN TG_OP = 'DELETE' THEN false ELSE NEW.granted END,
    COALESCE(NEW.consent_version, OLD.consent_version, '1.0'),
    COALESCE(NEW.source, OLD.source, 'system'),
    CASE
      WHEN TG_OP = 'INSERT' THEN 'Initial consent'
      WHEN TG_OP = 'DELETE' THEN 'Consent record deleted'
      WHEN TG_OP = 'UPDATE' AND NEW.granted != OLD.granted THEN
        CASE WHEN NEW.granted THEN 'Consent granted' ELSE 'Consent revoked' END
      ELSE 'Consent updated'
    END
  );

  RETURN NULL;  -- AFTER trigger, retour ignoré
END;
$$ LANGUAGE plpgsql;

-- Trigger BEFORE pour les timestamps
DROP TRIGGER IF EXISTS trigger_consent_timestamps ON public.user_consents;
CREATE TRIGGER trigger_consent_timestamps
  BEFORE UPDATE ON public.user_consents
  FOR EACH ROW
  EXECUTE FUNCTION update_consent_timestamps();

-- Trigger AFTER pour l'audit
DROP TRIGGER IF EXISTS trigger_consent_audit ON public.user_consents;
CREATE TRIGGER trigger_consent_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.user_consents
  FOR EACH ROW
  EXECUTE FUNCTION log_consent_change();

-- ============================================================================
-- RLS (Row Level Security)
-- ============================================================================

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_audit_log ENABLE ROW LEVEL SECURITY;

-- Politique: Les utilisateurs peuvent voir et modifier leurs propres consentements
CREATE POLICY "Users can manage own consents" ON public.user_consents
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Politique: Les utilisateurs peuvent voir leur historique de consentement
CREATE POLICY "Users can view own consent history" ON public.consent_audit_log
  FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================================
-- COMMENTAIRES
-- ============================================================================

COMMENT ON TABLE public.user_consents IS 'Journal des consentements RGPD - Article 7';
COMMENT ON TABLE public.consent_audit_log IS 'Historique immuable des changements de consentement';
COMMENT ON COLUMN public.user_consents.consent_version IS 'Version du texte de consentement présenté à l''utilisateur';
COMMENT ON COLUMN public.user_consents.consent_text_hash IS 'Hash SHA-256 du texte exact présenté pour preuve';
COMMENT ON COLUMN public.user_consents.ip_hash IS 'Hash de l''IP (pas l''IP brute) pour prévention des fraudes';

-- ============================================================================
-- MIGRATION DES DONNÉES: Synchroniser l'ancien système avec le nouveau
-- Les colonnes users.rgpd_consent_accepted et users.rgpd_consent_date
-- sont migrées vers user_consents.rgpd_general
-- ============================================================================

INSERT INTO public.user_consents (user_id, consent_type, granted, granted_at, source, consent_version)
SELECT
  id,
  'rgpd_general',
  COALESCE(rgpd_consent_accepted, false),
  rgpd_consent_date,
  'web',
  '1.0'
FROM public.users
WHERE rgpd_consent_accepted IS NOT NULL
ON CONFLICT (user_id, consent_type) DO NOTHING;

-- Note: Les anciennes colonnes users.rgpd_consent_accepted et users.rgpd_consent_date
-- sont conservées pour rétrocompatibilité. Elles peuvent être supprimées ultérieurement
-- après vérification que tout fonctionne correctement.
