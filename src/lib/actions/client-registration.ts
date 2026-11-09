"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import {
  type ActionResult,
  dbErr,
  err,
  ok,
} from "@/lib/actions/_types";
import {
  getProfile,
  requireAdminAction,
  requireUserAction,
} from "@/lib/auth/server";
import { createAdmin, createServer } from "@/lib/db/client";
import type { Json } from "@/lib/db/types";
import {
  effectiveInvitationStatus,
  parseSubmittedPayload,
} from "@/lib/db/queries/client-registration-invitations";
import {
  clientPayloadFromSubmission,
} from "@/lib/registration/map-submission-to-client";
import {
  decryptRegistrationToken,
  encryptRegistrationToken,
} from "@/lib/registration/token-crypto";
import {
  buildAbsoluteRegistrationUrl,
  generateRegistrationToken,
  hashRegistrationToken,
} from "@/lib/registration/token";
import { getSiteOriginForServerAction } from "@/lib/utils/site-origin-server";
import {
  clientRegistrationSubmissionSchema,
  createInvitationSchema,
  firstClientRegistrationValidationMessage,
  type ClientRegistrationSubmission,
} from "@/lib/validators/client-registration";
import { nullishToEmptyString } from "@/lib/validators/nullish";

const INVITE_TTL_DAYS = 14;

type PostgresError = { code?: string; message: string };

function isUniqueViolation(error: PostgresError): boolean {
  return error.code === "23505";
}

function expiresAtFromNow(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + INVITE_TTL_DAYS);
  return d.toISOString();
}

export async function createRegistrationInvitationAction(
  formData: FormData,
): Promise<
  ActionResult<{
    id: string;
    rawToken: string;
    registrationUrl: string;
  }>
