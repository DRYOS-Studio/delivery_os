import type { Database } from "@/lib/db/types";

export type ClientAcquisitionCostCategory =
  Database["public"]["Enums"]["client_acquisition_cost_category"];

const LABELS: Record<ClientAcquisitionCostCategory, string> = {
  anuncios_midia: "Anúncios / mídia",
  horas_venda_diagnostico: "Horas de venda e diagnóstico",
  comissao_indicacao: "Comissão / indicação",
  ferramentas: "Ferramentas",
  outros: "Outros",
};

export const CLIENT_CAC_CATEGORIES = Object.keys(
  LABELS,
) as ClientAcquisitionCostCategory[];

export function clientCacCategoryLabel(
  category: ClientAcquisitionCostCategory,
): string {
  return LABELS[category];
}
