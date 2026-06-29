-- ================================================================
-- TrustBuild-IA — Table de référence corps_metier
-- Usage : validation lots brief client + tagging artisans partenaires
-- ================================================================

CREATE TABLE IF NOT EXISTS public.corps_metier (
  id      TEXT    PRIMARY KEY,
  libelle TEXT    NOT NULL,
  actif   BOOLEAN NOT NULL DEFAULT true,
  ordre   INT     NOT NULL DEFAULT 0
);

ALTER TABLE public.corps_metier ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cm_select" ON public.corps_metier
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.corps_metier (id, libelle, ordre) VALUES
  ('plomberie',      'Plomberie',         1),
  ('electricite',    'Électricité',        2),
  ('carrelage',      'Carrelage',          3),
  ('menuiserie',     'Menuiserie',         4),
  ('peinture',       'Peinture',           5),
  ('platrerie',      'Plâtrerie',          6),
  ('maconnerie',     'Maçonnerie',         7),
  ('chauffage',      'Chauffage',          8),
  ('isolation',      'Isolation',          9),
  ('couverture',     'Couverture',        10),
  ('serrurerie',     'Serrurerie',        11),
  ('vitrerie',       'Vitrerie',          12),
  ('revetement_sol', 'Revêtement de sol', 13),
  ('cuisine',        'Cuisine',           14),
  ('sanitaire',      'Sanitaire',         15)
ON CONFLICT (id) DO UPDATE SET
  libelle = EXCLUDED.libelle,
  ordre   = EXCLUDED.ordre;

-- ROLLBACK
-- DROP TABLE IF EXISTS public.corps_metier;
