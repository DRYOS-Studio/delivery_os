"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, dbErr, err, ok } from "@/lib/actions/_types";
import { requireAdminAction } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";
import {
  isClientJourneyStatus,
  type ClientJourneyStatus,
} from "@/lib/utils/client-journey-status";

export async function updateClientJourneyStatusAction(
  clientId: string,
  journeyStatus: string,
): Promise<ActionResult<{ id: string; journey_status: ClientJourneyStatus }>> {
  const admin = await requireAdminAction();
  if (!admin.ok) return admin;

  if (!isClientJourneyStatus(journeyStatus)) {
    return err("Status de jornada inválido.", "validation_journey_status");
  }

  const supabase = await createServer();
  const { data, error } = await supabase
    .from("clients")
    .update({ journey_status: journeyStatus })
    .eq("id", clientId)
    .is("archived_at", null)
    .select("id, journey_status")
    .maybeSingle();

  if (error) return dbErr(error, "updateClientJourneyStatusAction");
  if (!data) return err("Cliente não encontrado.", "not_found");

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  return ok({ id: data.id, journey_status: data.journey_status });
}
