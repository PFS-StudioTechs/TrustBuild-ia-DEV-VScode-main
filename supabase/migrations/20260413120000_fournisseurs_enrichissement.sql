-- Enrichissement de la table fournisseurs
ALTER TABLE public.fournisseurs RENAME COLUMN contact TO nom_contact;

ALTER TABLE public.fournisseurs
  ADD COLUMN IF NOT EXISTS email      TEXT,
  ADD COLUMN IF NOT EXISTS telephone  TEXT,
  ADD COLUMN IF NOT EXISTS adresse    TEXT,
  ADD COLUMN IF NOT EXISTS siret      TEXT,
  ADD COLUMN IF NOT EXISTS categorie  TEXT,
  ADD COLUMN IF NOT EXISTS notes      TEXT;
