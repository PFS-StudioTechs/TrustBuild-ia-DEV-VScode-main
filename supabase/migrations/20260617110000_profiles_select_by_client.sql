-- Permet à un client authentifié de lire le profil (nom, raison_sociale)
-- des artisans qui lui ont adressé au moins un devis.
-- Périmètre strict : uniquement les artisans liés via devis → clients → auth_user_id.
DROP POLICY IF EXISTS "profiles_select_by_client" ON public.profiles;
CREATE POLICY "profiles_select_by_client" ON public.profiles FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT d.artisan_id FROM public.devis d
      WHERE d.client_id IN (
        SELECT c.id FROM public.clients c WHERE c.auth_user_id = auth.uid()
      )
    )
  );
