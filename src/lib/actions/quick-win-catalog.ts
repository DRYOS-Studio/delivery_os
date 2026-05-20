"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, dbErr, err, ok } from "@/lib/actions/_types";
import { requireAdminAction } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";
import { quickWinCatalogSchema } from "@/lib/validators/quick-win-catalog";

type PostgresError = { code?: string; message: string };

function parseFormData(formData: FormData) {
  return {
    title: ((formData.get("title") as string | null) ?? "").trim(),
    description: ((formData.get("description") as string | null) ?? "").trim(),
    suggested_villain_id: (
      (formData.get("suggested_villain_id") as string | null) ?? ""
    ).trim(),
    default_impact_pct: (
      (formData.get("default_impact_pct") as string | null) ?? ""
    ).trim(),
  };
}

function validate(formData: FormData) {
  const parsed = quickWinCatalogSchema.safeParse(parseFormData(formData));
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
    return err("Título já existe no catálogo.", "title_conflict");
  }
  if (error.code === "23503") {
    return err("Vilão inválido.", "validation_suggested_villain_id");
  }
  if (error.code === "23514") {
    return err("Valor inválido (CHECK).", "check_violation");
  }
  return null;
}

export async function createQuickWinCatalogAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const adminGuard = await requireAdminAction();
  if (!adminGuard.ok) return adminGuard;

  const v = validate(formData);
  if (!v.ok) return v;
  const data = v.data;

  const supabase = await createServer();
  const { data: row, error: dbError } = await supabase
    .from("quick_win_catalog")
    .insert({
      title: data.title,
      description: data.description ?? null,
      suggested_villain_id: data.suggested_villain_id ?? null,
      default_impact_pct: data.default_impact_pct ?? null,
    })
    .select("id")
    .single();

  if (dbError) {
    const mapped = mapDbError(dbError as PostgresError);
    if (mapped) return mapped;
    return dbErr(dbError, "createQuickWinCatalogAction");
  }
  if (!row) return err("Falha inesperada ao criar tipo.", "no_data");

  revalidatePath("/catalog/quick-wins");
  return ok({ id: row.id });
}

export async function updateQuickWinCatalogAction(
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
    .from("quick_win_catalog")
    .update({
      title: data.title,
      description: data.description ?? null,
      suggested_villain_id: data.suggested_villain_id ?? null,
      default_impact_pct: data.default_impact_pct ?? null,
    })
    .eq("id", id);

  if (dbError) {
    const mapped = mapDbError(dbError as PostgresError);
    if (mapped) return mapped;
    return dbErr(dbError, "updateQuickWinCatalogAction");
  }

  revalidatePath("/catalog/quick-wins");
  revalidatePath(`/catalog/quick-wins/${id}/edit`);
  return ok({ id });
}

export async function archiveQuickWinCatalogAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const adminGuard = await requireAdminAction();
  if (!adminGuard.ok) return adminGuard;

  const supabase = await createServer();
  const { error: dbError } = await supabase
    .from("quick_win_catalog")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (dbError) return dbErr(dbError, "archiveQuickWinCatalogAction");

  revalidatePath("/catalog/quick-wins");
  return ok({ id });
}

export async function restoreQuickWinCatalogAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const adminGuard = await requireAdminAction();
  if (!adminGuard.ok) return adminGuard;

  const supabase = await createServer();
  const { error: dbError } = await supabase
    .from("quick_win_catalog")
    .update({ archived_at: null })
    .eq("id", id);
  if (dbError) return dbErr(dbError, "restoreQuickWinCatalogAction");

  revalidatePath("/catalog/quick-wins");
  return ok({ id });
}
