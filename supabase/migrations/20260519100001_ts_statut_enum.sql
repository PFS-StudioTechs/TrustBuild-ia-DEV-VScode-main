-- Migration statut travaux_supplementaires : TEXT → devis_statut enum
-- Ajout de la valeur "facture" à l'enum (TS peut être facturé après signature)

ALTER TYPE devis_statut ADD VALUE IF NOT EXISTS 'facture';

-- Conversion de la colonne TEXT vers l'enum
-- Toutes les valeurs existantes (brouillon, envoye, signe, refuse, facture) sont valides dans l'enum
ALTER TABLE public.travaux_supplementaires
  ALTER COLUMN statut TYPE devis_statut USING statut::devis_statut;

ALTER TABLE public.travaux_supplementaires
  ALTER COLUMN statut SET DEFAULT 'brouillon'::devis_statut;
