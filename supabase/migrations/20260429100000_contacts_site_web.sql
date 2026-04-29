-- Ajout du champ site_web sur la table contacts
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS site_web TEXT;
