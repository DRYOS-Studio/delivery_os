"use server";

import { revalidatePath } from "next/cache";
import { logProfileActivity } from "@/lib/actions/admin-activity";
import { assertNotSelfDemote } from "@/lib/auth/self-demote-guard";
import { type ActionResult, dbErr, err, ok } from "@/lib/actions/_types";
import { type Role, requireAdminAction } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";

export async function setUserRoleAction(
  targetUserId: string,
  newRole: Role,
): Promise<ActionResult<{ id: string; role: Role }>> {
  const guard = await requireAdminAction();
  if (!guard.ok) return guard;

  const block = assertNotSelfDemote(guard.data.user.id, targetUserId, newRole);
  if (!block.ok) return block;

  const supabase = await createServer();
  const { data: before, error: bErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", targetUserId)
    .maybeSingle();
  if (bErr) return dbErr(bErr, "setUserRoleAction.before");
  if (!before) return err("Perfil não encontrado.", "not_found");

  const { error } = await supabase
    .from("profiles")
    .update({ role: newRole })
    .eq("id", targetUserId);
  if (error) return dbErr(error, "setUserRoleAction");

  if (before.role !== newRole) {
    try {
      await logProfileActivity(targetUserId, "role_changed", "role", before.role, newRole, {});
    } catch {
      /* migration profile */
    }
  }

  revalidatePath("/admin");
  return ok({ id: targetUserId, role: newRole });
}
