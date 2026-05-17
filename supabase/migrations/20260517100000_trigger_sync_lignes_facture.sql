-- ============================================================
-- Sync automatique factures.montant_ht / montant_tva / montant_ttc
-- depuis les lignes détaillées (lignes_facture)
-- ============================================================

-- 1. Ajout des colonnes calculées sur factures (inexistantes avant)
ALTER TABLE public.factures
  ADD COLUMN IF NOT EXISTS montant_tva NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS montant_ttc NUMERIC(12,2) NOT NULL DEFAULT 0;

-- 2. Fonction de recalcul
CREATE OR REPLACE FUNCTION public.sync_montant_facture()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id  UUID;
  v_ht  NUMERIC(12,2);
  v_tva NUMERIC(12,2);
BEGIN
  -- Sur UPDATE avec changement de facture parente : recalcule l'ancienne aussi
  IF TG_OP = 'UPDATE' AND OLD.facture_id IS DISTINCT FROM NEW.facture_id THEN
    SELECT
      COALESCE(SUM(quantite * prix_unitaire),           0),
      COALESCE(SUM(quantite * prix_unitaire * tva / 100), 0)
    INTO v_ht, v_tva
    FROM public.lignes_facture
    WHERE facture_id = OLD.facture_id;

    UPDATE public.factures
    SET montant_ht  = v_ht,
        montant_tva = v_tva,
        montant_ttc = v_ht + v_tva,
        updated_at  = now()
    WHERE id = OLD.facture_id;
  END IF;

  -- Cible : OLD.facture_id pour DELETE (ligne déjà absente de la table), NEW sinon
  v_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.facture_id ELSE NEW.facture_id END;

  SELECT
    COALESCE(SUM(quantite * prix_unitaire),           0),
    COALESCE(SUM(quantite * prix_unitaire * tva / 100), 0)
  INTO v_ht, v_tva
  FROM public.lignes_facture
  WHERE facture_id = v_id;

  UPDATE public.factures
  SET montant_ht  = v_ht,
      montant_tva = v_tva,
      montant_ttc = v_ht + v_tva,
      updated_at  = now()
  WHERE id = v_id;

  RETURN NULL;
END;
$$;

-- 3. Trigger AFTER sur lignes_facture (INSERT / UPDATE / DELETE)
DROP TRIGGER IF EXISTS trg_sync_lignes_facture ON public.lignes_facture;

CREATE TRIGGER trg_sync_lignes_facture
AFTER INSERT OR UPDATE OR DELETE ON public.lignes_facture
FOR EACH ROW EXECUTE FUNCTION public.sync_montant_facture();

-- 4. Backfill : met à jour les factures existantes depuis leurs lignes actuelles
UPDATE public.factures f
SET
  montant_ht  = sub.ht,
  montant_tva = sub.tva,
  montant_ttc = sub.ht + sub.tva
FROM (
  SELECT
    facture_id,
    COALESCE(SUM(quantite * prix_unitaire),           0) AS ht,
    COALESCE(SUM(quantite * prix_unitaire * tva / 100), 0) AS tva
  FROM public.lignes_facture
  GROUP BY facture_id
) sub
WHERE f.id = sub.facture_id;
