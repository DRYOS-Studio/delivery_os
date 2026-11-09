import {
  decryptRegistrationToken,
  encryptRegistrationToken,
} from "@/lib/registration/token-crypto";
import {
  buildAbsoluteRegistrationUrl,
  generateRegistrationToken,
  hashRegistrationToken,
} from "@/lib/registration/token";
import { getSiteOriginFromEnv } from "@/lib/utils/site-origin";
import {
  clientPayloadFromSubmission,
  type ClientInsertFromSubmission,
} from "@/lib/registration/map-submission-to-client";
import {
  clientRegistrationSubmissionSchema,
  createInvitationSchema,
  firstClientRegistrationValidationMessage,
} from "@/lib/validators/client-registration";
import {
  parseSubmittedPayload,
} from "@/lib/db/queries/client-registration-invitations";
import {
  clampLimit,
  clampOffset,
  mcpRequireAdmin,
  type McpHandlerContext,
  type McpToolResult,
} from "@/lib/mcp/tools/shared";
import { z } from "zod";

const INVITE_TTL_DAYS = 14;

function expiresAtFromNow(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + INVITE_TTL_DAYS);
  return d.toISOString();
}

export async function mcpCreateClientRegistrationInvitation(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<
  McpToolResult<{
    invitation_id: string;
    registration_url: string;
  }>
> {
  const denied = await mcpRequireAdmin(ctx);
  if (denied) return denied;

  const parsed = createInvitationSchema.safeParse(args);
  if (!parsed.success) {
    return {
      ok: false,
      message: firstClientRegistrationValidationMessage(parsed.error),
    };
  }

  const rawToken = generateRegistrationToken();
  const tokenHash = hashRegistrationToken(rawToken);

  const { data, error } = await ctx.supabase
    .from("client_registration_invitations")
    .insert({
      token_hash: tokenHash,
      token_encrypted: encryptRegistrationToken(rawToken),
      expires_at: expiresAtFromNow(),
      status: "enviado",
      prefill_contact_name: parsed.data.prefill_contact_name,
      prefill_contact_phone: parsed.data.prefill_contact_phone,
      invite_note: parsed.data.invite_note ?? null,
      created_by: ctx.callerUserId,
    })
    .select("id")
    .single();

  if (error) return { ok: false, message: error.message };

  return {
    ok: true,
    data: {
      invitation_id: data.id,
      registration_url: buildAbsoluteRegistrationUrl(
        rawToken,
        getSiteOriginFromEnv(),
      ),
    },
  };
}

export async function mcpListClientRegistrationInvitations(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ invitations: unknown[] }>> {
  const denied = await mcpRequireAdmin(ctx);
  if (denied) return denied;

  const limit = clampLimit(args.limit);
  const offset = clampOffset(args.offset);
  const status = typeof args.status === "string" ? args.status.trim() : "";

  let q = ctx.supabase
    .from("client_registration_invitations")
    .select(
      "id, status, prefill_contact_name, prefill_contact_phone, expires_at, submitted_at, approved_client_id, created_at",
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) q = q.eq("status", status as "enviado");

  const { data, error } = await q;
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { invitations: data ?? [] } };
}

const getSubmissionArgs = z.object({
  invitation_id: z.string().uuid(),
});

export async function mcpGetClientRegistrationSubmission(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ invitation: unknown; submission: unknown | null }>> {
  const denied = await mcpRequireAdmin(ctx);
  if (denied) return denied;

  const parsed = getSubmissionArgs.safeParse(args);
  if (!parsed.success) {
    return { ok: false, message: "invitation_id inválido." };
  }

  const { data, error } = await ctx.supabase
    .from("client_registration_invitations")
    .select("*")
    .eq("id", parsed.data.invitation_id)
    .maybeSingle();

  if (error) return { ok: false, message: error.message };
  if (!data) {
    return { ok: false, message: "Convite não encontrado.", notFound: true };
  }

  return {
    ok: true,
    data: {
      invitation: data,
      submission: parseSubmittedPayload(data.submitted_payload),
    },
  };
}

