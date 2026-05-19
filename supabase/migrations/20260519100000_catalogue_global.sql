-- ================================================================
-- Catalogue mutualisé : articles partagés entre tous les artisans
-- ================================================================

-- 1. TABLE specialites
-- ----------------------------------------------------------------
CREATE TABLE specialites (
  id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom  text NOT NULL,
  CONSTRAINT specialites_nom_unique UNIQUE (nom)
);

INSERT INTO specialites (nom) VALUES
  ('Autre'),
  ('Carrelage'),
  ('Électricité'),
  ('Isolation'),
  ('Location'),
  ('Matériaux'),
  ('Menuiserie'),
  ('Outillage'),
  ('Peinture'),
  ('Parquet'),
  ('Plomberie');

-- 2. TABLE catalogue_fournisseurs
-- ----------------------------------------------------------------
CREATE TABLE catalogue_fournisseurs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom            text NOT NULL,
  nom_normalise  text NOT NULL,
  logo_url       text,
  specialite_id  uuid REFERENCES specialites(id),
  created_at     timestamptz DEFAULT now(),
  CONSTRAINT catalogue_fournisseurs_nom_unique UNIQUE (nom_normalise)
);

-- Déduplique les fournisseurs existants par UPPER(TRIM(nom))
-- En cas de doublon (ex. "Pallmann" / "PALLMANN"), garde le plus ancien
INSERT INTO catalogue_fournisseurs (nom, nom_normalise)
SELECT DISTINCT ON (UPPER(TRIM(nom)))
  nom,
  UPPER(TRIM(nom))
FROM fournisseurs
ORDER BY UPPER(TRIM(nom)), created_at ASC;

-- 3. Lien fournisseurs → catalogue_fournisseurs
-- ----------------------------------------------------------------
ALTER TABLE fournisseurs
  ADD COLUMN catalogue_fournisseur_id uuid REFERENCES catalogue_fournisseurs(id);

UPDATE fournisseurs f
SET catalogue_fournisseur_id = cf.id
FROM catalogue_fournisseurs cf
WHERE UPPER(TRIM(f.nom)) = cf.nom_normalise;

-- 4. TABLE artisan_prix_negocie
-- ----------------------------------------------------------------
CREATE TABLE artisan_prix_negocie (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  produit_id          uuid NOT NULL REFERENCES produits(id) ON DELETE CASCADE,
  prix_negocie_valeur numeric,
  updated_at          timestamptz DEFAULT now(),
  UNIQUE (artisan_id, produit_id)
);

-- 5. Migre prix_negocie_valeur existants → artisan_prix_negocie
-- ----------------------------------------------------------------
INSERT INTO artisan_prix_negocie (artisan_id, produit_id, prix_negocie_valeur)
SELECT artisan_id, id, prix_negocie_valeur
FROM produits
WHERE prix_negocie = true
  AND prix_negocie_valeur IS NOT NULL
  AND artisan_id IS NOT NULL
  AND actif = true;

-- 6. Colonne transitoire pour préparer le changement de FK
-- ----------------------------------------------------------------
ALTER TABLE produits ADD COLUMN catalogue_fournisseur_id uuid;

UPDATE produits p
SET catalogue_fournisseur_id = f.catalogue_fournisseur_id
FROM fournisseurs f
WHERE p.fournisseur_id = f.id;

-- 7. Déduplication : un seul article par (catalogue_fournisseur, référence)
--    Priorité : valide > manuel > ia, puis plus ancien en cas d'égalité
-- ----------------------------------------------------------------
UPDATE produits
SET actif = false
WHERE id NOT IN (
  SELECT DISTINCT ON (
    catalogue_fournisseur_id,
    COALESCE(UPPER(TRIM(reference)), UPPER(TRIM(SUBSTRING(designation, 1, 40))))
  ) id
  FROM produits
  WHERE actif = true
    AND catalogue_fournisseur_id IS NOT NULL
  ORDER BY
    catalogue_fournisseur_id,
    COALESCE(UPPER(TRIM(reference)), UPPER(TRIM(SUBSTRING(designation, 1, 40)))),
    CASE statut_import
      WHEN 'valide' THEN 0
      WHEN 'manuel' THEN 1
      ELSE 2
    END,
    created_at ASC
)
AND actif = true
AND catalogue_fournisseur_id IS NOT NULL;

