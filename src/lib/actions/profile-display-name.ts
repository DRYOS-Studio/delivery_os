"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, dbErr, err, ok } from "@/lib/actions/_types";
import { requireAdminAction, requireProfile } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";

export async function setProfileDisplayNameAction(
  profileId: string,
  rawName: string,
): Promise<ActionResult<{ name: string | null }>> {
  const profile = await requireProfile();

  if (profileId !== profile.user.id) {
    const admin = await requireAdminAction();
    if (!admin.ok) return admin;
  }

  const name = rawName.trim();
  const supabase = await createServer();
  const { error } = await supabase.rpc("set_profile_display_name", {
    p_profile_id: profileId,
    p_name: name,
  });
  if (error) return dbErr(error, "setProfileDisplayNameAction");

  revalidatePath("/profile");
  revalidatePath("/admin");

  return ok({ name: name === "" ? null : name });
}
