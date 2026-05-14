ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'app';
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS transcription_originale text;