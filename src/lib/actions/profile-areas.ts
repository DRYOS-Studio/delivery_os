"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ActionResult, dbErr, err, ok } from "@/lib/actions/_types";
import { requireAdminAction } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";

const schema = z.object({
  profile_id: z.string().uuid("Perfil inválido."),
  area_id: z.string().uuid("Área inválida."),
});

type Input = z.infer<typeof schema>;

export async function addProfileAreaAction(
  raw: Input,
): Promise<ActionResult<Input>> {
  const adminCheck = await requireAdminAction();
  if (!adminCheck.ok) return adminCheck;

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return err(
      parsed.error.issues[0]?.message ?? "Dados inválidos.",
      "validation_failed",
    );
  }

  const supabase = await createServer();
  const { error } = await supabase.from("profile_areas").insert({
    profile_id: parsed.data.profile_id,
    area_id: parsed.data.area_id,
    created_by: adminCheck.data.user.id,
  });
  // 23505 = já tem a área; idempotente.
  if (error && error.code !== "23505") return dbErr(error, "addProfileArea");

  revalidatePath("/admin/areas");
  return ok(parsed.data);
}

export async function removeProfileAreaAction(
  raw: Input,
): Promise<ActionResult<Input>> {
  const adminCheck = await requireAdminAction();
  if (!adminCheck.ok) return adminCheck;

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return err(
      parsed.error.issues[0]?.message ?? "Dados inválidos.",
      "validation_failed",
    );
  }

  const supabase = await createServer();
  const { error } = await supabase
    .from("profile_areas")
    .delete()
    .eq("profile_id", parsed.data.profile_id)
    .eq("area_id", parsed.data.area_id);
  if (error) return dbErr(error, "removeProfileArea");

  revalidatePath("/admin/areas");
  return ok(parsed.data);
}
