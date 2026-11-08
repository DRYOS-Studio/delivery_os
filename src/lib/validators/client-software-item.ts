import { z } from "zod";
import { optionalGitRepositoryUrlSchema } from "@/lib/utils/git-repository-url";

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

const optionalHttpsUrl = z.preprocess(
  emptyToUndefined,
  optionalGitRepositoryUrlSchema,
);

const shortNotes = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .trim()
    .max(280, "Notas muito longas (máx 280).")
    .optional(),
);

export const clientSoftwareItemSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nome obrigatório.")
    .max(120, "Máximo 120 caracteres."),
  purpose: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .max(120, "Máximo 120 caracteres.")
      .optional(),
  ),
  url: optionalHttpsUrl,
  notes: shortNotes,
});

export type ClientSoftwareItemInput = z.input<typeof clientSoftwareItemSchema>;
export type ClientSoftwareItemOutput = z.output<typeof clientSoftwareItemSchema>;
