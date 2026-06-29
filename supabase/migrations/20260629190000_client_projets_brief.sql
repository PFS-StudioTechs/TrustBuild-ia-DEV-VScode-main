-- ================================================================
-- TrustBuild-IA — Enrichissement client_projets pour brief de cadrage
-- Table modifiée : client_projets (existante)
-- RLS non modifiée : les nouvelles colonnes héritent du verrouillage
-- auth_user_id = auth.uid() des 4 policies existantes (cp_select/insert/update/delete).
-- ================================================================

ALTER TABLE public.client_projets
  ADD COLUMN IF NOT EXISTS statut       TEXT  NOT NULL DEFAULT 'cadrage'
    CONSTRAINT client_projets_statut_check
      CHECK (statut IN ('cadrage', 'en_relation', 'clos')),
  ADD COLUMN IF NOT EXISTS description  TEXT  NULL,
  ADD COLUMN IF NOT EXISTS localisation TEXT  NULL,
  ADD COLUMN IF NOT EXISTS brief_data   JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_client_projets_statut
  ON public.client_projets(statut);

-- ROLLBACK
-- DROP INDEX  IF EXISTS idx_client_projets_statut;
-- ALTER TABLE public.client_projets
--   DROP COLUMN IF EXISTS statut,
--   DROP COLUMN IF EXISTS description,
--   DROP COLUMN IF EXISTS localisation,
--   DROP COLUMN IF EXISTS brief_data;
