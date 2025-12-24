-- ============================================================================
-- Migration: Civic Acts Control System - Phase 5: RAG Integration
-- Description: Views for RAG ingestion, synthetic text generation,
--              and statistics views for transparency dashboards
-- Version: 1.0.0
-- Date: 2024-12-04
-- Depends on: 20251204_001_civic_acts_core.sql, 20251204_002_civic_acts_deadlines.sql
-- ============================================================================

-- ============================================================================
-- SECTION 1: RAG DOCUMENT TABLE (Dedicated for civic acts)
-- ============================================================================

-- Index type for RAG separation
CREATE TYPE rag_index_type AS ENUM (
  'PEDAGOGIQUE',  -- Laws, guides, templates
  'PROBATOIRE'    -- Acts, proofs, case data
);

-- Source types for RAG documents
CREATE TYPE rag_source_type AS ENUM (
  'ACTE',
  'DEMANDE',
  'RECOURS',
  'TEXTE_LOI',
  'GUIDE',
  'JURISPRUDENCE',
  'CAS_PRATIQUE',
  'MODELE'
);

CREATE TABLE public.civic_rag_document (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source reference
  source_type rag_source_type NOT NULL,
  source_id uuid, -- Link to acte, demande, etc.
  collectivite_id uuid REFERENCES public.collectivite(id) ON DELETE SET NULL,

  -- Content
  title text NOT NULL,
  content text NOT NULL,
  summary text, -- Optional short summary

  -- Classification
  index_type rag_index_type NOT NULL DEFAULT 'PROBATOIRE',
  domain text, -- finances, urbanisme, etc.
  keywords text[],

  -- Metadata for filtering
  metadata jsonb NOT NULL DEFAULT '{"schemaVersion": 1}'::jsonb,
  -- metadata.type_acte
  -- metadata.dates: { acte, seance, transmission }
  -- metadata.statut_juridique
  -- metadata.collectivite_nom
  -- metadata.base_legale (for laws)

  -- Embedding (vector for similarity search)
  embedding vector(1536), -- OpenAI text-embedding-3-small dimension

  -- Versioning
  is_current boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  supersedes_id uuid REFERENCES public.civic_rag_document(id),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_civic_rag_source ON public.civic_rag_document(source_type, source_id);
CREATE INDEX idx_civic_rag_collectivite ON public.civic_rag_document(collectivite_id) WHERE collectivite_id IS NOT NULL;
CREATE INDEX idx_civic_rag_current ON public.civic_rag_document(is_current) WHERE is_current = true;
CREATE INDEX idx_civic_rag_index_type ON public.civic_rag_document(index_type);
CREATE INDEX idx_civic_rag_domain ON public.civic_rag_document(domain) WHERE domain IS NOT NULL;

-- Vector similarity search index (HNSW for better performance)
CREATE INDEX idx_civic_rag_embedding ON public.civic_rag_document
  USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;

-- GIN index for keywords array
CREATE INDEX idx_civic_rag_keywords ON public.civic_rag_document USING GIN (keywords);

-- Trigger for updated_at
CREATE TRIGGER set_civic_rag_document_updated_at
  BEFORE UPDATE ON public.civic_rag_document
  FOR EACH ROW EXECUTE FUNCTION civic_set_updated_at();

-- RLS
ALTER TABLE public.civic_rag_document ENABLE ROW LEVEL SECURITY;

CREATE POLICY civic_rag_document_select ON public.civic_rag_document
  FOR SELECT USING (true);

CREATE POLICY civic_rag_document_insert ON public.civic_rag_document
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.civic_user_profile
      WHERE id = auth.uid() AND role IN ('ADMIN_SYSTEM', 'LEGAL_REVIEWER')
    )
  );

CREATE POLICY civic_rag_document_update ON public.civic_rag_document
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.civic_user_profile
      WHERE id = auth.uid() AND role IN ('ADMIN_SYSTEM', 'LEGAL_REVIEWER')
    )
  );

COMMENT ON TABLE public.civic_rag_document IS 'RAG documents for civic acts with versioning and two-index separation';

-- ============================================================================
-- SECTION 2: COMPREHENSIVE SYNTHETIC VIEW FOR ACTES
-- ============================================================================

