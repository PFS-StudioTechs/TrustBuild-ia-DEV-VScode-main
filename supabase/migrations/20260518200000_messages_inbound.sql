-- Support des messages entrants (actions client sur devis)
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS direction TEXT NOT NULL DEFAULT 'outbound';
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS from_client_name TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS annotations_data JSONB;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS read BOOLEAN NOT NULL DEFAULT TRUE;

-- Les messages entrants (inbound) seront créés avec read = false
-- Les messages sortants gardent read = true par défaut (pas de notion de "non lu")

CREATE INDEX IF NOT EXISTS messages_direction_idx ON public.messages (artisan_id, direction, sent_at DESC);
CREATE INDEX IF NOT EXISTS messages_unread_idx ON public.messages (artisan_id, read) WHERE direction = 'inbound';
