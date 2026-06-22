-- ============================================================
-- TrustBuild-IA — Fix liaison clients.auth_user_id par email
-- Problème : comparaison email case-sensitive → liaison échoue
--            si artisan saisit email avec majuscules
-- Fix : LOWER() sur les deux triggers + resync données existantes
-- ============================================================

-- 1. Fix trigger handle_new_user (auth → clients) : ajout LOWER()
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type TEXT := COALESCE(NEW.raw_user_meta_data ->> 'account_type', 'artisan');
BEGIN
  IF v_type = 'client' THEN
    INSERT INTO public.profiles (
      user_id, account_type, nom, prenom, adresse, code_postal, ville, telephone,
      profile_completed
    )
    VALUES (
      NEW.id,
      'client',
      COALESCE(NEW.raw_user_meta_data ->> 'nom', ''),
      COALESCE(NEW.raw_user_meta_data ->> 'prenom', ''),
      NEW.raw_user_meta_data ->> 'adresse',
      NEW.raw_user_meta_data ->> 'code_postal',
      NEW.raw_user_meta_data ->> 'ville',
      NEW.raw_user_meta_data ->> 'telephone',
      TRUE
    )
    ON CONFLICT (user_id) DO UPDATE SET
      account_type  = 'client',
      nom           = COALESCE(EXCLUDED.nom, public.profiles.nom),
      prenom        = COALESCE(EXCLUDED.prenom, public.profiles.prenom),
      adresse       = COALESCE(EXCLUDED.adresse, public.profiles.adresse),
      code_postal   = COALESCE(EXCLUDED.code_postal, public.profiles.code_postal),
      ville         = COALESCE(EXCLUDED.ville, public.profiles.ville),
      telephone     = COALESCE(EXCLUDED.telephone, public.profiles.telephone),
      profile_completed = TRUE;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'client')
    ON CONFLICT (user_id, role) DO NOTHING;

    -- Fix : LOWER() des deux côtés pour comparaison insensible à la casse
    UPDATE public.clients
    SET auth_user_id = NEW.id
    WHERE LOWER(email) = LOWER(NEW.email)
      AND auth_user_id IS NULL;

  ELSE
    INSERT INTO public.profiles (user_id, nom, prenom, kbis_deadline)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data ->> 'nom', ''),
      COALESCE(NEW.raw_user_meta_data ->> 'prenom', ''),
      now() + interval '6 months'
    )
    ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'artisan')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Fix trigger link_client_to_auth (clients INSERT → auth) : ajout LOWER()
CREATE OR REPLACE FUNCTION public.link_client_to_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.auth_user_id IS NULL AND NEW.email IS NOT NULL THEN
    SELECT id INTO NEW.auth_user_id
    FROM auth.users
    WHERE LOWER(email) = LOWER(NEW.email)
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Resync des fiches clients existantes non liées
UPDATE public.clients c
SET auth_user_id = u.id
FROM auth.users u
WHERE LOWER(c.email) = LOWER(u.email)
  AND c.auth_user_id IS NULL;
