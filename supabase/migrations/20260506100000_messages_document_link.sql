-- Lie les messages envoyés à leur document source (devis ou facture)
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS document_type TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS document_id UUID;

CREATE INDEX IF NOT EXISTS messages_document_idx ON public.messages (document_id) WHERE document_id IS NOT NULL;
