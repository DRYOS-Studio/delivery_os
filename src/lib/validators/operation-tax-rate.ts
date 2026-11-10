import { z } from "zod";

const taxRatePctInput = z.preprocess((v) => {
  if (v === "" || v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : v;
  }
  return v;
}, z
  .number()
  .min(0, "Alíquota não pode ser negativa.")
  .max(100, "Alíquota máxima é 100%.")
  .nullable());

export const operationTaxRateSchema = z.object({
  tax_rate_pct: taxRatePctInput,
});

export type OperationTaxRateOutput = z.output<typeof operationTaxRateSchema>;
