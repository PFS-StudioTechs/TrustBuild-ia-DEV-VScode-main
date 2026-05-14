-- ============================================================
-- Catalogue fournisseurs : imports et produits
-- ============================================================

-- Suivi des fichiers uploadés (CSV / image / PDF)
CREATE TABLE IF NOT EXISTS public.catalogue_imports (
  id                    UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  artisan_id            UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fournisseur_id        UUID        NOT NULL REFERENCES public.fournisseurs(id) ON DELETE CASCADE,
  fichier_url           TEXT        NOT NULL,
  fichier_type          TEXT        NOT NULL CHECK (fichier_type IN ('csv', 'image', 'pdf')),
  statut                TEXT        NOT NULL DEFAULT 'en_cours' CHECK (statut IN ('en_cours', 'termine', 'erreur')),
  nb_produits_extraits  INTEGER,
  erreur_message        TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.catalogue_imports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='catalogue_imports' AND policyname='ci_select') THEN
    CREATE POLICY "ci_select" ON public.catalogue_imports FOR SELECT USING (artisan_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='catalogue_imports' AND policyname='ci_insert') THEN
    CREATE POLICY "ci_insert" ON public.catalogue_imports FOR INSERT WITH CHECK (artisan_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='catalogue_imports' AND policyname='ci_update') THEN
    CREATE POLICY "ci_update" ON public.catalogue_imports FOR UPDATE USING (artisan_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='catalogue_imports' AND policyname='ci_delete') THEN
    CREATE POLICY "ci_delete" ON public.catalogue_imports FOR DELETE USING (artisan_id = auth.uid());
  END IF;
END $$;

-- Catalogue produits par fournisseur
-- statut_import : 'ia' = extrait par IA (à réviser), 'valide' = validé par artisan, 'manuel' = saisi manuellement
CREATE TABLE IF NOT EXISTS public.produits (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  artisan_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fournisseur_id  UUID        NOT NULL REFERENCES public.fournisseurs(id) ON DELETE CASCADE,
  import_id       UUID        REFERENCES public.catalogue_imports(id) ON DELETE SET NULL,
  reference       TEXT,
  designation     TEXT        NOT NULL DEFAULT '',
  unite           TEXT        NOT NULL DEFAULT 'u',
  prix_achat      NUMERIC     NOT NULL DEFAULT 0 CHECK (prix_achat >= 0),
  actif           BOOLEAN     NOT NULL DEFAULT true,
  statut_import   TEXT        NOT NULL DEFAULT 'manuel' CHECK (statut_import IN ('ia', 'valide', 'manuel')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.produits ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='produits' AND policyname='pr_select') THEN
    CREATE POLICY "pr_select" ON public.produits FOR SELECT USING (artisan_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='produits' AND policyname='pr_insert') THEN
    CREATE POLICY "pr_insert" ON public.produits FOR INSERT WITH CHECK (artisan_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='produits' AND policyname='pr_update') THEN
    CREATE POLICY "pr_update" ON public.produits FOR UPDATE USING (artisan_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='produits' AND policyname='pr_delete') THEN
    CREATE POLICY "pr_delete" ON public.produits FOR DELETE USING (artisan_id = auth.uid());
  END IF;
END $$;

-- updated_at auto-refresh
CREATE OR REPLACE FUNCTION public.set_produits_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_produits_updated_at ON public.produits;
CREATE TRIGGER trg_produits_updated_at
  BEFORE UPDATE ON public.produits
  FOR EACH ROW EXECUTE FUNCTION public.set_produits_updated_at();

-- ============================================================
-- Enrichissement lignes_devis et lignes_facture
-- prix_unitaire = prix de vente (inchangé)
-- prix_achat et marge_pct : nullable, rétrocompatibles
-- ============================================================

ALTER TABLE public.lignes_devis
  ADD COLUMN IF NOT EXISTS fournisseur_id UUID REFERENCES public.fournisseurs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS produit_id     UUID REFERENCES public.produits(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS prix_achat     NUMERIC CHECK (prix_achat IS NULL OR prix_achat >= 0),
  ADD COLUMN IF NOT EXISTS marge_pct      NUMERIC CHECK (marge_pct IS NULL OR (marge_pct >= 0 AND marge_pct < 100));

ALTER TABLE public.lignes_facture
  ADD COLUMN IF NOT EXISTS fournisseur_id UUID REFERENCES public.fournisseurs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS produit_id     UUID REFERENCES public.produits(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS prix_achat     NUMERIC CHECK (prix_achat IS NULL OR prix_achat >= 0),
  ADD COLUMN IF NOT EXISTS marge_pct      NUMERIC CHECK (marge_pct IS NULL OR (marge_pct >= 0 AND marge_pct < 100));
