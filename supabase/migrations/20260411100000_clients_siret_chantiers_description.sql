-- Ajout siret et contraintes d'unicité sur clients
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS siret TEXT;

-- Unicité email par artisan (un même artisan ne peut pas avoir 2 clients avec le même email)
CREATE UNIQUE INDEX IF NOT EXISTS clients_artisan_email_unique
  ON public.clients (artisan_id, email)
  WHERE email IS NOT NULL AND email != '';

-- Unicité siret par artisan
CREATE UNIQUE INDEX IF NOT EXISTS clients_artisan_siret_unique
  ON public.clients (artisan_id, siret)
  WHERE siret IS NOT NULL AND siret != '';

-- Ajout description sur chantiers
ALTER TABLE public.chantiers ADD COLUMN IF NOT EXISTS description TEXT;
