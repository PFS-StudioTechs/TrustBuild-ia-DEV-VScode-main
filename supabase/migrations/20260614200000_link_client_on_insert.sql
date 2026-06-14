-- ============================================================
-- TrustBuild-IA — Auto-liaison clients.auth_user_id à l'INSERT
-- Corrige le cas : fiche clients créée APRÈS l'inscription du client
-- Le trigger handle_new_user ne couvre que le sens inverse (auth → clients)
-- Ce trigger couvre le sens : clients INSERT → lookup auth.users par email
-- ============================================================

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
    WHERE email = NEW.email
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_client_to_auth ON public.clients;

CREATE TRIGGER trg_link_client_to_auth
  BEFORE INSERT ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.link_client_to_auth();
