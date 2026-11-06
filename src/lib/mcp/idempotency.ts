import { createServiceRole } from "@/lib/db/service-role";
import type { Json } from "@/lib/db/types";

const MAX_KEY = 200;

export async function getCachedMcpResult(
  profileId: string,
  scope: string,
  key: string | undefined,
): Promise<unknown | null> {
  if (!key || key.length < 8 || key.length > MAX_KEY) return null;
  const service = createServiceRole();
  const { data, error } = await service
    .from("mcp_idempotent_responses")
    .select("result")
    .eq("profile_id", profileId)
    .eq("scope", scope)
    .eq("idempotency_key", key)
    .maybeSingle();
  if (error || !data) return null;
  return data.result;
}

export async function setCachedMcpResult(
  profileId: string,
  scope: string,
  key: string | undefined,
  result: unknown,
): Promise<void> {
  if (!key || key.length < 8 || key.length > MAX_KEY) return;
  const service = createServiceRole();
  await service.from("mcp_idempotent_responses").upsert(
    {
      profile_id: profileId,
      scope,
      idempotency_key: key,
      result: result as Json,
    },
    {
      onConflict: "profile_id,scope,idempotency_key",
    },
  );
}
