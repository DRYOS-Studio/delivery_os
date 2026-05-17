"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, dbErr, err, ok } from "@/lib/actions/_types";
import { requireUserAction } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";
import { briefingSchema } from "@/lib/validators/briefing";

function parseFormData(formData: FormData) {
  const get = (k: string) =>
    ((formData.get(k) as string | null) ?? "").toString();
  return {
    contexto: get("contexto"),
    objetivos: get("objetivos"),
    escopo_incluido: get("escopo_incluido"),
    escopo_excluido: get("escopo_excluido"),
    premissas: get("premissas"),
    riscos: get("riscos"),
    stakeholders: get("stakeholders"),
    observacoes: get("observacoes"),
  };
}

function validate(formData: FormData) {
  const parsed = briefingSchema.safeParse(parseFormData(formData));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const message = first?.message ?? "Dados inválidos.";
    const field = (first?.path[0] as string | undefined) ?? "validation";
    return err(message, `validation_${field}`);
  }
  return ok(parsed.data);
}

export async function saveBriefingAction(
  operationId: string,
  formData: FormData,
): Promise<ActionResult<{ operationId: string; versionId: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;
  const userId = userResult.data.id;

  const v = validate(formData);
  if (!v.ok) return v;
  const data = v.data;

  const supabase = await createServer();

  // 1. Upsert briefing (1:1 com operation)
  let briefingId: string | null = null;
  {
    const { data: existing, error: selErr } = await supabase
      .from("briefings")
      .select("id")
      .eq("operation_id", operationId)
      .maybeSingle();
    if (selErr) return dbErr(selErr, "saveBriefingAction.select");

    if (existing) {
      briefingId = existing.id;
    } else {
      const { data: inserted, error: insErr } = await supabase
        .from("briefings")
        .insert({ operation_id: operationId })
        .select("id")
        .single();
      if (insErr) return dbErr(insErr, "saveBriefingAction.insert_briefing");
      if (!inserted)
        return err("Falha ao criar briefing.", "no_data");
      briefingId = inserted.id;
    }
  }

  // 2. Insert version (append-only snapshot)
  const { data: version, error: vErr } = await supabase
    .from("briefing_versions")
    .insert({
      briefing_id: briefingId,
      contexto: data.contexto ?? null,
      objetivos: data.objetivos ?? null,
      escopo_incluido: data.escopo_incluido ?? null,
      escopo_excluido: data.escopo_excluido ?? null,
      premissas: data.premissas ?? null,
      riscos: data.riscos ?? null,
      stakeholders: data.stakeholders ?? null,
      observacoes: data.observacoes ?? null,
      author_id: userId,
    })
    .select("id")
    .single();
  if (vErr) return dbErr(vErr, "saveBriefingAction.insert_version");
  if (!version) return err("Falha ao salvar versão.", "no_data");

  // 3. Update current_version_id
  const { error: uErr } = await supabase
    .from("briefings")
    .update({ current_version_id: version.id })
    .eq("id", briefingId);
  if (uErr) return dbErr(uErr, "saveBriefingAction.update_current");

  revalidatePath(`/operations/${operationId}`);
  revalidatePath(`/operations/${operationId}/briefing`);
  revalidatePath(`/operations/${operationId}/briefing/edit`);
  revalidatePath(`/operations/${operationId}/briefing/history`);

  return ok({ operationId, versionId: version.id });
}
