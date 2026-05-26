"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ActionResult, dbErr, err, ok } from "@/lib/actions/_types";
import { requireAdminAction } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";

const inputSchema = z.object({
  operation_id: z.string().uuid("Operação inválida."),
  profile_id: z.string().uuid("Perfil inválido."),
});

type Input = z.infer<typeof inputSchema>;

export async function addOperationMemberAction(
  raw: Input,
): Promise<ActionResult<{ profile_id: string }>> {
  const adminCheck = await requireAdminAction();
  if (!adminCheck.ok) return adminCheck;

  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) {
    return err(
      parsed.error.issues[0]?.message ?? "Dados inválidos.",
      "validation_failed",
    );
  }

  const supabase = await createServer();
  const { error } = await supabase.from("operation_members").insert({
    operation_id: parsed.data.operation_id,
    profile_id: parsed.data.profile_id,
    created_by: adminCheck.data.user.id,
  });

  if (error) {
    if (error.code === "23505") {
      return err("Já é membro desta Operação.", "already_member");
    }
    return dbErr(error, "addOperationMember");
  }

  revalidatePath(`/operations/${parsed.data.operation_id}/settings/members`);
  revalidatePath(`/operations/${parsed.data.operation_id}`);
  revalidatePath(`/operations`);
  return ok({ profile_id: parsed.data.profile_id });
}

export async function removeOperationMemberAction(
  raw: Input,
): Promise<ActionResult<{ profile_id: string }>> {
  const adminCheck = await requireAdminAction();
  if (!adminCheck.ok) return adminCheck;

  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) {
    return err(
      parsed.error.issues[0]?.message ?? "Dados inválidos.",
      "validation_failed",
    );
  }

  const supabase = await createServer();
  const { error } = await supabase
    .from("operation_members")
    .delete()
    .eq("operation_id", parsed.data.operation_id)
    .eq("profile_id", parsed.data.profile_id);

  if (error) return dbErr(error, "removeOperationMember");

  revalidatePath(`/operations/${parsed.data.operation_id}/settings/members`);
  revalidatePath(`/operations/${parsed.data.operation_id}`);
  revalidatePath(`/operations`);
  return ok({ profile_id: parsed.data.profile_id });
}
