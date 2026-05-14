-- Ajout du champ "en-tête" dans les templates de documents
-- Affiché dans les devis/factures PDF sous le nom/SIRET de l'artisan
-- (RIB, certifications, mentions personnalisées, etc.)
ALTER TABLE document_templates
  ADD COLUMN IF NOT EXISTS entete_texte text;
