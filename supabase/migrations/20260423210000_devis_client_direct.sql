-- ============================================================
-- Devis directement lié au client (sans passer par un chantier)
-- chantier_id devient nullable ; client_id ajouté
-- date_validite défaut : aujourd'hui + 30 jours
-- ============================================================

-- Lien direct client ↔ devis
ALTER TABLE public.devis
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

-- chantier_id n'est plus obligatoire
ALTER TABLE public.devis ALTER COLUMN chantier_id DROP NOT NULL;

-- Date de validité par défaut = J+30
ALTER TABLE public.devis
  ALTER COLUMN date_validite SET DEFAULT (CURRENT_DATE + 30);

CREATE INDEX IF NOT EXISTS idx_devis_client ON public.devis(client_id);

-- Backfill : renseigne client_id depuis le chantier pour les devis existants
UPDATE public.devis d
SET client_id = c.client_id
FROM public.chantiers c
WHERE d.chantier_id = c.id
  AND d.client_id IS NULL;

-- Lien direct client ↔ facture (utile pour requêtes sans jointure chantier)
ALTER TABLE public.factures
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_factures_client ON public.factures(client_id);

UPDATE public.factures f
SET client_id = d.client_id
FROM public.devis d
WHERE f.devis_id = d.id
  AND f.client_id IS NULL;
