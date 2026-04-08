
-- Table conversations
CREATE TABLE public.chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id uuid NOT NULL,
  titre text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_conv_select_own" ON public.chat_conversations FOR SELECT TO authenticated USING (auth.uid() = artisan_id);
CREATE POLICY "chat_conv_insert_own" ON public.chat_conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = artisan_id);
CREATE POLICY "chat_conv_update_own" ON public.chat_conversations FOR UPDATE TO authenticated USING (auth.uid() = artisan_id);
CREATE POLICY "chat_conv_delete_own" ON public.chat_conversations FOR DELETE TO authenticated USING (auth.uid() = artisan_id);

-- Table messages
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  artisan_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'user',
  content text NOT NULL DEFAULT '',
  persona text DEFAULT 'jarvis',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_msg_select_own" ON public.chat_messages FOR SELECT TO authenticated USING (auth.uid() = artisan_id);
CREATE POLICY "chat_msg_insert_own" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = artisan_id);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- Trigger updated_at on conversations
CREATE TRIGGER update_chat_conversations_updated_at
  BEFORE UPDATE ON public.chat_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
