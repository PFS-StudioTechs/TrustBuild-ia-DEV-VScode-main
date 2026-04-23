-- ============================================================
-- KBIS : champs sur profiles + mise à jour du trigger
-- Règle : 6 mois pour soumettre le KBIS, rappel à 5 mois
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS kbis_url          TEXT,
  ADD COLUMN IF NOT EXISTS kbis_uploaded_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS kbis_deadline     TIMESTAMPTZ;

-- Nouveaux comptes → deadline 6 mois
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nom, prenom, kbis_deadline)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nom', ''),
    COALESCE(NEW.raw_user_meta_data->>'prenom', ''),
    now() + interval '6 months'
  );
  RETURN NEW;
END;
$$;
