"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ActionResult, dbErr, err, ok } from "@/lib/actions/_types";
import { requireAdminAction } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";

const nameSchema = z
  .string()
  .trim()
  .min(2, "Mínimo 2 caracteres.")
  .max(50, "Máximo 50 caracteres.");

/** lower, sem acento, kebab. Estável — usado como identificador da área. */
function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function createAreaAction(
  rawName: string,
): Promise<ActionResult<{ id: string }>> {
  const admin = await requireAdminAction();
  if (!admin.ok) return admin;

  const parsed = nameSchema.safeParse(rawName);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Nome inválido.", "validation_failed");
  }
  const name = parsed.data;
  const slug = slugify(name);
  if (!slug) return err("Nome inválido (vazio após normalizar).", "validation_failed");

  const supabase = await createServer();
  const { data, error } = await supabase
    .from("areas")
    .insert({ slug, name, created_by: admin.data.user.id })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505")
      return err("Já existe uma área com esse nome.", "validation_failed");
    return dbErr(error, "createArea");
  }
  if (!data) return err("Falha ao criar área.", "no_data");

  revalidatePath("/admin/areas");
  return ok({ id: data.id });
}

export async function updateAreaAction(
  id: string,
  rawName: string,
): Promise<ActionResult<{ id: string }>> {
  const admin = await requireAdminAction();
  if (!admin.ok) return admin;

  const parsed = nameSchema.safeParse(rawName);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Nome inválido.", "validation_failed");
  }

  const supabase = await createServer();
  // Renomeia só o rótulo; slug permanece estável (identificador).
  const { error } = await supabase
    .from("areas")
    .update({ name: parsed.data })
    .eq("id", id);
  if (error) return dbErr(error, "updateArea");

  revalidatePath("/admin/areas");
  revalidatePath(`/admin/areas/${id}`);
  return ok({ id });
}

export async function archiveAreaAction(
  id: string,
  archived: boolean,
): Promise<ActionResult<{ id: string }>> {
  const admin = await requireAdminAction();
  if (!admin.ok) return admin;

  const supabase = await createServer();
  const { error } = await supabase
    .from("areas")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return dbErr(error, "archiveArea");

  revalidatePath("/admin/areas");
  revalidatePath(`/admin/areas/${id}`);
  return ok({ id });
}
