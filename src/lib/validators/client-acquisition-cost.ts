import { z } from "zod";
import {
  CLIENT_CAC_CATEGORIES,
  type ClientAcquisitionCostCategory,
} from "@/lib/utils/client-cac-category";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (AAAA-MM-DD).");

const amountInput = z.preprocess((v) => {
  if (v === "" || v === null || v === undefined) return undefined;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : v;
  }
  return v;
}, z.number().positive("Informe um valor maior que zero."));

const categoryEnum = z.enum(
  CLIENT_CAC_CATEGORIES as [
    ClientAcquisitionCostCategory,
    ...ClientAcquisitionCostCategory[],
  ],
);

export const clientAcquisitionCostFormSchema = z.object({
  spent_on: isoDate,
  description: z
    .string()
    .trim()
    .min(1, "Descrição obrigatória.")
    .max(500, "Descrição muito longa (máx. 500)."),
  category: categoryEnum,
  amount: amountInput,
});

export type ClientAcquisitionCostFormOutput = z.output<
  typeof clientAcquisitionCostFormSchema
>;

export const clientAcquisitionCostMcpSchema = clientAcquisitionCostFormSchema;
