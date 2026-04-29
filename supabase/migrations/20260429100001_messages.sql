-- Table messages envoyés depuis la messagerie
CREATE TABLE IF NOT EXISTS public.messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_email   TEXT NOT NULL,
  to_name    TEXT,
  subject    TEXT NOT NULL,
  body       TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'sent',
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_artisan_id_idx ON public.messages (artisan_id);
CREATE INDEX IF NOT EXISTS messages_sent_at_idx ON public.messages (artisan_id, sent_at DESC);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='messages' AND policyname='messages_select') THEN
    CREATE POLICY "messages_select" ON public.messages FOR SELECT USING (artisan_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='messages' AND policyname='messages_insert') THEN
    CREATE POLICY "messages_insert" ON public.messages FOR INSERT WITH CHECK (artisan_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='messages' AND policyname='messages_delete') THEN
    CREATE POLICY "messages_delete" ON public.messages FOR DELETE USING (artisan_id = auth.uid());
  END IF;
END $$;
