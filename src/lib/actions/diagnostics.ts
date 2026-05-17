"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, dbErr, err, ok } from "@/lib/actions/_types";
import { requireUserAction } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";
import {
  diagnosticSchema,
  type DiagnosticOutput,
} from "@/lib/validators/diagnostic";

function parseFormData(formData: FormData) {
  return {
    notes: ((formData.get("notes") as string | null) ?? "").trim(),
    recommended_product: ((formData.get("recommended_product") as string | null) ?? "").trim(),
    conducted_at: ((formData.get("conducted_at") as string | null) ?? "").trim(),
  };
}

function validate(formData: FormData) {
  const parsed = diagnosticSchema.safeParse(parseFormData(formData));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const message = first?.message ?? "Dados inválidos.";
    const field = (first?.path[0] as string | undefined) ?? "validation";
    return err(message, `validation_${field}`);
  }
  return ok(parsed.data);
}

export async function upsertDiagnosticAction(
  clientId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string; clientId: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const v = validate(formData);
  if (!v.ok) return v;
  const data: DiagnosticOutput = v.data;

  const supabase = await createServer();

  const { data: existing, error: selErr } = await supabase
    .from("diagnostics")
    .select("id")
    .eq("client_id", clientId)
    .maybeSingle();
  if (selErr) return dbErr(selErr, "upsertDiagnosticAction.select");

  const patch = {
    notes: data.notes,
    recommended_product: data.recommended_product ?? null,
    conducted_at: data.conducted_at ?? null,
  };

  let resultId: string;

  if (existing) {
    const { error } = await supabase
      .from("diagnostics")
      .update(patch)
      .eq("id", existing.id);
    if (error) return dbErr(error, "upsertDiagnosticAction.update");
    resultId = existing.id;
  } else {
    const { data: inserted, error } = await supabase
      .from("diagnostics")
      .insert({ client_id: clientId, ...patch })
      .select("id")
      .single();
    if (error) return dbErr(error, "upsertDiagnosticAction.insert");
    if (!inserted) return err("Falha ao criar diagnóstico.", "no_data");
    resultId = inserted.id;
  }

  revalidatePath(`/clients/${clientId}`);
  return ok({ id: resultId, clientId });
}
