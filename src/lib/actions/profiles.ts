"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, dbErr, err, ok } from "@/lib/actions/_types";
import { type Role, requireAdminAction } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";

export async function setUserRoleAction(
  targetUserId: string,
  newRole: Role,
): Promise<ActionResult<{ id: string; role: Role }>> {
  const guard = await requireAdminAction();
  if (!guard.ok) return guard;

  if (
    targetUserId === guard.data.user.id &&
    newRole !== "admin"
  ) {
    return err(
      "Você não pode rebaixar seu próprio acesso. Peça pra outro admin.",
      "self_demote_blocked",
    );
  }

  const supabase = await createServer();
  const { error } = await supabase
    .from("profiles")
    .update({ role: newRole })
    .eq("id", targetUserId);
  if (error) return dbErr(error, "setUserRoleAction");

  revalidatePath("/admin");
  return ok({ id: targetUserId, role: newRole });
}
