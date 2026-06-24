-- Supprime le trigger redondant qui assignait toujours 'artisan' à tout nouvel utilisateur.
-- handle_new_user() (20260611) gère déjà les rôles client et artisan correctement.
DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user_role();
