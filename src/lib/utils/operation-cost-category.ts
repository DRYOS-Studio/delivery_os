import type { Database } from "@/lib/db/types";

export type OperationCostCategory =
  Database["public"]["Enums"]["operation_cost_category"];

const CATEGORY_LABEL: Record<OperationCostCategory, string> = {
  comissoes: "Comissões",
  servicos_terceiros: "Serviços de terceiros",
  time: "Time",
  infra: "Infra",
  a_classificar: "A classificar",
};

/** Categorias para novos custos na UI e MCP create. */
export const OPERATION_COST_CATEGORIES_UI: OperationCostCategory[] = [
  "comissoes",
  "servicos_terceiros",
  "time",
  "infra",
];

export function operationCostCategoryLabel(
  category: OperationCostCategory,
): string {
  return CATEGORY_LABEL[category];
}

export function categorySubtotals(
  items: ReadonlyArray<{
    category: OperationCostCategory;
    monthlyAmount: number;
  }>,
): Partial<Record<OperationCostCategory, number>> {
  const out: Partial<Record<OperationCostCategory, number>> = {};
  for (const i of items) {
    out[i.category] = (out[i.category] ?? 0) + i.monthlyAmount;
  }
  return out;
}
