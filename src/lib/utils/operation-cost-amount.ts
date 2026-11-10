import type { OperationCostCategory } from "@/lib/utils/operation-cost-category";

export type OperationCostAmountFields = {
  category: OperationCostCategory;
  amount: number | null;
  commissionPercent: number | null;
};

/**
 * Valor mensal efetivo em R$: comissão com % segue o MRR; demais usam amount;
 * legado em comissões continua em R$ fixo quando percent é null.
 */
export function computeCommissionMonthlyAmount(
  chargedRevenue: number | null | undefined,
  commissionPercent: number | null | undefined,
): number {
  const revenue = chargedRevenue ?? 0;
  const rate = commissionPercent ?? 0;
  if (revenue <= 0 || rate <= 0) return 0;
  return (revenue * rate) / 100;
}

export function resolveOperationCostMonthlyAmount(
  cost: OperationCostAmountFields,
  chargedRevenue: number | null | undefined,
): number {
  if (
    cost.category === "comissoes" &&
    cost.commissionPercent !== null &&
    cost.commissionPercent !== undefined
  ) {
    return computeCommissionMonthlyAmount(
      chargedRevenue,
      cost.commissionPercent,
    );
  }
  return cost.amount ?? 0;
}

export function isCommissionPercentCost(
  cost: OperationCostAmountFields,
): boolean {
  return (
    cost.category === "comissoes" &&
    cost.commissionPercent !== null &&
    cost.commissionPercent !== undefined
  );
}
