"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, dbErr, err, ok } from "@/lib/actions/_types";
import { requireUserAction } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";
import {
  villainSchema,
  type VillainOutput,
} from "@/lib/validators/villain";

type PostgresError = { code?: string; message: string };

function parseFormData(formData: FormData) {
  return {
    name: ((formData.get("name") as string | null) ?? "").trim(),
    slug: ((formData.get("slug") as string | null) ?? "").trim(),
    quote: ((formData.get("quote") as string | null) ?? "").trim(),
    description: ((formData.get("description") as string | null) ?? "").trim(),
    icon_name: ((formData.get("icon_name") as string | null) ?? "").trim(),
    pill_variant: ((formData.get("pill_variant") as string | null) ?? "").trim(),
    display_order: ((formData.get("display_order") as string | null) ?? "").trim(),
  };
}

function validate(formData: FormData) {
  const parsed = villainSchema.safeParse(parseFormData(formData));
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
    if (error.message.includes("slug")) {
      return err("Slug já em uso.", "validation_slug");
    }
    if (error.message.includes("display_order")) {
      return err("Ordem já em uso.", "validation_display_order");
    }
    return err("Valor duplicado.", "unique_violation");
  }
  if (error.code === "23514") {
    return err("Valor inválido (CHECK).", "check_violation");
  }
  return null;
}

export async function updateVillainAction(
  id: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const v = validate(formData);
  if (!v.ok) return v;
  const data: VillainOutput = v.data;

  const supabase = await createServer();
  const { error } = await supabase
    .from("villains")
    .update({
      name: data.name,
      slug: data.slug,
      quote: data.quote,
      description: data.description,
      icon_name: data.icon_name,
      pill_variant: data.pill_variant,
      display_order: data.display_order,
    })
    .eq("id", id);
  if (error) {
    const mapped = mapDbError(error as PostgresError);
    if (mapped) return mapped;
    return dbErr(error, "updateVillainAction");
  }

  revalidatePath("/catalog");
  return ok({ id });
}

export async function archiveVillainAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const supabase = await createServer();
  const { error } = await supabase
    .from("villains")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return dbErr(error, "archiveVillainAction");

  revalidatePath("/catalog");
  return ok({ id });
}

export async function restoreVillainAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const supabase = await createServer();
  const { error } = await supabase
    .from("villains")
    .update({ archived_at: null })
    .eq("id", id);
  if (error) return dbErr(error, "restoreVillainAction");

  revalidatePath("/catalog");
  return ok({ id });
}
