import type { ClientChargeRow } from "@/lib/db/queries/client-charges";

export type ClientLtvTotals = {
  /** Soma de `paid_amount` em cobranças com `paid_at` (exclui canceladas na origem). */
  ltvReceived: number;
  /** Saldo em aberto (previstas/emitidas/atrasadas/parciais), não entra no LTV. */
  receivablePending: number;
};

/**
 * LTV = recebimentos efetivos em `client_charges` apenas.
 * Taxa de implantação entra quando existe cobrança `implantacao` paga (não soma
 * `implementation_fee_paid` do contrato, para não duplicar).
 */
export function computeClientLtvFromCharges(
  charges: ReadonlyArray<ClientChargeRow>,
): ClientLtvTotals {
  let ltvReceived = 0;
  let receivablePending = 0;
  for (const c of charges) {
    if (c.status === "cancelada") continue;
    const paid = c.paidAmount ?? 0;
    if (paid > 0 && c.paidAt) {
      ltvReceived += paid;
    }
    receivablePending += c.openAmount;
  }
  return { ltvReceived, receivablePending };
}

export function computeLtvCacRatio(
  ltvReceived: number,
  cacTotal: number,
): number | null {
  if (cacTotal <= 0) return null;
  return ltvReceived / cacTotal;
}
