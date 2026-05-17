"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, dbErr, err, ok } from "@/lib/actions/_types";
import { requireAdminAction, requireUserAction } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";
import { getQuickWin } from "@/lib/db/queries/quick-wins";
import {
  quickWinSchema,
  type QuickWinOutput,
} from "@/lib/validators/quick-win";

type PostgresError = { code?: string; message: string };

function parseFormData(formData: FormData) {
  const impactsRaw = (formData.get("impacts") as string | null) ?? "[]";
  let impacts: unknown = [];
  try {
    impacts = JSON.parse(impactsRaw);
  } catch {
    impacts = [];
  }
  return {
    title: ((formData.get("title") as string | null) ?? "").trim(),
    description: ((formData.get("description") as string | null) ?? "").trim(),
    happened_at: ((formData.get("happened_at") as string | null) ?? "").trim(),
    frente_id: ((formData.get("frente_id") as string | null) ?? "").trim(),
    impacts,
  };
}

function validate(formData: FormData) {
  const parsed = quickWinSchema.safeParse(parseFormData(formData));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const message = first?.message ?? "Dados inválidos.";
    const field = (first?.path[0] as string | undefined) ?? "validation";
    return err(message, `validation_${field}`);
  }
  return ok(parsed.data);
}

function mapImpactError(error: PostgresError) {
  if (error.code === "23514" && error.message.includes("Inv. 08")) {
    return err(error.message, "impact_cap_exceeded");
  }
  if (error.code === "23505") {
    return err("Vilão duplicado em impactos.", "duplicate_impact");
  }
  if (error.code === "23503") {
    return err("Vilão inválido.", "invalid_villain");
  }
  return null;
}

async function insertImpacts(
  quickWinId: string,
  impacts: QuickWinOutput["impacts"],
): Promise<ActionResult<true>> {
  if (impacts.length === 0) return ok(true);
  const supabase = await createServer();
  const rows = impacts.map((imp) => ({
    quick_win_id: quickWinId,
    operation_villain_id: imp.operation_villain_id,
    impact_pct: imp.impact_pct,
  }));
  // Insert um a um pra mapear qual impact falhou (trigger Inv. 08 rejeita individualmente)
  for (const row of rows) {
    const { error } = await supabase.from("quick_win_impacts").insert(row);
    if (error) {
      const mapped = mapImpactError(error as PostgresError);
      if (mapped) return mapped;
      return dbErr(error, "insertImpacts");
    }
  }
  return ok(true);
}

export async function createQuickWinAction(
  operationId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string; operationId: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;
  const userId = userResult.data.id;

  const v = validate(formData);
  if (!v.ok) return v;
  const data: QuickWinOutput = v.data;

  const supabase = await createServer();
  const { data: qw, error: insErr } = await supabase
    .from("quick_wins")
    .insert({
      operation_id: operationId,
      frente_id: data.frente_id ?? null,
      executor_id: userId,
      title: data.title,
      description: data.description ?? null,
      happened_at: data.happened_at,
    })
    .select("id")
    .single();
  if (insErr) return dbErr(insErr, "createQuickWinAction.qw");
  if (!qw) return err("Falha ao criar Quick Win.", "no_data");

  const impResult = await insertImpacts(qw.id, data.impacts);
  if (!impResult.ok) {
    // Rollback manual: deletar o QW recém-criado
    await supabase
      .from("quick_wins")
      .delete()
      .eq("id", qw.id)
      .then(() => undefined);
    return impResult;
  }

  revalidatePath(`/operations/${operationId}`);
  return ok({ id: qw.id, operationId });
}

export async function updateQuickWinAction(
  qwId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string; operationId: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const current = await getQuickWin(qwId);
  if (!current) return err("Quick Win não encontrado.", "not_found");

  const v = validate(formData);
  if (!v.ok) return v;
  const data: QuickWinOutput = v.data;

  const supabase = await createServer();
  const { error: upErr } = await supabase
    .from("quick_wins")
    .update({
      frente_id: data.frente_id ?? null,
      title: data.title,
      description: data.description ?? null,
      happened_at: data.happened_at,
    })
    .eq("id", qwId);
  if (upErr) return dbErr(upErr, "updateQuickWinAction.qw");

  // Delete impacts existentes + re-insert
  const { error: delErr } = await supabase
    .from("quick_win_impacts")
    .delete()
    .eq("quick_win_id", qwId);
  if (delErr) return dbErr(delErr, "updateQuickWinAction.delImpacts");

  const impResult = await insertImpacts(qwId, data.impacts);
  if (!impResult.ok) {
    // Não temos rollback automático aqui; impactos antigos já foram deletados.
    // Admin precisa re-tentar com impacts ajustados ou deletar QW manualmente.
    return impResult;
  }

  revalidatePath(`/operations/${current.operation_id}`);
  return ok({ id: qwId, operationId: current.operation_id });
}

export async function deleteQuickWinAction(
  qwId: string,
): Promise<ActionResult<{ operationId: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const adminGuard = await requireAdminAction();
  if (!adminGuard.ok) return adminGuard;

  const current = await getQuickWin(qwId);
  if (!current) return err("Quick Win não encontrado.", "not_found");

  const supabase = await createServer();
  // CASCADE remove impacts; trigger sync_operation_villain_progress recalcula
  const { error } = await supabase
    .from("quick_wins")
    .delete()
    .eq("id", qwId);
  if (error) return dbErr(error, "deleteQuickWinAction");

  revalidatePath(`/operations/${current.operation_id}`);
  return ok({ operationId: current.operation_id });
}
