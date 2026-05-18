import { z } from "zod";

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

const dateString = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.")
    .optional(),
);

const capacityNumber = z.preprocess(
  (v) => {
    if (v === "" || v === null || v === undefined) return undefined;
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      const normalized = v.replace(",", ".");
      const n = Number(normalized);
      return Number.isFinite(n) ? n : v;
    }
    return v;
  },
  z
    .number()
    .min(0, "Capacidade mínima 0%.")
    .max(100, "Capacidade máxima 100%."),
);

const weeklyHoursInput = z.preprocess(
  (v) => {
    if (v === "" || v === null || v === undefined) return null;
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      const n = Number(v.replace(",", "."));
      return Number.isFinite(n) ? n : v;
    }
    return v;
  },
  z.number().nonnegative("Horas não podem ser negativas.").nullable(),
);

const monthlyCostInput = z.preprocess(
  (v) => {
    if (v === "" || v === null || v === undefined) return null;
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      const n = Number(v.replace(",", "."));
      return Number.isFinite(n) ? n : v;
    }
    return v;
  },
  z.number().nonnegative("Valor não pode ser negativo.").nullable(),
);

export const allocationSchema = z
  .object({
    person_id: z.string().uuid("Pessoa obrigatória."),
    role: z.enum(["responsavel", "executor", "aprovador", "plantao"], {
      message: "Papel obrigatório.",
    }),
    capacity_weekly_pct: capacityNumber,
    weekly_hours: weeklyHoursInput,
    monthly_cost: monthlyCostInput,
    start_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Data de início obrigatória."),
    end_date: dateString,
  })
  .refine(
    (data) => !data.end_date || data.start_date <= data.end_date,
    {
      message: "Data de fim deve ser ≥ data de início.",
      path: ["end_date"],
    },
  );

export type AllocationInput = z.input<typeof allocationSchema>;
export type AllocationOutput = z.output<typeof allocationSchema>;
