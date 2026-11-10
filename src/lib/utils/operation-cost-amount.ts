import type { OperationCostCategory } from "@/lib/utils/operation-cost-category";
import { computeTaxMonthlyAmount } from "@/lib/utils/operation-tax";

export type OperationCostAmountFields = {
  category: OperationCostCategory;
  amount: number | null;
  commissionPercent: number | null;
};

export type OperationCostFinanceContext = {
  chargedRevenue?: number | null;
  taxRatePct?: number | null;
};

/**
 * Base da comissão %: valor cobrado (MRR) menos imposto. Sem imposto, base = MRR.
 */
export function computeCommissionBaseRevenue(
  chargedRevenue: number | null | undefined,
  taxRatePct: number | null | undefined,
): number {
  const mrr = chargedRevenue ?? 0;
  if (mrr <= 0) return 0;
  const tax = computeTaxMonthlyAmount(chargedRevenue, taxRatePct);
  return Math.max(0, mrr - tax);
}

/**
 * Valor mensal efetivo em R$: comissão % sobre base líquida de imposto;
 * legado em comissões continua em R$ fixo quando percent é null.
 */
export function computeCommissionMonthlyAmount(
  chargedRevenue: number | null | undefined,
  commissionPercent: number | null | undefined,
  taxRatePct?: number | null,
): number {
  const base = computeCommissionBaseRevenue(chargedRevenue, taxRatePct);
  const rate = commissionPercent ?? 0;
  if (base <= 0 || rate <= 0) return 0;
  return (base * rate) / 100;
}

export function resolveOperationCostMonthlyAmount(
  cost: OperationCostAmountFields,
  finance?: OperationCostFinanceContext,
): number {
  if (
    cost.category === "comissoes" &&
    cost.commissionPercent !== null &&
    cost.commissionPercent !== undefined
  ) {
    return computeCommissionMonthlyAmount(
      finance?.chargedRevenue,
      cost.commissionPercent,
      finance?.taxRatePct,
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
