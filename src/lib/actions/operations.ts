"use server";

import {
  type ActionResult,
  dbErr,
  err,
  ok,
  rpcErr,
} from "@/lib/actions/_types";
import { requireAdminAction, requireUserAction } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";
import {
  getOperation,
} from "@/lib/db/queries/operations";
import { operationSchema } from "@/lib/validators/operation";
import {
  isActiveStatus,
  type OperationStatus,
} from "@/lib/utils/operation-status";

type PostgresError = { code?: string; message: string };

type CreateInput = {
  client_id: string;
  product_line: "core" | "spark" | "studio";
  name: string;
  status: OperationStatus;
  recurrence: "mensal" | "trimestral" | "anual" | "unica" | null;
  monthly_recurring_revenue: number | null;
  monthly_fixed_cost: number | null;
  response_hours: number | null;
  resolution_hours: number | null;
  diagnostic_id: string | null;
  start_date: string | null;
  end_date: string | null;
  notification_webhook_url: string | null;
};

function parseFormDataToInput(formData: FormData): {
  client_id: string;
  product_line: string;
  name: string;
  status: string;
  recurrence: string;
  monthly_recurring_revenue: number | null;
  monthly_fixed_cost: string;
  response_hours: string;
  resolution_hours: string;
  diagnostic_id: string;
  start_date: string;
  end_date: string;
  notification_webhook_url: string;
} {
  const mrrRaw = (formData.get("monthly_recurring_revenue") as string | null) ?? "";
  const mrrNumber = mrrRaw === "" ? null : Number(mrrRaw);
  const costRaw =
    (formData.get("monthly_fixed_cost") as string | null) ?? "";
  return {
    client_id: ((formData.get("client_id") as string | null) ?? "").trim(),
    product_line: ((formData.get("product_line") as string | null) ?? "").trim(),
    name: ((formData.get("name") as string | null) ?? "").trim(),
    status: ((formData.get("status") as string | null) ?? "").trim(),
    recurrence: ((formData.get("recurrence") as string | null) ?? "").trim(),
    monthly_recurring_revenue:
      mrrNumber !== null && Number.isFinite(mrrNumber) ? mrrNumber : null,
    monthly_fixed_cost: costRaw,
    response_hours: ((formData.get("response_hours") as string | null) ?? "").trim(),
    resolution_hours: ((formData.get("resolution_hours") as string | null) ?? "").trim(),
    diagnostic_id: ((formData.get("diagnostic_id") as string | null) ?? "").trim(),
    start_date: ((formData.get("start_date") as string | null) ?? "").trim(),
    end_date: ((formData.get("end_date") as string | null) ?? "").trim(),
    notification_webhook_url: (
      (formData.get("notification_webhook_url") as string | null) ?? ""
    ).trim(),
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
    monthly_fixed_cost: parsed.data.monthly_fixed_cost ?? null,
    response_hours: parsed.data.response_hours ?? null,
    resolution_hours: parsed.data.resolution_hours ?? null,
    diagnostic_id: parsed.data.diagnostic_id ?? null,
    start_date: parsed.data.start_date ?? null,
    end_date: parsed.data.end_date ?? null,
    notification_webhook_url: parsed.data.notification_webhook_url ?? null,
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

  // Encerrar é ato de admin. Sem este guard, um membro com linha em
  // `operation_members` grava `cancelada` (a RLS de UPDATE é `can_see_operation`,
  // não `is_admin`), o trigger `trg_operations_revoke_links` dispara e os links
  // públicos do cliente são revogados **irreversivelmente** — ação que
  // `revokePublicLinkAction` reserva a admin. Só barra a TRANSIÇÃO: membro segue
  // editando os demais campos de uma Operação já encerrada.
  if (!isActiveStatus(v.data.status) && v.data.status !== current.status) {
    const adminGuard = await requireAdminAction();
    if (!adminGuard.ok) return adminGuard;
  }

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
      monthly_fixed_cost: v.data.monthly_fixed_cost,
      response_hours: v.data.response_hours,
      resolution_hours: v.data.resolution_hours,
      diagnostic_id: v.data.diagnostic_id,
      start_date: v.data.start_date,
      end_date: v.data.end_date,
      notification_webhook_url: v.data.notification_webhook_url,
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

  // Sem pré-check de Frentes: a cascata arquiva as Frentes e fecha as alocações.
  // A única precondição é semântica e vive na função SQL: status terminal.
  const supabase = await createServer();
  const { error: dbError } = await supabase.rpc("archive_operation_cascade", {
    p_operation_id: id,
  });
  if (dbError) return rpcErr(dbError, "archiveOperationAction");
  return ok(undefined);
}

export async function restoreOperationAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const adminGuard = await requireAdminAction();
  if (!adminGuard.ok) return adminGuard;

  // A RPC revoga os public_links ANTES de desarquivar, na mesma transação: fazer isso
  // em duas escritas soltas abriria janela em que o token antigo volta a servir
  // /public/<token> — e a rota de download emite signed URL que a revogação posterior
  // não invalida.
  const supabase = await createServer();
  const { error: dbError } = await supabase.rpc("restore_operation", {
    p_operation_id: id,
  });
  if (dbError) return rpcErr(dbError, "restoreOperationAction");
  return ok({ id });
}
