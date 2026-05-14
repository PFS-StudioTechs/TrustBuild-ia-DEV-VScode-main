-- Add section_nom to all line-item tables (devis, avenants, travaux supplémentaires)
-- Allows Jarvis to organise document lines by named sections (e.g. "Démolition", "Peinture")
ALTER TABLE lignes_devis    ADD COLUMN IF NOT EXISTS section_nom TEXT NULL;
ALTER TABLE lignes_avenant  ADD COLUMN IF NOT EXISTS section_nom TEXT NULL;
ALTER TABLE lignes_ts       ADD COLUMN IF NOT EXISTS section_nom TEXT NULL;