CREATE OR REPLACE VIEW public.v_actes_synthetiques AS
SELECT
  a.id,
  a.collectivite_id,
  c.nom_officiel AS collectivite_nom,
  c.code_insee AS collectivite_code,

  -- Act identification
  a.type_acte,
  a.numero_interne,
  a.numero_actes,
  a.date_acte,
  a.date_seance,
  a.objet_court,
  a.objet_complet,
  a.organe,
  a.rapporteur,

  -- Execution status
  a.exec_declared,
  a.exec_declared_date,
  a.exec_confirmed,
  a.exec_confirmed_date,

  -- Transmission info
  t.id AS teletransmission_id,
  t.date_declared AS transmission_declared,
  t.date_confirmed AS transmission_confirmed,
  t.statut_technique AS transmission_statut,
  t.numero_ctes,

  -- Current legal status
  ls.status_code AS statut_juridique,
  ls.date_debut AS statut_depuis,
  ls.justification AS statut_justification,

  -- Deadlines summary
  (
    SELECT COUNT(*)
    FROM public.deadline_instance di
    WHERE di.entity_type = 'ACTE' AND di.entity_id = a.id
  ) AS nb_deadlines_total,
  (
    SELECT COUNT(*)
    FROM public.deadline_instance di
    WHERE di.entity_type = 'ACTE' AND di.entity_id = a.id AND di.status = 'OUVERTE'
  ) AS nb_deadlines_ouvertes,
  (
    SELECT COUNT(*)
    FROM public.deadline_instance di
    WHERE di.entity_type = 'ACTE' AND di.entity_id = a.id AND di.status = 'DEPASSEE'
  ) AS nb_deadlines_depassees,

  -- Demandes summary
  (
    SELECT COUNT(*)
    FROM public.demande_admin d
    WHERE d.acte_id = a.id
  ) AS nb_demandes,
  (
    SELECT COUNT(*)
    FROM public.demande_admin d
    WHERE d.acte_id = a.id AND d.status = 'EN_ATTENTE'
  ) AS nb_demandes_en_attente,

  -- Proofs summary
  (
    SELECT COUNT(*)
    FROM public.proof_link pl
    WHERE pl.entity_type = 'ACTE' AND pl.entity_id = a.id
  ) AS nb_preuves,
  (
    SELECT COUNT(*)
    FROM public.proof_link pl
    JOIN public.proof p ON pl.proof_id = p.id
    WHERE pl.entity_type = 'ACTE' AND pl.entity_id = a.id AND p.verified_by_human = true
  ) AS nb_preuves_verifiees,

  -- Metadata
  a.metadata,
  a.metadata->>'montant_eur' AS montant_eur,
  a.metadata->'votes' AS votes,
  a.metadata->'keywords' AS keywords_json,
  a.metadata->>'domaine' AS domaine,

  -- Version info
  a.version,
  a.valid_from,
  a.supersedes_id,
  a.created_at,
  a.updated_at,

  -- Synthetic text for RAG ingestion
  format(
    E'%s — %s n°%s du %s\n\nObjet : %s\n\nCollectivité : %s (%s)\nOrgane : %s\nRapporteur : %s\n\nTransmission préfecture : %s\nStatut technique : %s\nNuméro @CTES : %s\n\nStatut juridique : %s (depuis %s)\n\nDemandes administratives liées : %s\nDélais dépassés : %s\n\n%s',
    -- Header
    COALESCE(a.type_acte::text, 'ACTE'),
    COALESCE(a.type_acte::text, 'Acte'),
    COALESCE(a.numero_interne, a.numero_actes, 'N/A'),
    COALESCE(a.date_acte::text, 'date inconnue'),
    -- Objet
    COALESCE(a.objet_complet, a.objet_court, 'Objet non renseigné'),
    -- Collectivite
    c.nom_officiel,
    c.code_insee,
    COALESCE(a.organe, 'Non précisé'),
    COALESCE(a.rapporteur, 'Non précisé'),
    -- Transmission
    CASE
      WHEN t.date_confirmed IS NOT NULL THEN format('Confirmée le %s', t.date_confirmed::text)
      WHEN t.date_declared IS NOT NULL THEN format('Déclarée le %s (non confirmée)', t.date_declared::text)
      ELSE 'Non transmis ou inconnu'
    END,
    COALESCE(t.statut_technique::text, 'INCONNU'),
    COALESCE(t.numero_ctes, 'N/A'),
    -- Legal status
    COALESCE(ls.status_code::text, 'NON_DEFINI'),
    COALESCE(ls.date_debut::text, '-'),
    -- Counts
    (SELECT COUNT(*) FROM public.demande_admin d WHERE d.acte_id = a.id)::text,
    (SELECT COUNT(*) FROM public.deadline_instance di WHERE di.entity_type = 'ACTE' AND di.entity_id = a.id AND di.status = 'DEPASSEE')::text,
    -- Extended content
    COALESCE(a.objet_complet, '')
  ) AS synthetic_text

