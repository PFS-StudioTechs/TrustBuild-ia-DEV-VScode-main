-- ─── Add is_global flag to knowledge tables ────────────────────────────────

ALTER TABLE public.knowledge_documents
  ADD COLUMN IF NOT EXISTS is_global BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.knowledge_chunks
  ADD COLUMN IF NOT EXISTS is_global BOOLEAN NOT NULL DEFAULT false;

-- Index for fast global lookup
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_global
  ON public.knowledge_documents(is_global) WHERE is_global = true;

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_global
  ON public.knowledge_chunks(is_global) WHERE is_global = true;

-- Allow all authenticated users to READ global documents
DROP POLICY IF EXISTS "read_global_documents" ON public.knowledge_documents;
CREATE POLICY "read_global_documents" ON public.knowledge_documents
  FOR SELECT USING (is_global = true);

DROP POLICY IF EXISTS "read_global_chunks" ON public.knowledge_chunks;
CREATE POLICY "read_global_chunks" ON public.knowledge_chunks
  FOR SELECT USING (is_global = true);

-- Only service role (edge functions) can INSERT/UPDATE/DELETE global docs
-- (no extra policy needed — service role bypasses RLS)

-- Update the search RPC to also return global chunks
CREATE OR REPLACE FUNCTION public.search_knowledge_chunks(
  p_artisan_id UUID,
  p_embedding  TEXT,
  p_limit      INT DEFAULT 5
)
RETURNS TABLE (
  id          UUID,
  document_id UUID,
  artisan_id  UUID,
  contenu     TEXT,
  metadata    JSONB,
  similarity  FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id,
    kc.document_id,
    kc.artisan_id,
    kc.contenu,
    kc.metadata,
    1 - (kc.embedding <=> p_embedding::vector) AS similarity
  FROM public.knowledge_chunks kc
  WHERE
    -- Chunks de l'artisan OU chunks globaux
    (kc.artisan_id = p_artisan_id OR kc.is_global = true)
  ORDER BY kc.embedding <=> p_embedding::vector
  LIMIT p_limit;
END;
$$;