const approveArgs = z.object({
  invitation_id: z.string().uuid(),
});

export async function mcpApproveClientRegistrationInvitation(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ client_id: string; slug: string }>> {
  const denied = await mcpRequireAdmin(ctx);
  if (denied) return denied;

  const parsed = approveArgs.safeParse(args);
  if (!parsed.success) {
    return { ok: false, message: "invitation_id inválido." };
  }

  const { data: row, error: fetchErr } = await ctx.supabase
    .from("client_registration_invitations")
    .select("*")
    .eq("id", parsed.data.invitation_id)
    .maybeSingle();

  if (fetchErr) return { ok: false, message: fetchErr.message };
  if (!row) {
    return { ok: false, message: "Convite não encontrado.", notFound: true };
  }
  if (row.status !== "preenchido") {
    return { ok: false, message: "Convite não está aguardando revisão." };
  }

  const submission = parseSubmittedPayload(row.submitted_payload);
  if (!submission) {
    return { ok: false, message: "Submissão inválida." };
  }

  const validated = clientRegistrationSubmissionSchema.safeParse(submission);
  if (!validated.success) {
    return {
      ok: false,
      message: firstClientRegistrationValidationMessage(validated.error),
    };
  }

  let slugAttempt = 0;
  let clientId: string | null = null;
  let clientSlug: string | null = null;

  while (slugAttempt < 5) {
    const payload: ClientInsertFromSubmission = clientPayloadFromSubmission(
      validated.data,
      slugAttempt,
    );
    const { data: client, error: insertErr } = await ctx.supabase
      .from("clients")
      .insert(payload)
      .select("id, slug")
      .single();

    if (!insertErr && client) {
      clientId = client.id;
      clientSlug = client.slug;
      break;
    }
    if (insertErr?.code === "23505") {
      slugAttempt += 1;
      continue;
    }
    if (insertErr) return { ok: false, message: insertErr.message };
  }

  if (!clientId || !clientSlug) {
    return { ok: false, message: "Não foi possível gerar slug único." };
  }

  if (validated.data.software_items.length > 0) {
    const rows = validated.data.software_items.map((item, index) => ({
      client_id: clientId,
      name: item.name,
      purpose: item.purpose,
      url: item.url ?? null,
      sort_order: index,
    }));
    const { error: swErr } = await ctx.supabase
      .from("client_software_items")
      .insert(rows);
    if (swErr) {
      await ctx.supabase.from("clients").delete().eq("id", clientId);
      return { ok: false, message: swErr.message };
    }
  }

  const now = new Date().toISOString();
  const { error: updErr } = await ctx.supabase
    .from("client_registration_invitations")
    .update({
      status: "aprovado",
      approved_client_id: clientId,
      approved_at: now,
      approved_by: ctx.callerUserId,
    })
    .eq("id", parsed.data.invitation_id)
    .eq("status", "preenchido");

  if (updErr) return { ok: false, message: updErr.message };

  return { ok: true, data: { client_id: clientId, slug: clientSlug } };
}

/** Utilitário MCP: recupera link copiável (admin). */
export async function mcpGetClientRegistrationInvitationLink(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ registration_url: string }>> {
  const denied = await mcpRequireAdmin(ctx);
  if (denied) return denied;

  const parsed = getSubmissionArgs.safeParse(args);
  if (!parsed.success) {
    return { ok: false, message: "invitation_id inválido." };
  }

  const { data, error } = await ctx.supabase
    .from("client_registration_invitations")
    .select("token_encrypted, status")
    .eq("id", parsed.data.invitation_id)
    .maybeSingle();

  if (error) return { ok: false, message: error.message };
  if (!data) {
    return { ok: false, message: "Convite não encontrado.", notFound: true };
  }

  const raw = decryptRegistrationToken(data.token_encrypted);
  if (!raw) return { ok: false, message: "Link indisponível." };

  return {
    ok: true,
    data: {
      registration_url: buildAbsoluteRegistrationUrl(raw, getSiteOriginFromEnv()),
    },
  };
}
