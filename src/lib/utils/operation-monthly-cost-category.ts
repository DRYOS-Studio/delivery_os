import type { Database } from "@/lib/db/types";

export type OperationMonthlyCostCategory =
  Database["public"]["Enums"]["operation_monthly_cost_category"];

const CATEGORY_LABEL: Record<OperationMonthlyCostCategory, string> = {
  comissoes: "Comissões",
  servicos_terceiros: "Serviços de terceiros",
  time: "Time",
  infra: "Infra",
  a_classificar: "A classificar",
};

/** Categorias disponíveis para novos itens na UI e MCP create. */
export const OPERATION_MONTHLY_COST_CATEGORIES_UI: OperationMonthlyCostCategory[] =
  ["comissoes", "servicos_terceiros", "time", "infra"];

export function operationMonthlyCostCategoryLabel(
  category: OperationMonthlyCostCategory,
): string {
  return CATEGORY_LABEL[category];
}

export function sumMonthlyCostItems(
  items: ReadonlyArray<{ amount: number }>,
): number {
  return items.reduce((s, i) => s + i.amount, 0);
}

export function categorySubtotals(
  items: ReadonlyArray<{ category: OperationMonthlyCostCategory; amount: number }>,
): Partial<Record<OperationMonthlyCostCategory, number>> {
  const out: Partial<Record<OperationMonthlyCostCategory, number>> = {};
  for (const i of items) {
    out[i.category] = (out[i.category] ?? 0) + i.amount;
  }
  return out;
}
