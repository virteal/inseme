-- ============================================
-- Table de versioning du schéma
-- À appliquer sur CHAQUE instance Supabase
-- ============================================

-- Table pour tracker les migrations appliquées
CREATE TABLE IF NOT EXISTS schema_migrations (
  id SERIAL PRIMARY KEY,
  version VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  checksum VARCHAR(64),
  execution_time_ms INTEGER,
  applied_by VARCHAR(100) DEFAULT 'system'
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_schema_migrations_version ON schema_migrations(version);
CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at ON schema_migrations(applied_at);

-- Table pour la version courante (lecture rapide)
CREATE TABLE IF NOT EXISTS schema_version (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- Une seule ligne
  current_version VARCHAR(50) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  instance_id VARCHAR(50),
  CONSTRAINT single_row CHECK (id = 1)
);

-- Insérer la version initiale
INSERT INTO schema_version (current_version, instance_id)
VALUES ('0.0.0', 'unknown')
ON CONFLICT (id) DO NOTHING;

-- Fonction pour enregistrer une migration
CREATE OR REPLACE FUNCTION register_migration(
  p_version VARCHAR(50),
  p_name VARCHAR(255),
  p_checksum VARCHAR(64) DEFAULT NULL,
  p_execution_time_ms INTEGER DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  -- Insérer la migration
  INSERT INTO schema_migrations (version, name, checksum, execution_time_ms)
  VALUES (p_version, p_name, p_checksum, p_execution_time_ms)
  ON CONFLICT (version) DO UPDATE SET
    applied_at = NOW(),
    checksum = COALESCE(EXCLUDED.checksum, schema_migrations.checksum);

  -- Mettre à jour la version courante
  UPDATE schema_version
  SET current_version = p_version, updated_at = NOW()
  WHERE id = 1;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour obtenir la version courante
CREATE OR REPLACE FUNCTION get_schema_version()
RETURNS TABLE(
  current_version VARCHAR(50),
  updated_at TIMESTAMPTZ,
  instance_id VARCHAR(50),
  migrations_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sv.current_version,
    sv.updated_at,
    sv.instance_id,
    (SELECT COUNT(*)::INTEGER FROM schema_migrations) as migrations_count
  FROM schema_version sv
  WHERE sv.id = 1;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour lister les migrations manquantes
CREATE OR REPLACE FUNCTION get_pending_migrations(p_all_versions TEXT[])
RETURNS TABLE(version VARCHAR(50)) AS $$
BEGIN
  RETURN QUERY
  SELECT v.version
  FROM unnest(p_all_versions) AS v(version)
  WHERE v.version NOT IN (SELECT sm.version FROM schema_migrations sm)
  ORDER BY v.version;
END;
$$ LANGUAGE plpgsql;

-- RLS : lecture publique, écriture admin seulement
ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_version ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Schema migrations readable by all" ON schema_migrations
  FOR SELECT USING (true);

CREATE POLICY "Schema version readable by all" ON schema_version
  FOR SELECT USING (true);

-- Seul service_role peut écrire
CREATE POLICY "Schema migrations writable by service" ON schema_migrations
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Schema version writable by service" ON schema_version
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- Enregistrer cette migration elle-même
-- ============================================
SELECT register_migration('20251205.001', 'schema_versioning', NULL, NULL);

COMMENT ON TABLE schema_migrations IS 'Historique des migrations SQL appliquées sur cette instance';
COMMENT ON TABLE schema_version IS 'Version courante du schéma (singleton)';
