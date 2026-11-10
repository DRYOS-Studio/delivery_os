import {
  archiveClientCredential,
  createClientCredential,
  listClientCredentialAuditLogs,
  listClientCredentials,
  revealClientCredentialSecrets,
  updateClientCredential,
} from "@/lib/db/queries/client-credentials";
import type { ClientCredentialListRow } from "@/lib/db/queries/client-credentials";
import { VaultEncryptionConfigError } from "@/lib/vault/credential-crypto";
import {
  createClientCredentialSchema,
  revealClientCredentialSchema,
  updateClientCredentialMcpSchema,
} from "@/lib/validators/client-credential";
import {
  type McpHandlerContext,
  type McpToolResult,
} from "@/lib/mcp/tools/shared";
import {
  checkClientVaultAccess,
  type ClientVaultAccessResult,
} from "@/lib/vault/client-vault-access";
import { z } from "zod";

function mcpDenyFromVaultAccess(
  access: ClientVaultAccessResult,
): Extract<McpToolResult, { ok: false }> | null {
  if (access.kind === "allowed") return null;
  if (access.kind === "forbidden") {
    return {
      ok: false,
      message: "Sem acesso ao cofre deste cliente.",
      forbidden: true,
    };
  }
  return {
    ok: false,
    message: access.code
      ? `[${access.code}] ${access.message}`
      : access.message,
  };
}

function serializeCredential(c: ClientCredentialListRow) {
  return {
    id: c.id,
    client_id: c.clientId,
    operation_id: c.operationId,
    service_name: c.serviceName,
    url: c.url,
    login_username: c.loginUsername,
    archived_at: c.archivedAt,
    updated_at: c.updatedAt,
    updated_by: c.updatedBy,
    updated_by_label: c.updatedByLabel,
  };
}

const listArgs = z.object({
  client_id: z.string().uuid(),
  include_archived: z.boolean().optional(),
});

export async function mcpListClientCredentials(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ credentials: unknown[] }>> {
  const parsed = listArgs.safeParse(args);
  if (!parsed.success) {
    return { ok: false, message: "client_id inválido." };
  }
  const access = await checkClientVaultAccess(ctx.supabase, parsed.data.client_id);
  if (access.kind === "forbidden") {
    return mcpDenyFromVaultAccess(access) as McpToolResult<{
      credentials: unknown[];
    }>;
  }
  try {
    const rows = await listClientCredentials(
      parsed.data.client_id,
      { includeArchived: parsed.data.include_archived ?? false },
      ctx.supabase,
    );
    return {
      ok: true,
      data: { credentials: rows.map(serializeCredential) },
    };
  } catch (e) {
    const loadMessage =
      e instanceof Error ? e.message : "Falha ao listar credenciais.";
    if (access.kind === "rpc_error") {
      return {
        ok: false,
        message: `${access.message} — ${loadMessage}`,
      };
    }
    return { ok: false, message: loadMessage };
  }
}

export async function mcpCreateClientCredential(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ credential: unknown }>> {
  const parsed = createClientCredentialSchema.safeParse(args);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Parâmetros inválidos.",
    };
  }
  const access = await checkClientVaultAccess(ctx.supabase, parsed.data.client_id);
  const deniedCreate = mcpDenyFromVaultAccess(access);
  if (deniedCreate && access.kind !== "rpc_error") {
    return deniedCreate as McpToolResult<{ credential: unknown }>;
  }
  try {
    const row = await createClientCredential(
      {
        clientId: parsed.data.client_id,
        operationId: parsed.data.operation_id,
        serviceName: parsed.data.service_name,
        url: parsed.data.url,
        loginUsername: parsed.data.login_username,
        password: parsed.data.password,
        notes: parsed.data.notes,
        twoFactorNotes: parsed.data.two_factor_notes,
      },
      ctx.callerUserId,
      ctx.supabase,
    );
    return { ok: true, data: { credential: serializeCredential(row) } };
  } catch (e) {
    if (e instanceof VaultEncryptionConfigError) {
      return { ok: false, message: e.message };
    }
    const message = e instanceof Error ? e.message : "Falha ao criar credencial.";
    if (access.kind === "rpc_error") {
      return { ok: false, message: `${access.message} — ${message}` };
    }
    return { ok: false, message };
  }
}

const updateArgs = updateClientCredentialMcpSchema;

