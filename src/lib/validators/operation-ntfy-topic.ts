import { z } from "zod";

const tagsCsv = z.preprocess(
  (v) => {
    if (v === "" || v === null || v === undefined) return undefined;
    if (Array.isArray(v)) return v;
    const s = String(v).trim();
    if (!s) return undefined;
    return s.split(/[,;]+/).map((t) => t.trim()).filter(Boolean);
  },
  z.array(z.string().min(1).max(64)).optional(),
);

export const operationNtfyTopicSchema = z.object({
  topic: z
    .string()
    .trim()
    .min(1, "Tópico obrigatório.")
    .max(200, "Máximo 200 caracteres.")
    .regex(/^[a-zA-Z0-9_-]+$/, "Use apenas letras, números, _ e -."),
  label: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().max(120).optional(),
  ),
  recovery_tags: tagsCsv,
  default_problem_origin: z.enum(
    ["dryos", "client", "vendor", "unclassified"],
    { message: "Origem do problema obrigatória." },
  ),
});

export type OperationNtfyTopicInput = z.input<typeof operationNtfyTopicSchema>;
export type OperationNtfyTopicOutput = z.output<typeof operationNtfyTopicSchema>;
