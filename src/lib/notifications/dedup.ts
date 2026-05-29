import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import type { NotificationEvent } from "./types";

const DEFAULT_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function alreadySent(
  supabase: SupabaseClient<Database>,
  input: {
    operation_id: string;
    event_type: NotificationEvent;
    subject_id: string;
    windowMs?: number;
  },
): Promise<boolean> {
  const windowMs = input.windowMs ?? DEFAULT_WINDOW_MS;
  const since = new Date(Date.now() - windowMs).toISOString();

  const { data, error } = await supabase
    .from("notifications_log")
    .select("id")
    .eq("operation_id", input.operation_id)
    .eq("event_type", input.event_type)
    .eq("subject_id", input.subject_id)
    .gt("sent_at", since)
    .limit(1);

  if (error) {
    // Em caso de erro de leitura, assumir "não enviado" pra não silenciar
    // alertas reais. Pior caso: duplicação ocasional, mais visível que silêncio.
    return false;
  }

  return (data ?? []).length > 0;
}