FROM public.acte a
JOIN public.collectivite c ON a.collectivite_id = c.id
LEFT JOIN public.teletransmission t ON t.acte_id = a.id
LEFT JOIN LATERAL (
  SELECT lsi.*
  FROM public.legal_status_instance lsi
  WHERE lsi.entity_type = 'ACTE'
    AND lsi.entity_id = a.id
    AND lsi.date_fin IS NULL
  ORDER BY lsi.date_debut DESC
  LIMIT 1
) ls ON true
WHERE a.valid_to IS NULL;

COMMENT ON VIEW public.v_actes_synthetiques IS 'Comprehensive view of current actes with synthetic text for RAG ingestion';

-- ============================================================================
-- SECTION 3: STATISTICS VIEWS FOR TRANSPARENCY DASHBOARDS
-- ============================================================================

-- Transmission statistics by collectivity
CREATE OR REPLACE VIEW public.v_stats_transmission AS
SELECT
  c.id AS collectivite_id,
  c.nom_officiel AS collectivite,
  c.code_insee,

  -- Total counts
  COUNT(a.id) AS total_actes,

  -- Transmission status
  COUNT(t.id) FILTER (WHERE t.date_confirmed IS NOT NULL) AS transmis_confirmes,
  COUNT(t.id) FILTER (WHERE t.date_declared IS NOT NULL AND t.date_confirmed IS NULL) AS transmis_declares_non_confirmes,
  COUNT(a.id) FILTER (WHERE t.id IS NULL) AS non_transmis,
  COUNT(t.id) FILTER (WHERE t.statut_technique = 'REJETE') AS rejetes,

  -- Rates (as percentages)
  CASE WHEN COUNT(a.id) > 0
    THEN ROUND(100.0 * COUNT(t.id) FILTER (WHERE t.date_confirmed IS NOT NULL) / COUNT(a.id), 1)
    ELSE 0
  END AS taux_transmission_confirmee,

  -- Timing
  AVG(
    CASE WHEN t.date_confirmed IS NOT NULL
      THEN t.date_confirmed - a.date_acte
    END
  )::integer AS delai_moyen_transmission_jours,

  -- By year breakdown
  COUNT(a.id) FILTER (WHERE EXTRACT(YEAR FROM a.date_acte) = EXTRACT(YEAR FROM CURRENT_DATE)) AS actes_annee_courante,
  COUNT(t.id) FILTER (WHERE t.date_confirmed IS NOT NULL AND EXTRACT(YEAR FROM a.date_acte) = EXTRACT(YEAR FROM CURRENT_DATE)) AS transmis_annee_courante

FROM public.collectivite c
LEFT JOIN public.acte a ON a.collectivite_id = c.id AND a.valid_to IS NULL
LEFT JOIN public.teletransmission t ON t.acte_id = a.id
GROUP BY c.id, c.nom_officiel, c.code_insee;

COMMENT ON VIEW public.v_stats_transmission IS 'Transmission statistics aggregated by collectivity';

-- CRPA/Administrative request statistics
CREATE OR REPLACE VIEW public.v_stats_crpa AS
SELECT
  c.id AS collectivite_id,
  c.nom_officiel AS collectivite,

  -- Total counts
  COUNT(d.id) AS total_demandes,
  COUNT(d.id) FILTER (WHERE d.type_demande = 'CRPA') AS demandes_crpa,

  -- Status breakdown
  COUNT(d.id) FILTER (WHERE d.status = 'EN_ATTENTE') AS en_attente,
  COUNT(d.id) FILTER (WHERE d.status = 'REPONDU_COMPLET') AS repondu_complet,
  COUNT(d.id) FILTER (WHERE d.status = 'REPONDU_PARTIEL') AS repondu_partiel,
  COUNT(d.id) FILTER (WHERE d.status = 'REFUS_EXPLICITE') AS refus_explicite,
  COUNT(d.id) FILTER (WHERE d.status = 'REFUS_IMPLICITE') AS refus_implicite,

  -- Response rates
  CASE WHEN COUNT(d.id) > 0
    THEN ROUND(100.0 * COUNT(d.id) FILTER (WHERE d.status IN ('REPONDU_COMPLET', 'REPONDU_PARTIEL')) / COUNT(d.id), 1)
    ELSE 0
  END AS taux_reponse,

  CASE WHEN COUNT(d.id) > 0
    THEN ROUND(100.0 * COUNT(d.id) FILTER (WHERE d.status = 'REFUS_IMPLICITE') / COUNT(d.id), 1)
    ELSE 0
  END AS taux_refus_implicite,

  -- Response timing (for responded requests)
  AVG(
    CASE WHEN d.status IN ('REPONDU_COMPLET', 'REPONDU_PARTIEL') THEN
      (SELECT MIN(r.date_reception) FROM public.reponse_admin r WHERE r.demande_id = d.id) - d.date_envoi
    END
  )::integer AS delai_moyen_reponse_jours

