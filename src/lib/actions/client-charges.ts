"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, err, ok } from "@/lib/actions/_types";
import { requireAdminAction } from "@/lib/auth/server";
import {
  cancelClientCharge,
  deleteClientCharge,
  generateClientChargesFromContract,
  markClientChargePaid,
  undoClientChargePayment,
  updateClientCharge,
} from "@/lib/db/queries/client-charges";
import type { ClientChargeDiscountKind } from "@/lib/utils/client-charge-amount";
import {
  generateClientChargesSchema,
  markClientChargePaidSchema,
  undoClientChargePaymentSchema,
  updateClientChargeSchema,
} from "@/lib/validators/client-charge";

function revalidateChargePaths(clientId: string) {
  revalidatePath(`/clients/${clientId}`);
  revalidatePath(`/clients/${clientId}/cobrancas`);
  revalidatePath("/admin/dashboard");
}

export async function generateClientChargesAction(
  clientId: string,
  contractId: string,
  monthsAhead?: number,
): Promise<ActionResult<{ inserted: number; skipped: number }>> {
  const admin = await requireAdminAction();
  if (!admin.ok) return admin;
  const parsed = generateClientChargesSchema.safeParse({
    contract_id: contractId,
    months_ahead: monthsAhead,
  });
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  }
  try {
    const result = await generateClientChargesFromContract(
      parsed.data.contract_id,
      parsed.data.months_ahead,
    );
    revalidateChargePaths(clientId);
    return ok({ inserted: result.inserted, skipped: result.skipped });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha ao gerar cobranças.";
    return err(message);
  }
}

export async function markClientChargePaidAction(
  clientId: string,
  chargeId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const admin = await requireAdminAction();
  if (!admin.ok) return admin;
  const parsed = markClientChargePaidSchema.safeParse({
    paid_at: formData.get("paid_at"),
    paid_amount: formData.get("paid_amount"),
    payment_method: formData.get("payment_method") ?? undefined,
  });
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  }
  try {
    const row = await markClientChargePaid(chargeId, {
      paidAt: parsed.data.paid_at,
      paidAmount: parsed.data.paid_amount,
      paymentMethod: parsed.data.payment_method,
    });
    if (row.clientId !== clientId) {
      return err("Cobrança não pertence a este cliente.");
    }
    revalidateChargePaths(clientId);
    return ok({ id: row.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha ao registrar pagamento.";
    return err(message);
  }
}

export async function updateClientChargeAction(
  clientId: string,
  chargeId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const admin = await requireAdminAction();
  if (!admin.ok) return admin;
  const statusRaw = formData.get("status");
  const parsed = updateClientChargeSchema.safeParse({
    amount: formData.get("amount"),
    due_date: formData.get("due_date"),
    notes: formData.get("notes") ?? undefined,
    discount_kind: formData.get("discount_kind"),
    discount_input: formData.get("discount_input") ?? undefined,
    status:
      statusRaw === "prevista" || statusRaw === "emitida" ? statusRaw : undefined,
  });
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  }
  try {
    const updateInput: Parameters<typeof updateClientCharge>[1] = {
      amount: parsed.data.amount,
      dueDate: parsed.data.due_date,
      notes: parsed.data.notes,
      discountKind: parsed.data.discount_kind as ClientChargeDiscountKind,
      discountInput:
        parsed.data.discount_kind === "none" ? null : parsed.data.discount_input,
    };
    if (parsed.data.status !== undefined) {
      updateInput.status = parsed.data.status;
    }
    const row = await updateClientCharge(chargeId, updateInput);
    if (row.clientId !== clientId) return err("Cobrança não pertence a este cliente.");
    revalidateChargePaths(clientId);
    return ok({ id: row.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha ao atualizar cobrança.";
    return err(message);
  }
}

export async function deleteClientChargeAction(
  clientId: string,
  chargeId: string,
): Promise<ActionResult<{ id: string }>> {
  const admin = await requireAdminAction();
  if (!admin.ok) return admin;
  try {
    await deleteClientCharge(chargeId);
    revalidateChargePaths(clientId);
    return ok({ id: chargeId });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha ao apagar cobrança.";
    return err(message);
  }
}

export async function cancelClientChargeAction(
  clientId: string,
  chargeId: string,
): Promise<ActionResult<{ id: string }>> {
  const admin = await requireAdminAction();
  if (!admin.ok) return admin;
  try {
    const row = await cancelClientCharge(chargeId);
    if (row.clientId !== clientId) return err("Cobrança não pertence a este cliente.");
    revalidateChargePaths(clientId);
    return ok({ id: row.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha ao cancelar cobrança.";
    return err(message);
  }
}

export async function undoClientChargePaymentAction(
  clientId: string,
  chargeId: string,
  formData?: FormData,
): Promise<ActionResult<{ id: string }>> {
  const admin = await requireAdminAction();
  if (!admin.ok) return admin;
  const parsed = undoClientChargePaymentSchema.safeParse({
    clear_all: formData?.get("clear_all") ?? true,
    new_paid_amount: formData?.get("new_paid_amount") ?? undefined,
  });
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  }
  try {
    const input =
      parsed.data.new_paid_amount !== undefined
        ? { newPaidAmount: parsed.data.new_paid_amount }
        : parsed.data.clear_all
          ? {}
          : {};
    const row = await undoClientChargePayment(chargeId, input);
    if (row.clientId !== clientId) return err("Cobrança não pertence a este cliente.");
    revalidateChargePaths(clientId);
    return ok({ id: row.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha ao desfazer recebimento.";
    return err(message);
  }
}
