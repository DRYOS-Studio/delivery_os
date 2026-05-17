"use server";

import { type ActionResult, dbErr, err, ok } from "@/lib/actions/_types";
import { requireAdminAction, requireUserAction } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";
import {
  getOperation,
  operationHasActiveFrentes,
} from "@/lib/db/queries/operations";
import { operationSchema } from "@/lib/validators/operation";

type PostgresError = { code?: string; message: string };

type CreateInput = {
  client_id: string;
  product_line: "core" | "spark" | "studio";
  name: string;
  status: "em_construcao" | "em_operacao" | "janela_critica";
  recurrence: "mensal" | "trimestral" | "anual" | "unica" | null;
  monthly_recurring_revenue: number | null;
  response_hours: number | null;
  resolution_hours: number | null;
  diagnostic_id: string | null;
  start_date: string | null;
  end_date: string | null;
};

function parseFormDataToInput(formData: FormData): {
  client_id: string;
  product_line: string;
  name: string;
  status: string;
  recurrence: string;
  monthly_recurring_revenue: number | null;
  response_hours: string;
  resolution_hours: string;
  diagnostic_id: string;
  start_date: string;
  end_date: string;
} {
  const mrrRaw = (formData.get("monthly_recurring_revenue") as string | null) ?? "";
  const mrrNumber = mrrRaw === "" ? null : Number(mrrRaw);
  return {
    client_id: ((formData.get("client_id") as string | null) ?? "").trim(),
    product_line: ((formData.get("product_line") as string | null) ?? "").trim(),
    name: ((formData.get("name") as string | null) ?? "").trim(),
    status: ((formData.get("status") as string | null) ?? "").trim(),
    recurrence: ((formData.get("recurrence") as string | null) ?? "").trim(),
    monthly_recurring_revenue:
      mrrNumber !== null && Number.isFinite(mrrNumber) ? mrrNumber : null,
    response_hours: ((formData.get("response_hours") as string | null) ?? "").trim(),
    resolution_hours: ((formData.get("resolution_hours") as string | null) ?? "").trim(),
    diagnostic_id: ((formData.get("diagnostic_id") as string | null) ?? "").trim(),
    start_date: ((formData.get("start_date") as string | null) ?? "").trim(),
    end_date: ((formData.get("end_date") as string | null) ?? "").trim(),
  };
}

function validate(formData: FormData): ActionResult<CreateInput> {
  const raw = parseFormDataToInput(formData);
  const parsed = operationSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const message = first?.message ?? "Dados inválidos.";
    const field = (first?.path[0] as string | undefined) ?? "validation";
    return err(message, `validation_${field}`);
  }
  return ok({
    client_id: parsed.data.client_id,
    product_line: parsed.data.product_line,
    name: parsed.data.name,
    status: parsed.data.status,
    recurrence: parsed.data.recurrence ?? null,
    monthly_recurring_revenue: parsed.data.monthly_recurring_revenue ?? null,
    response_hours: parsed.data.response_hours ?? null,
    resolution_hours: parsed.data.resolution_hours ?? null,
    diagnostic_id: parsed.data.diagnostic_id ?? null,
    start_date: parsed.data.start_date ?? null,
    end_date: parsed.data.end_date ?? null,
  });
}

export async function createOperationAction(
  formData: FormData,
): Promise<ActionResult<{ id: string; name: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const v = validate(formData);
  if (!v.ok) return v;

  const supabase = await createServer();
  const { data, error: dbError } = await supabase
    .from("operations")
    .insert(v.data)
    .select("id, name")
    .single();

  if (dbError) {
    const code = (dbError as PostgresError).code;
    if (code === "23503") return err("Cliente inválido.", "invalid_client");
    return dbErr(dbError, "createOperationAction");
  }
  if (!data) return err("Falha inesperada ao criar Operação.", "no_data");
  return ok({ id: data.id, name: data.name });
}

export async function updateOperationAction(
  id: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const current = await getOperation(id);
  if (!current) return err("Operação não encontrada.", "not_found");

  const v = validate(formData);
  if (!v.ok) return v;

  // client_id não pode mudar — força o valor atual
  const supabase = await createServer();
  const { error: dbError } = await supabase
    .from("operations")
    .update({
      product_line: v.data.product_line,
      name: v.data.name,
      status: v.data.status,
      recurrence: v.data.recurrence,
      monthly_recurring_revenue: v.data.monthly_recurring_revenue,
      response_hours: v.data.response_hours,
      resolution_hours: v.data.resolution_hours,
      diagnostic_id: v.data.diagnostic_id,
      start_date: v.data.start_date,
      end_date: v.data.end_date,
    })
    .eq("id", id);

  if (dbError) return dbErr(dbError, "updateOperationAction");
  return ok({ id });
}

export async function archiveOperationAction(
  id: string,
): Promise<ActionResult<undefined>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const adminGuard = await requireAdminAction();
  if (!adminGuard.ok) return adminGuard;

  const hasFrentes = await operationHasActiveFrentes(id);
  if (hasFrentes) {
    return err(
      "Operação tem Frentes ativas. Arquive-as antes.",
      "has_active_frentes",
    );
  }

  const supabase = await createServer();
  const { error: dbError } = await supabase
    .from("operations")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (dbError) return dbErr(dbError, "archiveOperationAction");
  return ok(undefined);
}
