import { clientContractStatusSchema } from "@/lib/validators/client-contract";
import { z } from "zod";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data YYYY-MM-DD.")
  .nullable()
  .optional();

const money = z.union([z.number(), z.string()]).nullable().optional();

const contractDateRefine = (
  val: {
    start_date?: string | null | undefined;
    end_date?: string | null | undefined;
    first_billing_date?: string | null | undefined;
  },
  ctx: z.RefinementCtx,
) => {
  if (val.start_date && val.end_date && val.end_date < val.start_date) {
    ctx.addIssue({
      code: "custom",
      message: "Data fim antes da data início.",
      path: ["end_date"],
    });
  }
  if (
    val.start_date &&
    val.first_billing_date &&
    val.first_billing_date < val.start_date
  ) {
    ctx.addIssue({
      code: "custom",
      message: "Primeira cobrança deve ser ≥ data de início (onboarding).",
      path: ["first_billing_date"],
    });
  }
};

/** Campos de contrato aceitos por MCP (JSON-native, sem transforms de form). */
export const clientContractMcpBodySchema = z
  .object({
    label: z.string().trim().min(2).max(200).describe("Rótulo/nome do contrato comercial"),
    monthly_value: money.describe("Valor mensal recorrente (número ou string)"),
    implementation_fee: money.describe("Taxa de implantação única"),
    implementation_fee_paid: z.boolean().optional().describe("Taxa quitada (sem data de pagamento)"),
    currency: z.string().trim().max(8).optional().describe("Moeda ISO, default BRL"),
    reajuste_notes: z.string().max(2000).nullable().optional(),
    start_date: isoDate.describe("Onboarding / início do contrato"),
    first_billing_date: isoDate.describe("Primeira cobrança (calendário completo)"),
    end_date: isoDate,
    payment_day_of_month: z
      .number()
      .int()
      .min(1)
      .max(28)
      .nullable()
      .optional()
      .describe("Dia fixo mensal recorrente (1–28)"),
    status: clientContractStatusSchema.describe("rascunho | vigente | encerrada"),
    notes: z.string().max(4000).nullable().optional(),
  })
  .superRefine(contractDateRefine);

export const createClientContractMcpSchema = clientContractMcpBodySchema.extend({
  client_id: z.string().uuid(),
});

export const updateClientContractMcpSchema = clientContractMcpBodySchema.extend({
  contract_id: z.string().uuid(),
});

export function coerceContractMoney(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const trimmed = String(v).trim();
  if (trimmed === "") return null;
  const n = Number(trimmed.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export type ClientContractMcpBody = z.infer<typeof clientContractMcpBodySchema>;

export function clientContractMcpToRow(
  clientId: string,
  d: ClientContractMcpBody,
  uploadedBy: string,
  file?: {
    storage_path: string | null;
    filename: string | null;
    mime_type: string | null;
    size_bytes: number;
  },
) {
  return {
    client_id: clientId,
    label: d.label,
    monthly_value: coerceContractMoney(d.monthly_value),
    implementation_fee: coerceContractMoney(d.implementation_fee),
    implementation_fee_paid: d.implementation_fee_paid ?? false,
    currency: (d.currency ?? "BRL").trim() || "BRL",
    reajuste_notes: d.reajuste_notes ?? null,
    start_date: d.start_date ?? null,
    first_billing_date: d.first_billing_date ?? null,
    end_date: d.end_date ?? null,
    payment_day_of_month: d.payment_day_of_month ?? null,
    status: d.status,
    notes: d.notes ?? null,
    storage_path: file?.storage_path ?? null,
    filename: file?.filename ?? null,
    mime_type: file?.mime_type ?? null,
    size_bytes: file?.size_bytes ?? 0,
    uploaded_by: uploadedBy,
  };
}
