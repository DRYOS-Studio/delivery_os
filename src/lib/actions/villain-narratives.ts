"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, dbErr, err, ok } from "@/lib/actions/_types";
import { requireUserAction } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";
import { villainNarrativeSchema } from "@/lib/validators/villain-narrative";

function parseFormData(formData: FormData) {
  return {
    narrative_text: ((formData.get("narrative_text") as string | null) ?? "").trim(),
    period_yyyymm: ((formData.get("period_yyyymm") as string | null) ?? "").trim(),
  };
}

export async function upsertVillainNarrativeAction(
  operationVillainId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string; operationId: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const parsed = villainNarrativeSchema.safeParse(parseFormData(formData));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const message = first?.message ?? "Dados inválidos.";
    const field = (first?.path[0] as string | undefined) ?? "validation";
    return err(message, `validation_${field}`);
  }
  const data = parsed.data;

  const supabase = await createServer();

  const { data: ov, error: ovErr } = await supabase
    .from("operation_villains")
    .select("operation_id, villain_id")
    .eq("id", operationVillainId)
    .maybeSingle();
  if (ovErr) return dbErr(ovErr, "upsertVillainNarrative.ov");
  if (!ov) return err("Vilão da Operação não encontrado.", "not_found");

  const { data: row, error: upsertErr } = await supabase
    .from("operation_villain_narratives")
    .upsert(
      {
        operation_id: ov.operation_id,
        villain_id: ov.villain_id,
        period_yyyymm: data.period_yyyymm,
        narrative_text: data.narrative_text,
      },
      { onConflict: "operation_id,villain_id,period_yyyymm" },
    )
    .select("id")
    .single();

  if (upsertErr) return dbErr(upsertErr, "upsertVillainNarrative");
  if (!row) return err("Falha inesperada ao salvar narrativa.", "no_data");

  revalidatePath(`/operations/${ov.operation_id}`);

  return ok({ id: row.id, operationId: ov.operation_id });
}