FROM public.collectivite c
LEFT JOIN public.demande_admin d ON d.collectivite_id = c.id
GROUP BY c.id, c.nom_officiel;

COMMENT ON VIEW public.v_stats_crpa IS 'CRPA and administrative request statistics by collectivity';

-- Recours (appeals) statistics
CREATE OR REPLACE VIEW public.v_stats_recours AS
SELECT
  c.id AS collectivite_id,
  c.nom_officiel AS collectivite,

  -- By type
  COUNT(r.id) AS total_recours,
  COUNT(r.id) FILTER (WHERE r.type = 'CADA') AS recours_cada,
  COUNT(r.id) FILTER (WHERE r.type = 'GRACIEUX') AS recours_gracieux,
  COUNT(r.id) FILTER (WHERE r.type = 'TA') AS recours_ta,

  -- By status
  COUNT(r.id) FILTER (WHERE r.status IN ('EN_PREPARATION', 'ENVOYE', 'EN_COURS', 'INSTRUCTION')) AS en_cours,
  COUNT(r.id) FILTER (WHERE r.status IN ('AVIS_RENDU', 'JUGEMENT_RENDU', 'CLOS')) AS termines,

  -- By outcome
  COUNT(r.id) FILTER (WHERE r.issue = 'FAVORABLE') AS favorables,
  COUNT(r.id) FILTER (WHERE r.issue = 'DEFAVORABLE') AS defavorables,
  COUNT(r.id) FILTER (WHERE r.issue = 'MIXTE') AS mixtes,

  -- Success rate
  CASE WHEN COUNT(r.id) FILTER (WHERE r.issue IS NOT NULL) > 0
    THEN ROUND(100.0 * COUNT(r.id) FILTER (WHERE r.issue IN ('FAVORABLE', 'MIXTE')) /
               COUNT(r.id) FILTER (WHERE r.issue IS NOT NULL), 1)
    ELSE 0
  END AS taux_succes

FROM public.collectivite c
LEFT JOIN public.recours r ON r.collectivite_id = c.id
GROUP BY c.id, c.nom_officiel;

COMMENT ON VIEW public.v_stats_recours IS 'Appeals (recours) statistics by collectivity';

-- Global transparency score
CREATE OR REPLACE VIEW public.v_transparence_score AS
SELECT
  c.id AS collectivite_id,
  c.nom_officiel AS collectivite,

  -- Individual metrics (0-100)
  COALESCE(ts.taux_transmission_confirmee, 0) AS score_transmission,
  COALESCE(cs.taux_reponse, 0) AS score_reponse_crpa,

  -- Penalty for implicit refusals
  GREATEST(0, 100 - COALESCE(cs.taux_refus_implicite, 0) * 2) AS score_non_silence,

  -- Combined score (weighted average)
  ROUND(
    (COALESCE(ts.taux_transmission_confirmee, 0) * 0.4 +
     COALESCE(cs.taux_reponse, 0) * 0.4 +
     GREATEST(0, 100 - COALESCE(cs.taux_refus_implicite, 0) * 2) * 0.2
    ), 1
  ) AS score_global,

  -- Activity indicators
  ts.total_actes,
  cs.total_demandes,
  rs.total_recours

FROM public.collectivite c
LEFT JOIN public.v_stats_transmission ts ON ts.collectivite_id = c.id
LEFT JOIN public.v_stats_crpa cs ON cs.collectivite_id = c.id
LEFT JOIN public.v_stats_recours rs ON rs.collectivite_id = c.id;

COMMENT ON VIEW public.v_transparence_score IS 'Composite transparency score by collectivity';

