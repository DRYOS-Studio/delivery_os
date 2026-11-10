"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, err, ok } from "@/lib/actions/_types";
import { requireAdminAction } from "@/lib/auth/server";
import {
  generateClientChargesFromContract,
  markClientChargePaid,
} from "@/lib/db/queries/client-charges";
import {
  generateClientChargesSchema,
  markClientChargePaidSchema,
} from "@/lib/validators/client-charge";

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
    revalidatePath(`/clients/${clientId}`);
    revalidatePath("/admin/dashboard");
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
    revalidatePath(`/clients/${clientId}`);
    revalidatePath("/admin/dashboard");
    return ok({ id: row.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha ao registrar pagamento.";
    return err(message);
  }
}
