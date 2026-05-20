-- Ajout colonne ville dans fournisseurs et catalogue_fournisseurs
-- Contrainte unicité catalogue : (nom_normalise, ville) au lieu de (nom_normalise)

ALTER TABLE fournisseurs ADD COLUMN IF NOT EXISTS ville text NOT NULL DEFAULT '';

ALTER TABLE catalogue_fournisseurs ADD COLUMN IF NOT EXISTS ville text NOT NULL DEFAULT '';

ALTER TABLE catalogue_fournisseurs DROP CONSTRAINT IF EXISTS catalogue_fournisseurs_nom_unique;

ALTER TABLE catalogue_fournisseurs
  ADD CONSTRAINT catalogue_fournisseurs_nom_ville_unique UNIQUE (nom_normalise, ville);
