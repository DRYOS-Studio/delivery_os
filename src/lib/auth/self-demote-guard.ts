import { type ActionResult, err, ok } from "@/lib/actions/_types";

/** Espelha a política de não auto-rebaixamento de papel (admin UI + actions). */
export function assertNotSelfDemote(
  actorUserId: string,
  targetUserId: string,
  newRole: "admin" | "member",
): ActionResult<true> {
  if (actorUserId === targetUserId && newRole !== "admin") {
    return err(
      "Você não pode rebaixar seu próprio acesso. Peça pra outro admin.",
      "self_demote_blocked",
    );
  }
  return ok(true);
}