-- 8. Changer fournisseur_id → catalogue_fournisseurs
-- ----------------------------------------------------------------
ALTER TABLE produits DROP CONSTRAINT produits_fournisseur_id_fkey;

UPDATE produits SET fournisseur_id = catalogue_fournisseur_id
WHERE catalogue_fournisseur_id IS NOT NULL;

ALTER TABLE produits
  ADD CONSTRAINT produits_fournisseur_id_fkey
  FOREIGN KEY (fournisseur_id) REFERENCES catalogue_fournisseurs(id) ON DELETE CASCADE;

ALTER TABLE produits DROP COLUMN catalogue_fournisseur_id;

-- 9. artisan_id nullable (NULL = article global, valeur = article manuel perso)
-- ----------------------------------------------------------------
ALTER TABLE produits DROP CONSTRAINT produits_artisan_id_fkey;
ALTER TABLE produits ALTER COLUMN artisan_id DROP NOT NULL;
ALTER TABLE produits
  ADD CONSTRAINT produits_artisan_id_fkey
  FOREIGN KEY (artisan_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Les articles ia/valide deviennent globaux (NULL)
UPDATE produits SET artisan_id = NULL
WHERE statut_import IN ('ia', 'valide');

-- 10. Supprime les colonnes prix_negocie de produits
-- ----------------------------------------------------------------
ALTER TABLE produits
  DROP COLUMN IF EXISTS prix_negocie,
  DROP COLUMN IF EXISTS prix_negocie_valeur;

-- 11. RLS produits : lecture globale, écriture service_role + articles manuels
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS pr_select ON produits;
DROP POLICY IF EXISTS pr_insert ON produits;
DROP POLICY IF EXISTS pr_update ON produits;
DROP POLICY IF EXISTS pr_delete ON produits;

CREATE POLICY produits_select ON produits
  FOR SELECT TO authenticated
  USING (
    actif = true
    AND (artisan_id IS NULL OR artisan_id = auth.uid())
  );

CREATE POLICY produits_insert ON produits
  FOR INSERT TO authenticated
  WITH CHECK (artisan_id = auth.uid() AND statut_import = 'manuel');

CREATE POLICY produits_update ON produits
  FOR UPDATE TO authenticated
  USING (artisan_id = auth.uid() AND statut_import = 'manuel')
  WITH CHECK (artisan_id = auth.uid() AND statut_import = 'manuel');

CREATE POLICY produits_delete ON produits
  FOR DELETE TO authenticated
  USING (artisan_id = auth.uid() AND statut_import = 'manuel');

-- 12. RLS catalogue_fournisseurs : lecture pour tous, écriture service_role
-- ----------------------------------------------------------------
ALTER TABLE catalogue_fournisseurs ENABLE ROW LEVEL SECURITY;

CREATE POLICY catalogue_fournisseurs_select ON catalogue_fournisseurs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY catalogue_fournisseurs_insert ON catalogue_fournisseurs
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY catalogue_fournisseurs_update ON catalogue_fournisseurs
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 13. RLS specialites : lecture pour tous
-- ----------------------------------------------------------------
ALTER TABLE specialites ENABLE ROW LEVEL SECURITY;

CREATE POLICY specialites_select ON specialites
  FOR SELECT TO authenticated USING (true);

-- 14. RLS artisan_prix_negocie : chaque artisan gère ses propres prix
-- ----------------------------------------------------------------
ALTER TABLE artisan_prix_negocie ENABLE ROW LEVEL SECURITY;

CREATE POLICY artisan_prix_negocie_own ON artisan_prix_negocie
  FOR ALL TO authenticated
  USING (artisan_id = auth.uid())
  WITH CHECK (artisan_id = auth.uid());
