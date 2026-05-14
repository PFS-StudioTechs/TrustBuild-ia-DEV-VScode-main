-- Add tester role to enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'tester';

-- Table: test_cases
CREATE TABLE IF NOT EXISTS public.test_cases (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tester_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reference     TEXT NOT NULL,              -- TEST-001, TEST-002...
  titre         TEXT NOT NULL,
  fonctionnalite TEXT NOT NULL,             -- ex: "Chat IA", "Devis", "Knowledge"
  priorite      TEXT NOT NULL DEFAULT 'normale' CHECK (priorite IN ('critique','haute','normale','basse')),
  statut        TEXT NOT NULL DEFAULT 'a_tester' CHECK (statut IN ('a_tester','en_cours','valide','echoue','bloque')),
  description   TEXT,
  etapes        TEXT,                       -- étapes de reproduction (markdown)
  resultat_attendu TEXT,
  resultat_obtenu  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.test_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tester_own_test_cases"
  ON public.test_cases FOR ALL
  TO authenticated
  USING (auth.uid() = tester_id)
  WITH CHECK (auth.uid() = tester_id);

-- Admins et super_admins voient tous les cas de test
CREATE POLICY "admin_view_test_cases"
  ON public.test_cases FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'super_admin')
  );

-- Table: test_defects
CREATE TABLE IF NOT EXISTS public.test_defects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tester_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  test_case_id  UUID REFERENCES public.test_cases(id) ON DELETE SET NULL,
  reference     TEXT NOT NULL,              -- BUG-001, BUG-002...
  titre         TEXT NOT NULL,
  fonctionnalite TEXT NOT NULL,
  severite      TEXT NOT NULL DEFAULT 'mineur' CHECK (severite IN ('critique','majeur','mineur','cosmétique')),
  statut        TEXT NOT NULL DEFAULT 'ouvert' CHECK (statut IN ('ouvert','en_cours','resolu','ferme','reouvert')),
  description   TEXT,
  etapes_reproduction TEXT,
  environnement TEXT,                       -- ex: "Vercel prod", "local"
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.test_defects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tester_own_defects"
  ON public.test_defects FOR ALL
  TO authenticated
  USING (auth.uid() = tester_id)
  WITH CHECK (auth.uid() = tester_id);

CREATE POLICY "admin_view_defects"
  ON public.test_defects FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'super_admin')
  );

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER test_cases_updated_at
  BEFORE UPDATE ON public.test_cases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER test_defects_updated_at
  BEFORE UPDATE ON public.test_defects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Séquences pour les références auto-incrémentées
CREATE SEQUENCE IF NOT EXISTS test_cases_seq START 1;
CREATE SEQUENCE IF NOT EXISTS test_defects_seq START 1;
