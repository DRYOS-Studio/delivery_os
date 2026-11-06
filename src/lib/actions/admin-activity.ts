"use server";

import { createServer } from "@/lib/db/client";
import type { Json } from "@/lib/db/types";

function toRpcJson(value: unknown): Json | null {
  if (value === undefined || value === null) return null;
  return JSON.parse(JSON.stringify(value)) as Json;
}

export async function logProfileActivity(
  profileId: string,
  action: string,
  fieldKey: string | null,
  oldValue: unknown,
  newValue: unknown,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const supabase = await createServer();
  await supabase.rpc("log_activity_event", {
    p_subject_type: "profile",
    p_subject_id: profileId,
    p_operation_id: null,
    p_client_id: null,
    p_action: action,
    p_field_key: fieldKey ?? null,
    p_old_value: toRpcJson(oldValue),
    p_new_value: toRpcJson(newValue),
    p_metadata: toRpcJson(metadata) ?? {},
  });
}
