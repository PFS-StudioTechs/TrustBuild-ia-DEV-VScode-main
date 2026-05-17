import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type LogStatus = "success" | "error" | "info";

interface LogEntry {
  user_id: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  status: LogStatus;
  details?: Record<string, unknown>;
}

export function log(
  serviceClient: ReturnType<typeof createClient>,
  entry: LogEntry,
): void {
  serviceClient
    .from("app_logs")
    .insert({
      user_id: entry.user_id,
      action: entry.action,
      entity_type: entry.entity_type ?? null,
      entity_id: entry.entity_id ?? null,
      status: entry.status,
      details: entry.details ?? null,
    })
    .then()
    .catch((e: unknown) => console.error("app_logs insert failed:", e));
}