-- ============================================================================
-- SECTION 4: HELPER FUNCTIONS FOR RAG SYNC
-- ============================================================================

-- Function to generate or update RAG document for an acte
CREATE OR REPLACE FUNCTION sync_acte_to_rag(p_acte_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_synth record;
  v_doc_id uuid;
  v_existing_id uuid;
BEGIN
  -- Get synthetic data
  SELECT * INTO v_synth
  FROM public.v_actes_synthetiques
  WHERE id = p_acte_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acte % not found in synthetic view', p_acte_id;
  END IF;

  -- Check for existing current document
  SELECT id INTO v_existing_id
  FROM public.civic_rag_document
  WHERE source_type = 'ACTE'
    AND source_id = p_acte_id
    AND is_current = true;

  -- If exists, mark as not current
  IF v_existing_id IS NOT NULL THEN
    UPDATE public.civic_rag_document
    SET is_current = false,
        updated_at = now()
    WHERE id = v_existing_id;
  END IF;

  -- Insert new document
  INSERT INTO public.civic_rag_document (
    source_type,
    source_id,
    collectivite_id,
    title,
    content,
    summary,
    index_type,
    domain,
    keywords,
    metadata,
    is_current,
    version,
    supersedes_id
  ) VALUES (
    'ACTE',
    p_acte_id,
    v_synth.collectivite_id,
    format('%s n°%s — %s', v_synth.type_acte, COALESCE(v_synth.numero_interne, 'N/A'), v_synth.objet_court),
    v_synth.synthetic_text,
    v_synth.objet_court,
    'PROBATOIRE',
    v_synth.domaine,
    CASE WHEN v_synth.keywords_json IS NOT NULL
      THEN ARRAY(SELECT jsonb_array_elements_text(v_synth.keywords_json))
      ELSE NULL
    END,
    jsonb_build_object(
      'type_acte', v_synth.type_acte,
      'date_acte', v_synth.date_acte,
      'date_seance', v_synth.date_seance,
      'collectivite_nom', v_synth.collectivite_nom,
      'collectivite_code', v_synth.collectivite_code,
      'statut_juridique', v_synth.statut_juridique,
      'transmission_confirmee', v_synth.transmission_confirmed IS NOT NULL,
      'nb_demandes', v_synth.nb_demandes,
      'nb_deadlines_depassees', v_synth.nb_deadlines_depassees,
      'schemaVersion', 1
    ),
    true,
    COALESCE(
      (SELECT version + 1 FROM public.civic_rag_document WHERE id = v_existing_id),
      1
    ),
    v_existing_id
  ) RETURNING id INTO v_doc_id;

  RETURN v_doc_id;
END;
$$;

COMMENT ON FUNCTION sync_acte_to_rag IS 'Generates or updates RAG document for an acte, preserving version history';

-- Function to sync all modified actes since a given date
CREATE OR REPLACE FUNCTION sync_modified_actes_to_rag(p_since timestamptz DEFAULT now() - INTERVAL '1 day')
RETURNS TABLE(acte_id uuid, rag_doc_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_acte record;
  v_doc_id uuid;
BEGIN
  FOR v_acte IN
    SELECT id
    FROM public.acte
    WHERE valid_to IS NULL
      AND updated_at >= p_since
  LOOP
    v_doc_id := sync_acte_to_rag(v_acte.id);
    RETURN QUERY SELECT v_acte.id, v_doc_id;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION sync_modified_actes_to_rag IS 'Syncs all actes modified since given timestamp to RAG documents';

-- ============================================================================
-- SECTION 5: MONTHLY STATISTICS SNAPSHOT TABLE
-- ============================================================================

CREATE TABLE public.civic_stats_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collectivite_id uuid NOT NULL REFERENCES public.collectivite(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL,
  snapshot_type text NOT NULL CHECK (snapshot_type IN ('MONTHLY', 'QUARTERLY', 'YEARLY')),

  -- Transmission stats
  total_actes integer NOT NULL DEFAULT 0,
  transmis_confirmes integer NOT NULL DEFAULT 0,
  taux_transmission numeric(5,2),
  delai_moyen_transmission integer,

  -- CRPA stats
  total_demandes integer NOT NULL DEFAULT 0,
  demandes_repondues integer NOT NULL DEFAULT 0,
  refus_implicites integer NOT NULL DEFAULT 0,
  taux_reponse numeric(5,2),
  delai_moyen_reponse integer,

  -- Recours stats
  total_recours integer NOT NULL DEFAULT 0,
  recours_favorables integer NOT NULL DEFAULT 0,
  taux_succes_recours numeric(5,2),

  -- Global score
  score_transparence numeric(5,2),

  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT civic_stats_snapshot_unique UNIQUE (collectivite_id, snapshot_date, snapshot_type)
);

CREATE INDEX idx_civic_stats_snapshot_collectivite ON public.civic_stats_snapshot(collectivite_id);
CREATE INDEX idx_civic_stats_snapshot_date ON public.civic_stats_snapshot(snapshot_date DESC);

-- RLS
ALTER TABLE public.civic_stats_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY civic_stats_snapshot_select ON public.civic_stats_snapshot
  FOR SELECT USING (true);

CREATE POLICY civic_stats_snapshot_insert ON public.civic_stats_snapshot
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.civic_user_profile
      WHERE id = auth.uid() AND role IN ('ADMIN_SYSTEM')
    )
  );

