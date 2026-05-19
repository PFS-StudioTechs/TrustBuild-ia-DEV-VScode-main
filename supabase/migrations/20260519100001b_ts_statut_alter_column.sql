UPDATE public.travaux_supplementaires
SET statut = 'brouillon'
WHERE statut NOT IN ('brouillon','envoye','signe','refuse','remplace','en_cours','chantier_en_cours','termine','facture');

ALTER TABLE public.travaux_supplementaires
  ALTER COLUMN statut DROP DEFAULT;

ALTER TABLE public.travaux_supplementaires
  ALTER COLUMN statut TYPE devis_statut USING statut::devis_statut;

ALTER TABLE public.travaux_supplementaires
  ALTER COLUMN statut SET DEFAULT 'brouillon'::devis_statut;
