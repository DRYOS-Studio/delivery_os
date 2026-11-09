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

export const clientTechItemSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nome obrigatório.")
    .max(120, "Máximo 120 caracteres."),
  category: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .max(80, "Máximo 80 caracteres.")
      .optional(),
  ),
  url: optionalHttpsUrl,
  notes: shortNotes,
});

export type ClientTechItemInput = z.input<typeof clientTechItemSchema>;
export type ClientTechItemOutput = z.output<typeof clientTechItemSchema>;

export const clientTechItemUpdateSchema = clientTechItemSchema.extend({
  item_id: z.string().uuid("item_id inválido."),
  client_id: z.string().uuid("client_id inválido."),
});
