/**
 * Imposto mensal derivado: % sobre o valor cobrado (MRR da operação).
 * Null, undefined ou 0 na alíquota => sem custo de imposto (paridade com hoje).
 */
export function computeTaxMonthlyAmount(
  chargedRevenue: number | null | undefined,
  taxRatePct: number | null | undefined,
): number {
  const revenue = chargedRevenue ?? 0;
  const rate = taxRatePct ?? 0;
  if (revenue <= 0 || rate <= 0) return 0;
  return (revenue * rate) / 100;
}
