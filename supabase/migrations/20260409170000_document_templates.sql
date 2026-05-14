-- ─── document_templates ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.document_templates (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  secteur             TEXT NOT NULL DEFAULT 'general',
  nom                 TEXT NOT NULL DEFAULT 'Mon template',
  html_template       TEXT,
  css_template        TEXT,
  couleur_primaire    TEXT NOT NULL DEFAULT '#2563eb',
  couleur_secondaire  TEXT NOT NULL DEFAULT '#1e40af',
  couleur_accent      TEXT NOT NULL DEFAULT '#f59e0b',
  logo_url            TEXT,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── template_elements ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.template_elements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.document_templates(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,   -- 'header', 'footer', 'mention', 'coordonnee', etc.
  valeur      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── indexes ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_doc_templates_artisan ON public.document_templates(artisan_id);
CREATE INDEX IF NOT EXISTS idx_template_elements_template ON public.template_elements(template_id);

-- ─── updated_at trigger ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS set_document_templates_updated_at ON public.document_templates;
CREATE TRIGGER set_document_templates_updated_at
  BEFORE UPDATE ON public.document_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_elements  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "artisan_own_templates"   ON public.document_templates;
DROP POLICY IF EXISTS "artisan_own_elements"    ON public.template_elements;

CREATE POLICY "artisan_own_templates" ON public.document_templates
  FOR ALL USING (artisan_id = auth.uid()) WITH CHECK (artisan_id = auth.uid());

CREATE POLICY "artisan_own_elements" ON public.template_elements
  FOR ALL USING (
    template_id IN (
      SELECT id FROM public.document_templates WHERE artisan_id = auth.uid()
    )
  )
  WITH CHECK (
    template_id IN (
      SELECT id FROM public.document_templates WHERE artisan_id = auth.uid()
    )
  );