> {
  const adminResult = await requireAdminAction();
  if (!adminResult.ok) return adminResult;
  const profile = await getProfile();
  if (!profile) return err("Perfil não encontrado.", "forbidden");

  const parsed = createInvitationSchema.safeParse({
    prefill_contact_name: nullishToEmptyString(formData.get("prefill_contact_name")),
    prefill_contact_phone: nullishToEmptyString(formData.get("prefill_contact_phone")),
    invite_note: formData.get("invite_note"),
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const field = (first?.path[0] as string | undefined) ?? "validation";
    return err(
      firstClientRegistrationValidationMessage(parsed.error),
      `validation_${field}`,
    );
  }

  const rawToken = generateRegistrationToken();
  const tokenHash = hashRegistrationToken(rawToken);
  const supabase = await createServer();

  const { data, error } = await supabase
    .from("client_registration_invitations")
    .insert({
      token_hash: tokenHash,
      token_encrypted: encryptRegistrationToken(rawToken),
      expires_at: expiresAtFromNow(),
      status: "enviado",
      prefill_contact_name: parsed.data.prefill_contact_name,
      prefill_contact_phone: parsed.data.prefill_contact_phone,
      invite_note: parsed.data.invite_note ?? null,
      created_by: profile.user.id,
    })
    .select("id")
    .single();

  if (error) return dbErr(error, "createRegistrationInvitationAction");

  const origin = await getSiteOriginForServerAction();
  const registrationUrl = buildAbsoluteRegistrationUrl(rawToken, origin);

  revalidatePath("/clients/registration-invites");
  return ok({ id: data.id, rawToken, registrationUrl });
}

export async function cancelRegistrationInvitationAction(
  invitationId: string,
): Promise<ActionResult<{ id: string }>> {
  const adminResult = await requireAdminAction();
  if (!adminResult.ok) return adminResult;

  const supabase = await createServer();
  const { data: row, error: fetchErr } = await supabase
    .from("client_registration_invitations")
    .select("status")
    .eq("id", invitationId)
    .maybeSingle();

  if (fetchErr) return dbErr(fetchErr, "cancelRegistrationInvitationAction");
  if (!row) return err("Convite não encontrado.", "not_found");
  if (row.status === "aprovado") {
    return err("Convite já aprovado — não pode cancelar.", "state_conflict");
  }

  const { error } = await supabase
    .from("client_registration_invitations")
    .update({
      status: "cancelado",
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", invitationId);

  if (error) return dbErr(error, "cancelRegistrationInvitationAction");
  revalidatePath("/clients/registration-invites");
  revalidatePath(`/clients/registration-invites/${invitationId}`);
  return ok({ id: invitationId });
}

export async function regenerateRegistrationInvitationTokenAction(
  invitationId: string,
): Promise<
  ActionResult<{
    id: string;
    rawToken: string;
    registrationUrl: string;
  }>
> {
  const adminResult = await requireAdminAction();
  if (!adminResult.ok) return adminResult;

  const supabase = await createServer();
  const { data: row, error: fetchErr } = await supabase
    .from("client_registration_invitations")
    .select("status")
    .eq("id", invitationId)
    .maybeSingle();

  if (fetchErr) {
    return dbErr(fetchErr, "regenerateRegistrationInvitationTokenAction");
  }
  if (!row) return err("Convite não encontrado.", "not_found");
  if (row.status === "aprovado") {
    return err("Convite já aprovado.", "state_conflict");
  }

  const rawToken = generateRegistrationToken();
  const tokenHash = hashRegistrationToken(rawToken);
  const nextStatus =
    row.status === "cancelado" || row.status === "expirado"
      ? "enviado"
      : row.status;

  const { error } = await supabase
    .from("client_registration_invitations")
    .update({
      token_hash: tokenHash,
      token_encrypted: encryptRegistrationToken(rawToken),
      expires_at: expiresAtFromNow(),
      status: nextStatus,
      cancelled_at: null,
    })
    .eq("id", invitationId);

  if (error) {
    if (isUniqueViolation(error as PostgresError)) {
      return err("Falha ao gerar token — tente novamente.", "state_conflict");
    }
    return dbErr(error, "regenerateRegistrationInvitationTokenAction");
  }

  const origin = await getSiteOriginForServerAction();
  const registrationUrl = buildAbsoluteRegistrationUrl(rawToken, origin);

  revalidatePath("/clients/registration-invites");
  revalidatePath(`/clients/registration-invites/${invitationId}`);
  return ok({ id: invitationId, rawToken, registrationUrl });
}

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 8;
const rateBucket = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateBucket.get(key);
  if (!entry || entry.resetAt < now) {
    rateBucket.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count += 1;
  return true;
}

export async function submitClientRegistrationAction(
  rawToken: string,
  payload: unknown,
): Promise<ActionResult<{ submitted: true }>> {
  const headerStore = await headers();
  const forwarded = headerStore.get("x-forwarded-for") ?? "unknown";
  const rateKey = `reg:${forwarded.split(",")[0]?.trim() ?? "unknown"}`;
  if (!checkRateLimit(rateKey)) {
    return err("Muitas tentativas — aguarde um minuto.", "rate_limited");
  }

  const token = rawToken.trim();
  if (token.length < 16) {
    return err("Link inválido.", "not_found");
  }

  const parsed = clientRegistrationSubmissionSchema.safeParse(payload);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const field = (first?.path.join(".") as string | undefined) ?? "validation";
    return err(
      firstClientRegistrationValidationMessage(parsed.error),
      `validation_${field}`,
    );
  }

  const admin = createAdmin();
  const tokenHash = hashRegistrationToken(token);
  const { data: row, error: fetchErr } = await admin
    .from("client_registration_invitations")
    .select("*")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (fetchErr) return dbErr(fetchErr, "submitClientRegistrationAction");
  if (!row) return err("Link inválido ou expirado.", "not_found");

  const status = effectiveInvitationStatus(row);
  if (status === "cancelado") {
    return err("Este convite foi cancelado.", "state_conflict");
  }
  if (status === "expirado") {
    return err("Este convite expirou.", "state_conflict");
  }
  if (status === "aprovado") {
    return err("Cadastro já aprovado.", "state_conflict");
  }
  if (status === "preenchido") {
    return err("Formulário já foi enviado.", "state_conflict");
  }

  const now = new Date().toISOString();
  const { error } = await admin
    .from("client_registration_invitations")
    .update({
      status: "preenchido",
      submitted_payload: parsed.data as unknown as Json,
      submitted_at: now,
      lgpd_consented_at: now,
    })
    .eq("id", row.id)
    .eq("status", "enviado");

  if (error) return dbErr(error, "submitClientRegistrationAction");
  return ok({ submitted: true });
}

export async function updateRegistrationSubmissionAction(
  invitationId: string,
  payload: unknown,
): Promise<ActionResult<{ id: string }>> {
  const adminResult = await requireAdminAction();
  if (!adminResult.ok) return adminResult;

  const parsed = clientRegistrationSubmissionSchema.safeParse(payload);
  if (!parsed.success) {
    return err(
      firstClientRegistrationValidationMessage(parsed.error),
      "validation_failed",
    );
  }

  const supabase = await createServer();
  const { data: row, error: fetchErr } = await supabase
    .from("client_registration_invitations")
    .select("status")
    .eq("id", invitationId)
    .maybeSingle();

  if (fetchErr) return dbErr(fetchErr, "updateRegistrationSubmissionAction");
  if (!row) return err("Convite não encontrado.", "not_found");
  if (row.status !== "preenchido") {
    return err("Só é possível editar submissões aguardando revisão.", "state_conflict");
  }

  const { error } = await supabase
    .from("client_registration_invitations")
    .update({
      submitted_payload: parsed.data as unknown as Json,
    })
    .eq("id", invitationId);

  if (error) return dbErr(error, "updateRegistrationSubmissionAction");
  revalidatePath(`/clients/registration-invites/${invitationId}`);
  return ok({ id: invitationId });
}

export async function approveRegistrationInvitationAction(
  invitationId: string,
): Promise<ActionResult<{ clientId: string; slug: string }>> {
  const adminResult = await requireAdminAction();
  if (!adminResult.ok) return adminResult;
  const profile = await getProfile();
  if (!profile) return err("Perfil não encontrado.", "forbidden");

  const supabase = await createServer();
  const { data: row, error: fetchErr } = await supabase
    .from("client_registration_invitations")
    .select("*")
    .eq("id", invitationId)
    .maybeSingle();

  if (fetchErr) return dbErr(fetchErr, "approveRegistrationInvitationAction");
  if (!row) return err("Convite não encontrado.", "not_found");
  if (row.status !== "preenchido") {
    return err("Convite não está aguardando revisão.", "state_conflict");
  }

  const submission = parseSubmittedPayload(row.submitted_payload);
  if (!submission) {
    return err("Submissão inválida.", "validation_failed");
  }

  let slugAttempt = 0;
  let clientId: string | null = null;
  let clientSlug: string | null = null;

  while (slugAttempt < 5) {
    const payload = clientPayloadFromSubmission(submission, slugAttempt);
    const { data: client, error: insertErr } = await supabase
      .from("clients")
      .insert(payload)
      .select("id, slug")
      .single();

    if (!insertErr && client) {
      clientId = client.id;
      clientSlug = client.slug;
      break;
    }
    if (insertErr && isUniqueViolation(insertErr as PostgresError)) {
      slugAttempt += 1;
      continue;
    }
    if (insertErr) {
      return dbErr(insertErr, "approveRegistrationInvitationAction");
    }
  }

  if (!clientId || !clientSlug) {
    return err("Não foi possível gerar slug único.", "state_conflict");
  }

  if (submission.software_items.length > 0) {
    const rows = submission.software_items.map((item, index) => ({
      client_id: clientId,
      name: item.name,
      purpose: item.purpose,
      url: item.url ?? null,
      sort_order: index,
    }));
    const { error: swErr } = await supabase.from("client_software_items").insert(rows);
    if (swErr) {
      await supabase.from("clients").delete().eq("id", clientId);
      return dbErr(swErr, "approveRegistrationInvitationAction");
    }
  }

  const now = new Date().toISOString();
  const { error: updErr } = await supabase
    .from("client_registration_invitations")
    .update({
      status: "aprovado",
      approved_client_id: clientId,
      approved_at: now,
      approved_by: profile.user.id,
    })
    .eq("id", invitationId)
    .eq("status", "preenchido");

  if (updErr) {
    return dbErr(updErr, "approveRegistrationInvitationAction");
  }

  revalidatePath("/clients");
  revalidatePath("/clients/registration-invites");
  revalidatePath(`/clients/${clientId}`);
  revalidatePath(`/clients/registration-invites/${invitationId}`);
  return ok({ clientId, slug: clientSlug });
}

export async function copyRegistrationInvitationLinkAction(
  invitationId: string,
): Promise<ActionResult<{ registrationUrl: string }>> {
  const adminResult = await requireAdminAction();
  if (!adminResult.ok) return adminResult;

  const supabase = await createServer();
  const { data: row, error } = await supabase
    .from("client_registration_invitations")
    .select("token_encrypted, status, expires_at")
    .eq("id", invitationId)
    .maybeSingle();

  if (error) return dbErr(error, "copyRegistrationInvitationLinkAction");
  if (!row) return err("Convite não encontrado.", "not_found");
  if (row.status === "aprovado" || row.status === "cancelado") {
    return err("Link indisponível para este status.", "state_conflict");
  }

  const rawToken = decryptRegistrationToken(row.token_encrypted);
  if (!rawToken) {
    return err("Não foi possível recuperar o link.", "state_conflict");
  }

  const origin = await getSiteOriginForServerAction();
  return ok({
    registrationUrl: buildAbsoluteRegistrationUrl(rawToken, origin),
  });
}
