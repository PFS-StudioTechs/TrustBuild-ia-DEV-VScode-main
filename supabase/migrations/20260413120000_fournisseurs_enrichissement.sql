-- Enrichissement de la table fournisseurs
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'fournisseurs' AND column_name = 'contact') THEN
    ALTER TABLE public.fournisseurs RENAME COLUMN contact TO nom_contact;
  END IF;
END $$;

ALTER TABLE public.fournisseurs
  ADD COLUMN IF NOT EXISTS email      TEXT,
  ADD COLUMN IF NOT EXISTS telephone  TEXT,
  ADD COLUMN IF NOT EXISTS adresse    TEXT,
  ADD COLUMN IF NOT EXISTS siret      TEXT,
  ADD COLUMN IF NOT EXISTS categorie  TEXT,
  ADD COLUMN IF NOT EXISTS notes      TEXT;
