"use server";

import { type ActionResult, dbErr, err, ok } from "@/lib/actions/_types";
import { requireAdminAction, requireUserAction } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";
import { getAllocation } from "@/lib/db/queries/allocations";
import { getFrente } from "@/lib/db/queries/frentes";
import { allocationSchema } from "@/lib/validators/allocation";

type PostgresError = { code?: string; message: string };

function parseFormData(formData: FormData) {
  return {
    person_id: ((formData.get("person_id") as string | null) ?? "").trim(),
    role: ((formData.get("role") as string | null) ?? "").trim(),
    capacity_weekly_pct: (formData.get("capacity_weekly_pct") as string | null) ?? "",
    start_date: ((formData.get("start_date") as string | null) ?? "").trim(),
    end_date: ((formData.get("end_date") as string | null) ?? "").trim(),
  };
}

function validate(formData: FormData) {
  const parsed = allocationSchema.safeParse(parseFormData(formData));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const message = first?.message ?? "Dados inválidos.";
    const field = (first?.path[0] as string | undefined) ?? "validation";
    return err(message, `validation_${field}`);
  }
  return ok(parsed.data);
}

function mapDbError(error: PostgresError) {
  if (error.code === "23503") return err("Pessoa ou Frente inválida.", "invalid_fk");
  if (error.code === "23514") return err("Valores fora do permitido.", "check_violation");
  return null;
}

export async function createAllocationAction(
  operationId: string,
  frenteId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string; frenteId: string; operationId: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const v = validate(formData);
  if (!v.ok) return v;
  const data = v.data;

  const supabase = await createServer();
  const { data: row, error: dbError } = await supabase
    .from("allocations")
    .insert({
      frente_id: frenteId,
      person_id: data.person_id,
      role: data.role,
      capacity_weekly_pct: data.capacity_weekly_pct,
      start_date: data.start_date,
      end_date: data.end_date ?? null,
    })
    .select("id")
    .single();

  if (dbError) {
    const mapped = mapDbError(dbError as PostgresError);
    if (mapped) return mapped;
    return dbErr(dbError, "createAllocationAction");
  }
  if (!row) return err("Falha inesperada ao criar alocação.", "no_data");
  return ok({ id: row.id, frenteId, operationId });
}

export async function updateAllocationAction(
  id: string,
  formData: FormData,
): Promise<ActionResult<{ id: string; frenteId: string; operationId: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const current = await getAllocation(id);
  if (!current) return err("Alocação não encontrada.", "not_found");

  const v = validate(formData);
  if (!v.ok) return v;
  const data = v.data;

  // person_id locked em edit — força valor atual
  const supabase = await createServer();
  const { error: dbError } = await supabase
    .from("allocations")
    .update({
      role: data.role,
      capacity_weekly_pct: data.capacity_weekly_pct,
      start_date: data.start_date,
      end_date: data.end_date ?? null,
    })
    .eq("id", id);

  if (dbError) {
    const mapped = mapDbError(dbError as PostgresError);
    if (mapped) return mapped;
    return dbErr(dbError, "updateAllocationAction");
  }

  const frente = await getFrente(current.frente_id);
  if (!frente) return err("Frente não encontrada.", "not_found");
  return ok({ id, frenteId: current.frente_id, operationId: frente.operation_id });
}

export async function deleteAllocationAction(
  id: string,
): Promise<ActionResult<{ frenteId: string; operationId: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const adminGuard = await requireAdminAction();
  if (!adminGuard.ok) return adminGuard;

  const current = await getAllocation(id);
  if (!current) return err("Alocação não encontrada.", "not_found");

  const frente = await getFrente(current.frente_id);
  if (!frente) return err("Frente não encontrada.", "not_found");

  const supabase = await createServer();
  const { error: dbError } = await supabase
    .from("allocations")
    .delete()
    .eq("id", id);
  if (dbError) return dbErr(dbError, "deleteAllocationAction");
  return ok({ frenteId: current.frente_id, operationId: frente.operation_id });
}
