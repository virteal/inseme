-- ============================================================================
-- MIGRATION: Permettre le vote blanc (null) dans Kudocracy
-- Date: 2025-11-20
-- Description: Modification de la colonne vote_value pour accepter NULL
--              NULL = vote blanc, TRUE = pour, FALSE = contre
-- ============================================================================

-- Retirer la contrainte NOT NULL sur vote_value pour permettre le vote blanc
ALTER TABLE votes 
  ALTER COLUMN vote_value DROP NOT NULL;

-- Ajouter un commentaire pour documenter les valeurs possibles
COMMENT ON COLUMN votes.vote_value IS 'Vote value: true = approve, false = disapprove, null = blank vote';

-- Note: Les policies RLS existantes restent inchangées
-- Note: Les index existants restent valides
