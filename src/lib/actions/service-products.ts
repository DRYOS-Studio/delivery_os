"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, dbErr, err, ok } from "@/lib/actions/_types";
import { requireAdminAction } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";
import { serviceProductSchema } from "@/lib/validators/service-product";

type PostgresError = { code?: string; message: string };

function parseFormData(formData: FormData) {
  return {
    name: ((formData.get("name") as string | null) ?? "").trim(),
    slug: ((formData.get("slug") as string | null) ?? "").trim(),
    description: ((formData.get("description") as string | null) ?? "").trim(),
    default_cycle_type: ((formData.get("default_cycle_type") as string | null) ?? "").trim(),
  };
}

function validate(formData: FormData) {
  const parsed = serviceProductSchema.safeParse(parseFormData(formData));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const message = first?.message ?? "Dados inválidos.";
    const field = (first?.path[0] as string | undefined) ?? "validation";
    return err(message, `validation_${field}`);
  }
  return ok(parsed.data);
}

function mapDbError(error: PostgresError) {
  if (error.code === "23505") {
    return err("Slug já em uso.", "slug_conflict");
  }
  if (error.code === "23514") {
    if (error.message.includes("slug_format")) {
      return err("Slug inválido (use minúsculas, dígitos e hífens).", "validation_slug");
    }
    return err("Valor inválido (CHECK).", "check_violation");
  }
  return null;
}

export async function createServiceProductAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const adminGuard = await requireAdminAction();
  if (!adminGuard.ok) return adminGuard;

  const v = validate(formData);
  if (!v.ok) return v;
  const data = v.data;

  const supabase = await createServer();
  const { data: row, error: dbError } = await supabase
    .from("service_products")
    .insert({
      name: data.name,
      slug: data.slug,
      description: data.description ?? null,
      default_cycle_type: data.default_cycle_type ?? null,
    })
    .select("id")
    .single();

  if (dbError) {
    const mapped = mapDbError(dbError as PostgresError);
    if (mapped) return mapped;
    return dbErr(dbError, "createServiceProductAction");
  }
  if (!row) return err("Falha inesperada ao criar produto.", "no_data");

  revalidatePath("/catalog/products");
  return ok({ id: row.id });
}

export async function updateServiceProductAction(
  id: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const adminGuard = await requireAdminAction();
  if (!adminGuard.ok) return adminGuard;

  const v = validate(formData);
  if (!v.ok) return v;
  const data = v.data;

  const supabase = await createServer();
  const { error: dbError } = await supabase
    .from("service_products")
    .update({
      name: data.name,
      slug: data.slug,
      description: data.description ?? null,
      default_cycle_type: data.default_cycle_type ?? null,
    })
    .eq("id", id);

  if (dbError) {
    const mapped = mapDbError(dbError as PostgresError);
    if (mapped) return mapped;
    return dbErr(dbError, "updateServiceProductAction");
  }

  revalidatePath("/catalog/products");
  revalidatePath(`/catalog/products/${id}/edit`);
  return ok({ id });
}

export async function archiveServiceProductAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const adminGuard = await requireAdminAction();
  if (!adminGuard.ok) return adminGuard;

  const supabase = await createServer();
  const { error: dbError } = await supabase
    .from("service_products")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (dbError) return dbErr(dbError, "archiveServiceProductAction");

  revalidatePath("/catalog/products");
  return ok({ id });
}

export async function restoreServiceProductAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const adminGuard = await requireAdminAction();
  if (!adminGuard.ok) return adminGuard;

  const supabase = await createServer();
  const { error: dbError } = await supabase
    .from("service_products")
    .update({ archived_at: null })
    .eq("id", id);
  if (dbError) return dbErr(dbError, "restoreServiceProductAction");

  revalidatePath("/catalog/products");
  return ok({ id });
}
