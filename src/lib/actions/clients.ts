"use server";

import { type ActionResult, dbErr, err, ok } from "@/lib/actions/_types";
import { requireAdminAction, requireUserAction } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";
import { clientHasActiveOperations, getClient } from "@/lib/db/queries/clients";
import { clientSchema } from "@/lib/validators/client";

type PostgresError = { code?: string; message: string };

function isUniqueViolation(error: PostgresError): boolean {
  return error.code === "23505";
}

function formDataToClientInput(formData: FormData): {
  name: string;
  slug: string;
  notes: string;
} {
  return {
    name: (formData.get("name") as string | null) ?? "",
    slug: (formData.get("slug") as string | null) ?? "",
    notes: (formData.get("notes") as string | null) ?? "",
  };
}

export async function createClientAction(
  formData: FormData,
): Promise<ActionResult<{ id: string; slug: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const parsed = clientSchema.safeParse(formDataToClientInput(formData));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const message = first?.message ?? "Dados inválidos.";
    const field = (first?.path[0] as string | undefined) ?? "validation";
    return err(message, `validation_${field}`);
  }

  const supabase = await createServer();
  const { data, error: dbError } = await supabase
    .from("clients")
    .insert({
      name: parsed.data.name,
      slug: parsed.data.slug,
      notes: parsed.data.notes ?? null,
    })
    .select("id, slug")
    .single();

  if (dbError) {
    if (isUniqueViolation(dbError as PostgresError)) {
      return err("Já existe Cliente com esse slug.", "slug_taken");
    }
    return dbErr(dbError, "createClientAction");
  }
  if (!data) return err("Falha inesperada ao criar Cliente.", "no_data");

  return ok({ id: data.id, slug: data.slug });
}

export async function updateClientAction(
  id: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const parsed = clientSchema.safeParse(formDataToClientInput(formData));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const message = first?.message ?? "Dados inválidos.";
    const field = (first?.path[0] as string | undefined) ?? "validation";
    return err(message, `validation_${field}`);
  }

  const current = await getClient(id);
  if (!current) return err("Cliente não encontrado.", "not_found");

  if (parsed.data.slug !== current.slug) {
    const hasOps = await clientHasActiveOperations(id);
    if (hasOps) {
      return err(
        "Cliente tem Operações ativas; slug não pode mudar.",
        "slug_locked",
      );
    }
  }

  const supabase = await createServer();
  const { error: dbError } = await supabase
    .from("clients")
    .update({
      name: parsed.data.name,
      slug: parsed.data.slug,
      notes: parsed.data.notes ?? null,
    })
    .eq("id", id);

  if (dbError) {
    if (isUniqueViolation(dbError as PostgresError)) {
      return err("Já existe Cliente com esse slug.", "slug_taken");
    }
    return dbErr(dbError, "updateClientAction");
  }

  return ok({ id });
}

export async function archiveClientAction(
  id: string,
): Promise<ActionResult<undefined>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;
  const adminGuard = await requireAdminAction();
  if (!adminGuard.ok) return adminGuard;

  const hasOps = await clientHasActiveOperations(id);
  if (hasOps) {
    return err(
      "Cliente tem Operações ativas. Arquive-as antes.",
      "has_active_operations",
    );
  }

  const supabase = await createServer();
  const { error: dbError } = await supabase
    .from("clients")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);

  if (dbError) return dbErr(dbError, "archiveClientAction");
  return ok(undefined);
}
