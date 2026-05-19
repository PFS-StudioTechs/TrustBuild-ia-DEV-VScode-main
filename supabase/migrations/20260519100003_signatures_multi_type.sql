-- Extension devis_signatures pour supporter avenants et TS
-- Même pattern que devis_annotations (migration 20260519100002)

ALTER TABLE devis_signatures
  ADD COLUMN IF NOT EXISTS doc_type TEXT NOT NULL DEFAULT 'devis',
  ADD COLUMN IF NOT EXISTS doc_id   UUID;

UPDATE devis_signatures SET doc_id = devis_id WHERE doc_id IS NULL AND devis_id IS NOT NULL;

ALTER TABLE devis_signatures
  ALTER COLUMN devis_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS devis_signatures_doc_idx ON devis_signatures(doc_type, doc_id);

-- Mise à jour RLS : inclure avenants et TS
DROP POLICY IF EXISTS "artisan_select_signatures" ON devis_signatures;
CREATE POLICY "artisan_select_signatures" ON devis_signatures
  FOR SELECT
  USING (
    (doc_type = 'devis' AND EXISTS (
      SELECT 1 FROM devis WHERE devis.id = devis_signatures.doc_id AND devis.artisan_id = auth.uid()
    ))
    OR
    (doc_type = 'avenant' AND EXISTS (
      SELECT 1 FROM avenants WHERE avenants.id = devis_signatures.doc_id AND avenants.artisan_id = auth.uid()
    ))
    OR
    (doc_type = 'ts' AND EXISTS (
      SELECT 1 FROM travaux_supplementaires WHERE travaux_supplementaires.id = devis_signatures.doc_id AND travaux_supplementaires.artisan_id = auth.uid()
    ))
  );