export async function mcpUpdateClientCredential(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ credential: unknown }>> {
  const parsed = updateArgs.safeParse(args);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Parâmetros inválidos.",
    };
  }
  const clientId = parsed.data.client_id;
  if (!clientId) {
    return { ok: false, message: "client_id é obrigatório na atualização." };
  }
  const access = await checkClientVaultAccess(ctx.supabase, clientId);
  const deniedUpdate = mcpDenyFromVaultAccess(access);
  if (deniedUpdate && access.kind !== "rpc_error") {
    return deniedUpdate as McpToolResult<{ credential: unknown }>;
  }
  try {
    const updateInput: Parameters<typeof updateClientCredential>[1] = {};
    if (parsed.data.operation_id !== undefined) {
      updateInput.operationId = parsed.data.operation_id;
    }
    if (parsed.data.service_name !== undefined) {
      updateInput.serviceName = parsed.data.service_name;
    }
    if (parsed.data.url !== undefined) updateInput.url = parsed.data.url;
    if (parsed.data.login_username !== undefined) {
      updateInput.loginUsername = parsed.data.login_username;
    }
    if (parsed.data.password) updateInput.password = parsed.data.password;
    if (parsed.data.notes !== undefined) updateInput.notes = parsed.data.notes;
    if (parsed.data.two_factor_notes !== undefined) {
      updateInput.twoFactorNotes = parsed.data.two_factor_notes;
    }

    const row = await updateClientCredential(
      parsed.data.credential_id,
      updateInput,
      ctx.callerUserId,
      ctx.supabase,
    );
    return { ok: true, data: { credential: serializeCredential(row) } };
  } catch (e) {
    if (e instanceof VaultEncryptionConfigError) {
      return { ok: false, message: e.message };
    }
    const message = e instanceof Error ? e.message : "Falha ao atualizar credencial.";
    if (access.kind === "rpc_error") {
      return { ok: false, message: `${access.message} — ${message}` };
    }
    return { ok: false, message };
  }
}

const archiveArgs = z.object({
  credential_id: z.string().uuid(),
  client_id: z.string().uuid(),
});

export async function mcpArchiveClientCredential(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ credential_id: string }>> {
  const parsed = archiveArgs.safeParse(args);
  if (!parsed.success) {
    return { ok: false, message: "Parâmetros inválidos." };
  }
  const access = await checkClientVaultAccess(ctx.supabase, parsed.data.client_id);
  const deniedArchive = mcpDenyFromVaultAccess(access);
  if (deniedArchive && access.kind !== "rpc_error") {
    return deniedArchive as McpToolResult<{ credential_id: string }>;
  }
  try {
    await archiveClientCredential(
      parsed.data.credential_id,
      ctx.callerUserId,
      ctx.supabase,
    );
    return { ok: true, data: { credential_id: parsed.data.credential_id } };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha ao arquivar.";
    if (access.kind === "rpc_error") {
      return { ok: false, message: `${access.message} — ${message}` };
    }
    return { ok: false, message };
  }
}

export async function mcpRevealClientCredential(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ password: string }>> {
  const parsed = revealClientCredentialSchema.safeParse(args);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Parâmetros inválidos.",
    };
  }
  const { data: meta, error: metaErr } = await ctx.supabase
    .from("client_credentials")
    .select("client_id")
    .eq("id", parsed.data.credential_id)
    .maybeSingle();
  if (metaErr || !meta) {
    return { ok: false, message: "Credencial não encontrada.", notFound: true };
  }
  const access = await checkClientVaultAccess(ctx.supabase, meta.client_id);
  const deniedReveal = mcpDenyFromVaultAccess(access);
  if (deniedReveal && access.kind !== "rpc_error") {
    return deniedReveal as McpToolResult<{ password: string }>;
  }
  try {
    const revealed = await revealClientCredentialSecrets(
      parsed.data.credential_id,
      ctx.callerUserId,
      {
        action: "reveal",
        reason: parsed.data.reason,
        actorMcp: true,
      },
      ctx.supabase,
    );
    return { ok: true, data: { password: revealed.password } };
  } catch (e) {
    if (e instanceof VaultEncryptionConfigError) {
      return { ok: false, message: e.message };
    }
    const message = e instanceof Error ? e.message : "Falha ao revelar senha.";
    if (access.kind === "rpc_error") {
      return { ok: false, message: `${access.message} — ${message}` };
    }
    return { ok: false, message };
  }
}

const auditArgs = z.object({
  client_id: z.string().uuid(),
  limit: z.number().int().min(1).max(100).optional(),
});

export async function mcpListClientCredentialAuditLogs(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ events: unknown[] }>> {
  const parsed = auditArgs.safeParse(args);
  if (!parsed.success) {
    return { ok: false, message: "client_id inválido." };
  }
  const access = await checkClientVaultAccess(ctx.supabase, parsed.data.client_id);
  if (access.kind === "forbidden") {
    return mcpDenyFromVaultAccess(access) as McpToolResult<{ events: unknown[] }>;
  }
  try {
    const rows = await listClientCredentialAuditLogs(
      parsed.data.client_id,
      parsed.data.limit ?? 50,
      ctx.supabase,
    );
    return {
      ok: true,
      data: {
        events: rows.map((e) => ({
          id: e.id,
          credential_id: e.credentialId,
          action: e.action,
          actor_user_id: e.actorUserId,
          actor_label: e.actorLabel,
          actor_mcp: e.actorMcp,
          reason: e.reason,
          created_at: e.createdAt,
        })),
      },
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Falha ao listar auditoria.";
    if (access.kind === "rpc_error") {
      return { ok: false, message: `${access.message} — ${message}` };
    }
    return { ok: false, message };
  }
}
