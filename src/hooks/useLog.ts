import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type LogStatus = 'success' | 'error' | 'info';

export interface LogEntry {
  action: string;
  entity_type?: string;
  entity_id?: string;
  status: LogStatus;
  details?: Record<string, unknown>;
}

export function useLog() {
  const { user } = useAuth();

  const log = useCallback((entry: LogEntry) => {
    if (!user) return;
    // app_logs absent des types générés (types.ts stale) — cast temporaire
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('app_logs').insert({
      user_id: user.id,
      action: entry.action,
      entity_type: entry.entity_type ?? null,
      entity_id: entry.entity_id ?? null,
      status: entry.status,
      details: entry.details ?? null,
    }).then();
  }, [user]);

  return { log };
}
