import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import {
  listClientCredentialAuditLogs,
  listClientCredentials,
  type ClientCredentialAuditRow,
  type ClientCredentialListRow,
} from "@/lib/db/queries/client-credentials";
import {
  checkClientVaultAccess,
  type ClientVaultAccessResult,
} from "@/lib/vault/client-vault-access";

export type ClientVaultPageLoad =
  | {
      kind: "ok";
      credentials: ClientCredentialListRow[];
      auditLogs: ClientCredentialAuditRow[];
      accessWarning: string | null;
    }
  | { kind: "blocked"; access: ClientVaultAccessResult; loadError?: string };

export async function loadClientVaultPage(
  supabase: SupabaseClient<Database>,
  clientId: string,
): Promise<ClientVaultPageLoad> {
  const access = await checkClientVaultAccess(supabase, clientId);

  if (access.kind === "forbidden") {
    return { kind: "blocked", access };
  }

  try {
    const [credentials, auditLogs] = await Promise.all([
      listClientCredentials(clientId, undefined, supabase),
      listClientCredentialAuditLogs(clientId, 80, supabase),
    ]);
    return {
      kind: "ok",
      credentials,
      auditLogs,
      accessWarning:
        access.kind === "rpc_error"
          ? access.message
          : null,
    };
  } catch (e) {
    const loadError = e instanceof Error ? e.message : "Falha ao carregar cofre.";
    if (access.kind === "rpc_error") {
      return {
        kind: "blocked",
        access,
        loadError,
      };
    }
    return {
      kind: "blocked",
      access: {
        kind: "rpc_error",
        message: loadError,
      },
      loadError,
    };
  }
}
