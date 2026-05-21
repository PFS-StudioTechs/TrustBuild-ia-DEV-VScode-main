CREATE POLICY "messages_update" ON public.messages FOR UPDATE USING (artisan_id = auth.uid());
