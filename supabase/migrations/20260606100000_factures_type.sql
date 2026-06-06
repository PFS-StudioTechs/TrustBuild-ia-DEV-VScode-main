-- Ajoute la notion de type sur les factures pour distinguer acompte / situation / solde / standard
ALTER TABLE public.factures
  ADD COLUMN type TEXT NOT NULL DEFAULT 'standard'
  CONSTRAINT factures_type_check CHECK (type IN ('standard', 'acompte', 'situation', 'solde'));

-- Backfill : les factures liées à un avoir existant restent 'standard'
-- Les factures liées à un ts_id restent 'standard'
-- Rien à déduire automatiquement — toutes les factures existantes sont 'standard' par défaut

COMMENT ON COLUMN public.factures.type IS 'standard | acompte | situation | solde';
