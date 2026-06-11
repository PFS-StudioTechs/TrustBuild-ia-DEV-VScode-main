-- ============================================================
-- TrustBuild-IA — Profil CLIENT particulier
-- Ajoute : account_type + telephone sur profiles
--          auth_user_id sur clients (liaison auto par email)
--          rôle 'client' dans app_role + user_roles
--          mise à jour trigger handle_new_user
--          RLS lecture clients/devis/factures/chantiers pour clients
-- ============================================================

-- 1. Rôle 'client' dans l'enum app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'client';

-- 2. Colonnes sur profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'artisan',
  ADD COLUMN IF NOT EXISTS telephone    TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_account_type_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_account_type_check
      CHECK (account_type IN ('artisan','client','fournisseur','architecte'));
  END IF;
END$$;

COMMENT ON COLUMN public.profiles.account_type IS 'Type de compte : artisan (défaut) | client | fournisseur | architecte';
COMMENT ON COLUMN public.profiles.telephone IS 'Téléphone du client particulier (format FR : 06 12 34 56 78)';

-- 3. Liaison auth sur la table clients (artisan crée un client → le client s'inscrit → auto-lien par email)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clients_auth_user ON public.clients(auth_user_id);

-- 4. Contraintes légères clients (validées uniquement pour account_type = 'client')
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_client_tel_check') THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_client_tel_check
      CHECK (
        account_type <> 'client'
        OR telephone IS NULL
        OR regexp_replace(telephone, '\s', '', 'g') ~ '^0[1-9][0-9]{8}$'
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_client_cp_check') THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_client_cp_check
      CHECK (
        account_type <> 'client'
        OR code_postal IS NULL
        OR code_postal ~ '^[0-9]{5}$'
      );
  END IF;
END$$;

-- 5. Trigger handle_new_user — gère account_type client sans KBIS ni SIRET
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
    -- Inscription client : profil complet d'emblée, pas de KBIS
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

    -- Rôle client
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'client')
    ON CONFLICT (user_id, role) DO NOTHING;

    -- Auto-liaison : si un enregistrement clients existe avec le même email → lier
    UPDATE public.clients
    SET auth_user_id = NEW.id
    WHERE email = NEW.email
      AND auth_user_id IS NULL;

  ELSE
    -- Parcours artisan existant — INCHANGÉ
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

-- 6. RLS — clients particuliers peuvent lire leurs propres données

-- clients : voir sa propre fiche
DROP POLICY IF EXISTS "clients_select_by_auth_user" ON public.clients;
CREATE POLICY "clients_select_by_auth_user"
  ON public.clients FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

-- devis : via la fiche client liée
DROP POLICY IF EXISTS "devis_select_client" ON public.devis;
CREATE POLICY "devis_select_client"
  ON public.devis FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE auth_user_id = auth.uid()
    )
  );

-- factures : idem
DROP POLICY IF EXISTS "factures_select_client" ON public.factures;
CREATE POLICY "factures_select_client"
  ON public.factures FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE auth_user_id = auth.uid()
    )
  );

-- chantiers : idem
DROP POLICY IF EXISTS "chantiers_select_client" ON public.chantiers;
CREATE POLICY "chantiers_select_client"
  ON public.chantiers FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE auth_user_id = auth.uid()
    )
  );

-- 7. Index account_type pour filtrage rapide
CREATE INDEX IF NOT EXISTS idx_profiles_account_type ON public.profiles(account_type);
