-- ============================================================
-- Préfixes de nomenclature configurables par l'artisan
-- Ex: DEV-2026-001, FAC-001, AVN-001, ACP-001
-- ============================================================
ALTER TABLE public.artisan_settings
  ADD COLUMN IF NOT EXISTS devis_prefix    TEXT NOT NULL DEFAULT 'DEV',
  ADD COLUMN IF NOT EXISTS facture_prefix  TEXT NOT NULL DEFAULT 'FAC',
  ADD COLUMN IF NOT EXISTS avenant_prefix  TEXT NOT NULL DEFAULT 'AVN',
  ADD COLUMN IF NOT EXISTS acompte_prefix  TEXT NOT NULL DEFAULT 'ACP';
