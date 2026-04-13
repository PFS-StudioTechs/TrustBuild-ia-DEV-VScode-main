-- Ajout prénom et commentaires sur clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS prenom       TEXT,
  ADD COLUMN IF NOT EXISTS commentaires TEXT;

-- Ajout etat_projet sur chantiers (pipeline de suivi client)
-- Valeurs : signe | en_cours | reception | parfait_achevement | termine
ALTER TABLE public.chantiers
  ADD COLUMN IF NOT EXISTS etat_projet TEXT;
