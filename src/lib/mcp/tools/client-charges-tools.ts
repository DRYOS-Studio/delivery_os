import {
  cancelClientCharge,
  deleteClientCharge,
  generateClientChargesFromContract,
  listClientCharges,
  markClientChargePaid,
  undoClientChargePayment,
  updateClientCharge,
  type ClientChargeRow,
} from "@/lib/db/queries/client-charges";
import type { ClientChargeDiscountKind } from "@/lib/utils/client-charge-amount";
import {
  generateClientChargesSchema,
  markClientChargePaidSchema,
  undoClientChargePaymentSchema,
  updateClientChargeSchema,
} from "@/lib/validators/client-charge";
import {
  mcpRequireAdmin,
  type McpHandlerContext,
  type McpToolResult,
} from "@/lib/mcp/tools/shared";
import { z } from "zod";

function serializeCharge(c: ClientChargeRow) {
  return {
    id: c.id,
    client_id: c.clientId,
    client_contract_id: c.clientContractId,
    operation_id: c.operationId,
    charge_type: c.chargeType,
    competence: c.competence,
    due_date: c.dueDate,
    amount: c.amount,
    discount_kind: c.discountKind,
    discount_input: c.discountInput,
    discount_amount: c.discountAmount,
    net_due: c.netDue,
    status: c.status,
    effective_status: c.effectiveStatus,
    open_amount: c.openAmount,
    paid_at: c.paidAt,
    paid_amount: c.paidAmount,
    payment_method: c.paymentMethod,
    notes: c.notes,
    external_provider: c.externalProvider,
    external_id: c.externalId,
  };
}

const listArgs = z.object({
  client_id: z.string().uuid(),
  contract_id: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(200).optional(),
});

export async function mcpListClientCharges(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ charges: unknown[] }>> {
  const denied = await mcpRequireAdmin(ctx);
  if (denied) return denied;
  const parsed = listArgs.safeParse(args);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Parâmetros inválidos.",
    };
  }
  try {
    const listOpts: { contractId?: string; limit?: number } = {
      limit: parsed.data.limit ?? 100,
    };
    if (parsed.data.contract_id !== undefined) {
      listOpts.contractId = parsed.data.contract_id;
    }
    const charges = await listClientCharges(parsed.data.client_id, listOpts);
    return { ok: true, data: { charges: charges.map(serializeCharge) } };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha ao listar cobranças.";
    return { ok: false, message };
  }
}

export async function mcpGenerateClientCharges(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<
  McpToolResult<{ inserted: number; skipped: number; charge_ids: string[] }>
> {
  const denied = await mcpRequireAdmin(ctx);
  if (denied) return denied;
  const parsed = generateClientChargesSchema.safeParse(args);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Parâmetros inválidos.",
    };
  }
  try {
    const result = await generateClientChargesFromContract(
      parsed.data.contract_id,
      parsed.data.months_ahead,
      ctx.supabase,
    );
    return {
      ok: true,
      data: {
        inserted: result.inserted,
        skipped: result.skipped,
        charge_ids: result.chargeIds,
      },
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha ao gerar cobranças.";
    return { ok: false, message };
  }
}

const markPaidArgs = markClientChargePaidSchema.extend({
  charge_id: z.string().uuid(),
});

export async function mcpMarkClientChargePaid(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ charge: unknown }>> {
  const denied = await mcpRequireAdmin(ctx);
  if (denied) return denied;
  const parsed = markPaidArgs.safeParse(args);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Parâmetros inválidos.",
    };
  }
  try {
    const row = await markClientChargePaid(parsed.data.charge_id, {
      paidAt: parsed.data.paid_at,
      paidAmount: parsed.data.paid_amount,
      paymentMethod: parsed.data.payment_method,
    });
    return { ok: true, data: { charge: serializeCharge(row) } };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Falha ao marcar cobrança como paga.";
    return { ok: false, message };
  }
}

const updateArgs = updateClientChargeSchema.extend({
  charge_id: z.string().uuid(),
});

export async function mcpUpdateClientCharge(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ charge: unknown }>> {
  const denied = await mcpRequireAdmin(ctx);
  if (denied) return denied;
  const parsed = updateArgs.safeParse(args);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Parâmetros inválidos.",
    };
  }
  try {
    const row = await updateClientCharge(parsed.data.charge_id, {
      amount: parsed.data.amount,
      dueDate: parsed.data.due_date,
      notes: parsed.data.notes,
      discountKind: parsed.data.discount_kind as ClientChargeDiscountKind,
      discountInput:
        parsed.data.discount_kind === "none" ? null : parsed.data.discount_input,
    });
    return { ok: true, data: { charge: serializeCharge(row) } };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Falha ao atualizar cobrança.";
    return { ok: false, message };
  }
}

const chargeIdOnly = z.object({ charge_id: z.string().uuid() });

export async function mcpDeleteClientCharge(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ charge_id: string }>> {
  const denied = await mcpRequireAdmin(ctx);
  if (denied) return denied;
  const parsed = chargeIdOnly.safeParse(args);
  if (!parsed.success) {
    return { ok: false, message: "charge_id inválido." };
  }
  try {
    await deleteClientCharge(parsed.data.charge_id);
    return { ok: true, data: { charge_id: parsed.data.charge_id } };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha ao apagar cobrança.";
    return { ok: false, message };
  }
}

export async function mcpCancelClientCharge(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ charge: unknown }>> {
  const denied = await mcpRequireAdmin(ctx);
  if (denied) return denied;
  const parsed = chargeIdOnly.safeParse(args);
  if (!parsed.success) {
    return { ok: false, message: "charge_id inválido." };
  }
  try {
    const row = await cancelClientCharge(parsed.data.charge_id);
    return { ok: true, data: { charge: serializeCharge(row) } };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha ao cancelar cobrança.";
    return { ok: false, message };
  }
}

const undoArgs = undoClientChargePaymentSchema.extend({
  charge_id: z.string().uuid(),
});

export async function mcpUndoClientChargePayment(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ charge: unknown }>> {
  const denied = await mcpRequireAdmin(ctx);
  if (denied) return denied;
  const parsed = undoArgs.safeParse(args);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Parâmetros inválidos.",
    };
  }
  try {
    const input =
      parsed.data.new_paid_amount !== undefined
        ? { newPaidAmount: parsed.data.new_paid_amount }
        : {};
    const row = await undoClientChargePayment(parsed.data.charge_id, input);
    return { ok: true, data: { charge: serializeCharge(row) } };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Falha ao desfazer recebimento.";
    return { ok: false, message };
  }
}