COMMENT ON TABLE public.civic_stats_snapshot IS 'Historical snapshots of transparency statistics for trend analysis';

-- Function to create monthly snapshot
CREATE OR REPLACE FUNCTION create_monthly_stats_snapshot()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_snapshot_date date := date_trunc('month', CURRENT_DATE)::date;
  v_count integer := 0;
  v_score record;
BEGIN
  FOR v_score IN
    SELECT
      ts.collectivite_id,
      ts.total_actes,
      ts.transmis_confirmes,
      ts.taux_transmission_confirmee,
      ts.delai_moyen_transmission_jours,
      cs.total_demandes,
      cs.repondu_complet + cs.repondu_partiel AS demandes_repondues,
      cs.refus_implicite AS refus_implicites,
      cs.taux_reponse,
      cs.delai_moyen_reponse_jours,
      rs.total_recours,
      rs.favorables AS recours_favorables,
      rs.taux_succes AS taux_succes_recours,
      sc.score_global
    FROM public.v_transparence_score sc
    LEFT JOIN public.v_stats_transmission ts ON ts.collectivite_id = sc.collectivite_id
    LEFT JOIN public.v_stats_crpa cs ON cs.collectivite_id = sc.collectivite_id
    LEFT JOIN public.v_stats_recours rs ON rs.collectivite_id = sc.collectivite_id
  LOOP
    INSERT INTO public.civic_stats_snapshot (
      collectivite_id, snapshot_date, snapshot_type,
      total_actes, transmis_confirmes, taux_transmission, delai_moyen_transmission,
      total_demandes, demandes_repondues, refus_implicites, taux_reponse, delai_moyen_reponse,
      total_recours, recours_favorables, taux_succes_recours,
      score_transparence
    ) VALUES (
      v_score.collectivite_id, v_snapshot_date, 'MONTHLY',
      COALESCE(v_score.total_actes, 0),
      COALESCE(v_score.transmis_confirmes, 0),
      v_score.taux_transmission_confirmee,
      v_score.delai_moyen_transmission_jours,
      COALESCE(v_score.total_demandes, 0),
      COALESCE(v_score.demandes_repondues, 0),
      COALESCE(v_score.refus_implicites, 0),
      v_score.taux_reponse,
      v_score.delai_moyen_reponse_jours,
      COALESCE(v_score.total_recours, 0),
      COALESCE(v_score.recours_favorables, 0),
      v_score.taux_succes_recours,
      v_score.score_global
    )
    ON CONFLICT (collectivite_id, snapshot_date, snapshot_type)
    DO UPDATE SET
      total_actes = EXCLUDED.total_actes,
      transmis_confirmes = EXCLUDED.transmis_confirmes,
      taux_transmission = EXCLUDED.taux_transmission,
      delai_moyen_transmission = EXCLUDED.delai_moyen_transmission,
      total_demandes = EXCLUDED.total_demandes,
      demandes_repondues = EXCLUDED.demandes_repondues,
      refus_implicites = EXCLUDED.refus_implicites,
      taux_reponse = EXCLUDED.taux_reponse,
      delai_moyen_reponse = EXCLUDED.delai_moyen_reponse,
      total_recours = EXCLUDED.total_recours,
      recours_favorables = EXCLUDED.recours_favorables,
      taux_succes_recours = EXCLUDED.taux_succes_recours,
      score_transparence = EXCLUDED.score_transparence;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION create_monthly_stats_snapshot IS 'Creates monthly statistics snapshot for all collectivities';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
