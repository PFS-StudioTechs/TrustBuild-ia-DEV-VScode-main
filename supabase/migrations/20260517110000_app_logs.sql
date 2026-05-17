-- Audit and debug log table
-- INSERT: all authenticated users (log their own actions)
-- SELECT: admin and super_admin only

CREATE TABLE public.app_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  action      TEXT        NOT NULL,
  entity_type TEXT,
  entity_id   UUID,
  status      TEXT        NOT NULL CHECK (status IN ('success', 'error', 'info')),
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can insert logs"
  ON public.app_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all logs"
  ON public.app_logs FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'super_admin')
  );

CREATE INDEX app_logs_created_at_idx  ON public.app_logs (created_at DESC);
CREATE INDEX app_logs_user_id_idx     ON public.app_logs (user_id);
CREATE INDEX app_logs_entity_idx      ON public.app_logs (entity_type, entity_id);
CREATE INDEX app_logs_action_idx      ON public.app_logs (action);
