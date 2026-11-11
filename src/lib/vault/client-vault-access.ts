import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";

export type ClientVaultAccessResult =
  | { kind: "allowed" }
  | { kind: "forbidden" }
  | { kind: "rpc_error"; code?: string; message: string };

/** Resultado bruto do RPC (PostgREST). */
export function interpretClientVaultRpc(
  data: boolean | null | undefined,
  error: { code?: string; message: string } | null,
): ClientVaultAccessResult {
  if (error) {
    const code = error.code;
    const message =
      code === "PGRST202"
        ? "Função can_access_client_vault ausente no cache da API (PostgREST). Rode NOTIFY pgrst ou aplique a migration de reload."
        : error.message;
    return code
      ? { kind: "rpc_error", code, message }
      : { kind: "rpc_error", message };
  }
  if (data === true) return { kind: "allowed" };
  if (data === false) return { kind: "forbidden" };
  return {
    kind: "rpc_error",
    message: "Resposta inválida ao verificar acesso ao cofre.",
  };
}

export async function checkClientVaultAccess(
  supabase: SupabaseClient<Database>,
  clientId: string,
): Promise<ClientVaultAccessResult> {
  const { data, error } = await supabase.rpc("can_access_client_vault", {
    p_client_id: clientId,
  });
  return interpretClientVaultRpc(data, error);
}
