"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, dbErr, err, ok } from "@/lib/actions/_types";
import { requireAdminAction } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";
import { z } from "zod";

const createSchema = z
  .object({
    profileId: z.string().uuid(),
    name: z.string().trim().min(1).max(120),
    scopes: z.array(z.enum(["read", "write"])).min(1).max(2),
    noExpiry: z.boolean().default(false),
    expiresInDays: z.coerce.number().int().min(1).max(3650).optional(),
  })
  .refine((d) => d.noExpiry || d.expiresInDays !== undefined, {
    message: "Informe validade em dias ou marque sem validade.",
  });

export type CreateMcpAgentTokenResult = {
  token: string;
  tokenId: string;
};

export async function createMcpAgentTokenAction(
  formData: FormData,
): Promise<ActionResult<CreateMcpAgentTokenResult>> {
  const guard = await requireAdminAction();
  if (!guard.ok) return guard;

  const noExpiry = formData.get("no_expiry") === "1";
  const raw = {
    profileId: String(formData.get("profile_id") ?? "").trim(),
    name: String(formData.get("name") ?? "").trim(),
    scopes: formData.getAll("scopes").map((v) => String(v).trim()).filter(Boolean),
    noExpiry,
    expiresInDays: noExpiry
      ? undefined
      : Number(formData.get("expires_in_days") ?? "365"),
  };
  const parsed = createSchema.safeParse({
    ...raw,
    scopes:
      raw.scopes.length > 0
        ? raw.scopes
        : (["read", "write"] as const),
  });
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Dados inválidos.", "validation_failed");
  }

  let expiresAt: string | null = null;
  if (!parsed.data.noExpiry && parsed.data.expiresInDays) {
    const exp = new Date();
    exp.setUTCDate(exp.getUTCDate() + parsed.data.expiresInDays);
    expiresAt = exp.toISOString();
  }

  const supabase = await createServer();
  const { data, error } = await supabase.rpc("create_mcp_agent_token", {
    p_profile_id: parsed.data.profileId,
    p_name: parsed.data.name,
    p_scopes: parsed.data.scopes,
    p_expires_at: expiresAt,
  });
  if (error) return dbErr(error, "createMcpAgentToken");
  const row = data as {
    ok?: boolean;
    token?: string;
    id?: string;
    code?: string;
  };
  if (!row?.ok || !row.token || !row.id) {
    return err(
      row?.code === "profile_not_found"
        ? "Perfil não encontrado."
        : row?.code === "forbidden"
          ? "Sem permissão."
          : "Falha ao criar token.",
      row?.code ?? "rpc_failed",
    );
  }

  revalidatePath("/admin");
  return ok({
    token: row.token,
    tokenId: row.id,
  });
}

export async function revokeMcpAgentTokenAction(
  tokenId: string,
): Promise<ActionResult<{ id: string }>> {
  const guard = await requireAdminAction();
  if (!guard.ok) return guard;

  const supabase = await createServer();
  const { data, error } = await supabase.rpc("revoke_mcp_agent_token", {
    p_id: tokenId,
  });
  if (error) return dbErr(error, "revokeMcpAgentToken");
  const row = data as { ok?: boolean; code?: string };
  if (!row?.ok) {
    return err(
      row?.code === "not_found" ? "Token não encontrado." : "Falha ao revogar.",
      row?.code ?? "rpc_failed",
    );
  }
  revalidatePath("/admin");
  return ok({ id: tokenId });
}
