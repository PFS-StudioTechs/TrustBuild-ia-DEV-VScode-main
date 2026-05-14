-- Colonne token_public sur devis (accès client sans authentification)
ALTER TABLE devis ADD COLUMN IF NOT EXISTS token_public UUID;
UPDATE devis SET token_public = gen_random_uuid() WHERE token_public IS NULL;
ALTER TABLE devis ALTER COLUMN token_public SET DEFAULT gen_random_uuid();
ALTER TABLE devis ALTER COLUMN token_public SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS devis_token_public_idx ON devis(token_public);

-- Table : annotations client sur un devis
CREATE TABLE IF NOT EXISTS devis_annotations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  devis_id UUID NOT NULL REFERENCES devis(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  ligne_id UUID REFERENCES lignes_devis(id) ON DELETE SET NULL,
  contenu TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE devis_annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "artisan_select_annotations" ON devis_annotations
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM devis
    WHERE devis.id = devis_annotations.devis_id
      AND devis.artisan_id = auth.uid()
  ));

-- Table : signature client sur un devis
CREATE TABLE IF NOT EXISTS devis_signatures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  devis_id UUID NOT NULL REFERENCES devis(id) ON DELETE CASCADE,
  signature_data TEXT NOT NULL,
  bon_pour_accord TEXT DEFAULT 'Bon pour accord',
  signed_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  ip_address TEXT
);

ALTER TABLE devis_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "artisan_select_signatures" ON devis_signatures
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM devis
    WHERE devis.id = devis_signatures.devis_id
      AND devis.artisan_id = auth.uid()
  ));
