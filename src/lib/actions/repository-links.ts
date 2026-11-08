"use server";

import {
  type ActionResult,
  dbErr,
  err,
  ok,
} from "@/lib/actions/_types";
import { requireAdminAction, requireUserAction } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";
import {
  repositoryLinkBodySchema,
  type RepositoryLinkBody,
} from "@/lib/validators/repository-link";

type PostgresError = { code?: string; message: string };

function parseBody(formData: FormData): Record<string, string> {
  return {
    label: ((formData.get("label") as string | null) ?? "").trim(),
    url: ((formData.get("url") as string | null) ?? "").trim(),
    notes: ((formData.get("notes") as string | null) ?? "").trim(),
  };
}

function validateBody(formData: FormData): ActionResult<RepositoryLinkBody> {
  const parsed = repositoryLinkBodySchema.safeParse(parseBody(formData));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const field = (first?.path[0] as string | undefined) ?? "validation";
    return err(first?.message ?? "Dados inválidos.", `validation_${field}`);
  }
  return ok(parsed.data);
}

async function assertFrenteBelongs(
  frenteId: string,
  operationId: string,
): Promise<ActionResult<undefined>> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("frentes")
    .select("operation_id")
    .eq("id", frenteId)
    .maybeSingle();
  if (error) return dbErr(error, "assertFrenteBelongs");
  if (!data || data.operation_id !== operationId) {
    return err("Frente não pertence à Operação.", "invalid_scope");
  }
  return ok(undefined);
}

export async function createClientRepositoryLinkAction(
  clientId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUserAction();
  if (!user.ok) return user;
  const admin = await requireAdminAction();
  if (!admin.ok) return admin;

  const body = validateBody(formData);
  if (!body.ok) return body;

  const supabase = await createServer();
  const { data, error } = await supabase
    .from("repository_links")
    .insert({
      client_id: clientId,
      label: body.data.label,
      url: body.data.url,
      notes: body.data.notes ?? null,
    })
    .select("id")
    .single();

  if (error) return dbErr(error as PostgresError, "createClientRepositoryLink");
  if (!data) return err("Falha ao criar link.", "no_data");
  return ok({ id: data.id });
}

export async function createOperationRepositoryLinkAction(
  clientId: string,
  operationId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUserAction();
  if (!user.ok) return user;

  const body = validateBody(formData);
  if (!body.ok) return body;

  const supabase = await createServer();
  const { data, error } = await supabase
    .from("repository_links")
    .insert({
      client_id: clientId,
      operation_id: operationId,
      label: body.data.label,
      url: body.data.url,
      notes: body.data.notes ?? null,
    })
    .select("id")
    .single();

  if (error) return dbErr(error as PostgresError, "createOperationRepositoryLink");
  if (!data) return err("Falha ao criar link.", "no_data");
  return ok({ id: data.id });
}

export async function createFrenteRepositoryLinkAction(
  clientId: string,
  operationId: string,
  frenteId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUserAction();
  if (!user.ok) return user;

  const scope = await assertFrenteBelongs(frenteId, operationId);
  if (!scope.ok) return scope;

  const body = validateBody(formData);
  if (!body.ok) return body;

  const supabase = await createServer();
  const { data, error } = await supabase
    .from("repository_links")
    .insert({
      client_id: clientId,
      operation_id: operationId,
      frente_id: frenteId,
      label: body.data.label,
      url: body.data.url,
      notes: body.data.notes ?? null,
    })
    .select("id")
    .single();

  if (error) return dbErr(error as PostgresError, "createFrenteRepositoryLink");
  if (!data) return err("Falha ao criar link.", "no_data");
  return ok({ id: data.id });
}

export async function updateRepositoryLinkAction(
  linkId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUserAction();
  if (!user.ok) return user;

  const body = validateBody(formData);
  if (!body.ok) return body;

  const supabase = await createServer();
  const { error } = await supabase
    .from("repository_links")
    .update({
      label: body.data.label,
      url: body.data.url,
      notes: body.data.notes ?? null,
    })
    .eq("id", linkId);

  if (error) return dbErr(error as PostgresError, "updateRepositoryLink");
  return ok({ id: linkId });
}

export async function deleteRepositoryLinkAction(
  linkId: string,
): Promise<ActionResult<undefined>> {
  const user = await requireUserAction();
  if (!user.ok) return user;

  const supabase = await createServer();
  const { error } = await supabase
    .from("repository_links")
    .delete()
    .eq("id", linkId);

  if (error) return dbErr(error as PostgresError, "deleteRepositoryLink");
  return ok(undefined);
}
