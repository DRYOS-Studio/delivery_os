import { z } from "zod";

export const profileDataSchema = z.object({
  empresa: z.string().optional().default(""),
  setor: z.string().optional().default(""),
  pessoas: z.string().optional().default(""),
  faturamento: z.string().optional().default(""),
  respondente: z.string().optional().default(""),
  cargo: z.string().optional().default(""),
  data: z.string().optional().default(""),
  consultor: z.string().optional().default("Rafael Carvalho · dryos studio"),
  dores: z.string().optional().default(""),
  objetivos: z.string().optional().default(""),
});

export type ProfileData = z.infer<typeof profileDataSchema>;

export const managementDiagnosticSaveSchema = z.object({
  profileData: profileDataSchema.default(() => ({
    empresa: "",
    setor: "",
    pessoas: "",
    faturamento: "",
    respondente: "",
    cargo: "",
    data: "",
    consultor: "Rafael Carvalho · dryos studio",
    dores: "",
    objetivos: "",
  })),
  answers: z
    .record(
      z.string(),
      z.union([
        z.string(),
        z.number(),
        z.boolean(),
        z.array(z.string()),
        z.null(),
      ]),
    )
    .default({}),
  naAnswers: z.record(z.string(), z.boolean()).default({}),
  formType: z.string().default("estruturacao_processos"),
  status: z.enum(["draft", "completed"]).default("draft"),
  conductedAt: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  recommendedProduct: z
    .enum(["core", "spark", "studio"])
    .optional()
    .nullable(),
});

export type ManagementDiagnosticSaveInput = z.infer<
  typeof managementDiagnosticSaveSchema
>;
