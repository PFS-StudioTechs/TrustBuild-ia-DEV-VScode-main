-- Contrainte d'unicité sur le SIRET : un établissement = un seul compte artisan
-- Les valeurs NULL (profil non encore complété) sont autorisées en multiple
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_siret_unique'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_siret_unique UNIQUE (siret);
  END IF;
END $$;
