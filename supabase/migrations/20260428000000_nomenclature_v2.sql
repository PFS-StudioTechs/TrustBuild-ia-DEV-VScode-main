-- ============================================================
-- Nomenclature v2 : numérotation séquentielle par mois
-- Versioning des devis, TS complet, avoirs rectificatifs
-- ============================================================

-- ============================================================
-- 1. TABLE document_counters + fonction atomique
-- ============================================================
CREATE TABLE IF NOT EXISTS public.document_counters (
  artisan_id  UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_type    TEXT    NOT NULL,   -- 'devis' | 'facture' | 'avenant' | 'acompte' | 'avoir' | 'ts'
  annee       INTEGER NOT NULL,
  mois        INTEGER NOT NULL,
  dernier_num INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (artisan_id, doc_type, annee, mois)
);

ALTER TABLE public.document_counters ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'document_counters' AND policyname = 'counters_artisan_own'
  ) THEN
    CREATE POLICY "counters_artisan_own"
      ON public.document_counters FOR ALL
      USING (artisan_id = auth.uid());
  END IF;
END $$;

-- Incrémente le compteur et retourne le nouveau numéro (opération atomique)
CREATE OR REPLACE FUNCTION public.next_doc_number(
  p_artisan_id UUID,
  p_doc_type   TEXT,
  p_annee      INTEGER,
  p_mois       INTEGER
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_num INTEGER;
BEGIN
  INSERT INTO public.document_counters (artisan_id, doc_type, annee, mois, dernier_num)
  VALUES (p_artisan_id, p_doc_type, p_annee, p_mois, 1)
  ON CONFLICT (artisan_id, doc_type, annee, mois)
  DO UPDATE SET dernier_num = document_counters.dernier_num + 1
  RETURNING dernier_num INTO v_num;
  RETURN v_num;
END;
$$;

-- ============================================================
-- 2. artisan_settings : nouveaux champs nomenclature
-- ============================================================
ALTER TABLE public.artisan_settings
  ADD COLUMN IF NOT EXISTS ts_prefix      TEXT     NOT NULL DEFAULT 'TS',
  ADD COLUMN IF NOT EXISTS annee_format   SMALLINT NOT NULL DEFAULT 4,   -- 2 ou 4 chiffres
  ADD COLUMN IF NOT EXISTS numero_digits  SMALLINT NOT NULL DEFAULT 3;   -- 3, 4 ou 5 chiffres

-- ============================================================
-- 3. Versioning des devis
-- ============================================================

-- Nouveau statut pour un devis remplacé par une version suivante
ALTER TYPE public.devis_statut ADD VALUE IF NOT EXISTS 'remplace';

ALTER TABLE public.devis
  ADD COLUMN IF NOT EXISTS version         INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_devis_id UUID    REFERENCES public.devis(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS base_numero     TEXT;

-- Backfill : les devis existants ont base_numero = leur numero actuel, version = 1
UPDATE public.devis SET base_numero = numero WHERE base_numero IS NULL;

CREATE INDEX IF NOT EXISTS idx_devis_parent ON public.devis(parent_devis_id);
CREATE INDEX IF NOT EXISTS idx_devis_base_numero ON public.devis(artisan_id, base_numero);

-- ============================================================
-- 4. Factures : statut annulée + liens vers avoir / TS
-- ============================================================
ALTER TYPE public.facture_statut ADD VALUE IF NOT EXISTS 'annulee';

ALTER TABLE public.factures
  ADD COLUMN IF NOT EXISTS avoir_annulation_id UUID REFERENCES public.avoirs(id)                   ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ts_id               UUID REFERENCES public.travaux_supplementaires(id)   ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS client_id           UUID REFERENCES public.clients(id)                   ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_factures_ts ON public.factures(ts_id);
CREATE INDEX IF NOT EXISTS idx_factures_client ON public.factures(client_id);

-- ============================================================
-- 5. Avoirs : lien vers la facture rectificative
-- ============================================================
ALTER TABLE public.avoirs
  ADD COLUMN IF NOT EXISTS facture_remplacante_id UUID REFERENCES public.factures(id) ON DELETE SET NULL;

-- ============================================================
-- 6. Travaux supplémentaires : enrichissement (structure devis)
-- ============================================================
ALTER TABLE public.travaux_supplementaires
  ADD COLUMN IF NOT EXISTS client_id    UUID  REFERENCES public.clients(id)    ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS chantier_id  UUID  REFERENCES public.chantiers(id)  ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS date_validite DATE;

CREATE INDEX IF NOT EXISTS idx_ts_devis    ON public.travaux_supplementaires(devis_id);
CREATE INDEX IF NOT EXISTS idx_ts_artisan  ON public.travaux_supplementaires(artisan_id);

-- ============================================================
-- 7. Table lignes_ts (structure identique aux autres lignes)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lignes_ts (
  id            UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  ts_id         UUID          NOT NULL REFERENCES public.travaux_supplementaires(id) ON DELETE CASCADE,
  artisan_id    UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  designation   TEXT          NOT NULL DEFAULT '',
  quantite      NUMERIC(10,3) NOT NULL DEFAULT 1,
  unite         TEXT          NOT NULL DEFAULT 'u',
  prix_unitaire NUMERIC(12,2) NOT NULL DEFAULT 0,
  tva           NUMERIC(5,2)  NOT NULL DEFAULT 20,
  ordre         INTEGER       NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ   DEFAULT NOW()
);

ALTER TABLE public.lignes_ts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'lignes_ts' AND policyname = 'lignes_ts_artisan_own') THEN
    CREATE POLICY "lignes_ts_artisan_own"
      ON public.lignes_ts FOR ALL
      USING (artisan_id = auth.uid());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_lignes_ts_ts ON public.lignes_ts(ts_id);
