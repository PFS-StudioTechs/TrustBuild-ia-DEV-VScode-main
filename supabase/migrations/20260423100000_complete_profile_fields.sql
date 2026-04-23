-- Ajout des champs entreprise récupérés via API INSEE lors de la complétion du profil
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS raison_sociale   TEXT,
  ADD COLUMN IF NOT EXISTS nom_commercial   TEXT,
  ADD COLUMN IF NOT EXISTS adresse          TEXT,
  ADD COLUMN IF NOT EXISTS code_postal      TEXT,
  ADD COLUMN IF NOT EXISTS ville            TEXT,
  ADD COLUMN IF NOT EXISTS pays             TEXT DEFAULT 'France',
  ADD COLUMN IF NOT EXISTS activite         TEXT,
  ADD COLUMN IF NOT EXISTS forme_juridique  TEXT,
  ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN NOT NULL DEFAULT FALSE;

-- Les profils existants (comptes dev/test) sont considérés comme déjà complétés
UPDATE public.profiles SET profile_completed = true;
