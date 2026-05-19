"use server";

import { type ActionResult, dbErr, err, ok } from "@/lib/actions/_types";
import { requireAdminAction, requireUserAction } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";
import {
  frenteHasActiveAllocations,
  getFrente,
} from "@/lib/db/queries/frentes";
import { frenteSchema } from "@/lib/validators/frente";

type PostgresError = { code?: string; message: string };

function parseFormData(formData: FormData) {
  return {
    name: ((formData.get("name") as string | null) ?? "").trim(),
    cycle_type: ((formData.get("cycle_type") as string | null) ?? "").trim(),
    domain: ((formData.get("domain") as string | null) ?? "").trim(),
    phase: ((formData.get("phase") as string | null) ?? "").trim(),
    actionable_status: (
      (formData.get("actionable_status") as string | null) ?? ""
    ).trim(),
    responsible_person_id: (
      (formData.get("responsible_person_id") as string | null) ?? ""
    ).trim(),
    product_id: ((formData.get("product_id") as string | null) ?? "").trim(),
    start_date: ((formData.get("start_date") as string | null) ?? "").trim(),
    end_date: ((formData.get("end_date") as string | null) ?? "").trim(),
  };
}

function validate(formData: FormData) {
  const raw = parseFormData(formData);
  const parsed = frenteSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const message = first?.message ?? "Dados inválidos.";
    const field = (first?.path[0] as string | undefined) ?? "validation";
    return err(message, `validation_${field}`);
  }
  return ok(parsed.data);
}

function mapDbError(error: PostgresError) {
  if (error.code === "23503") {
    if (error.message.includes("product_id")) {
      return err("Produto inválido.", "validation_product_id");
    }
    return err("Operação ou Responsável inválido.", "invalid_fk");
  }
  if (error.code === "23514") {
    return err(
      "Status acionável não atende às regras do sistema.",
      "check_violation",
    );
  }
  return null;
}

export async function createFrenteAction(
  operationId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string; operationId: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const v = validate(formData);
  if (!v.ok) return v;
  const data = v.data;

  const supabase = await createServer();
  const { data: row, error: dbError } = await supabase
    .from("frentes")
    .insert({
      operation_id: operationId,
      name: data.name,
      cycle_type: data.cycle_type,
      domain: data.domain,
      phase: data.phase,
      actionable_status: data.actionable_status,
      actionable_status_since: new Date().toISOString(),
      responsible_person_id: data.responsible_person_id ?? null,
      product_id: data.product_id ?? null,
      start_date: data.start_date ?? null,
      end_date: data.end_date ?? null,
    })
    .select("id")
    .single();

  if (dbError) {
    const mapped = mapDbError(dbError as PostgresError);
    if (mapped) return mapped;
    return dbErr(dbError, "createFrenteAction");
  }
  if (!row) return err("Falha inesperada ao criar Frente.", "no_data");
  return ok({ id: row.id, operationId });
}

export async function updateFrenteAction(
  id: string,
  formData: FormData,
): Promise<ActionResult<{ id: string; operationId: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const current = await getFrente(id);
  if (!current) return err("Frente não encontrada.", "not_found");

  const v = validate(formData);
  if (!v.ok) return v;
  const data = v.data;

  const statusChanged =
    current.actionable_status.trim().toLowerCase() !==
    data.actionable_status.trim().toLowerCase();

  const supabase = await createServer();
  const patch = {
    name: data.name,
    cycle_type: data.cycle_type,
    domain: data.domain,
    phase: data.phase,
    actionable_status: data.actionable_status,
    responsible_person_id: data.responsible_person_id ?? null,
    product_id: data.product_id ?? null,
    start_date: data.start_date ?? null,
    end_date: data.end_date ?? null,
    ...(statusChanged && {
      actionable_status_since: new Date().toISOString(),
    }),
  };

  const { error: dbError } = await supabase
    .from("frentes")
    .update(patch)
    .eq("id", id);

  if (dbError) {
    const mapped = mapDbError(dbError as PostgresError);
    if (mapped) return mapped;
    return dbErr(dbError, "updateFrenteAction");
  }

  return ok({ id, operationId: current.operation_id });
}

export async function archiveFrenteAction(
  id: string,
): Promise<ActionResult<{ operationId: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const adminGuard = await requireAdminAction();
  if (!adminGuard.ok) return adminGuard;

  const current = await getFrente(id);
  if (!current) return err("Frente não encontrada.", "not_found");

  const hasAllocations = await frenteHasActiveAllocations(id);
  if (hasAllocations) {
    return err(
      "Frente tem alocações ativas. Remova-as antes de arquivar.",
      "has_active_allocations",
    );
  }

  const supabase = await createServer();
  const { error: dbError } = await supabase
    .from("frentes")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);

  if (dbError) return dbErr(dbError, "archiveFrenteAction");
  return ok({ operationId: current.operation_id });
}
