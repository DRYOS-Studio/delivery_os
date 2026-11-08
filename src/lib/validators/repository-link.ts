import { z } from "zod";
import {
  GIT_REPOSITORY_URL_PROBLEM_MESSAGE,
  checkGitRepositoryUrl,
} from "@/lib/utils/git-repository-url";

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

const shortNotes = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .trim()
    .max(280, "Notas muito longas (máx 280).")
    .optional(),
);

export const repositoryLinkBodySchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, "Nome/finalidade obrigatório.")
    .max(120, "Máximo 120 caracteres."),
  url: z
    .string()
    .trim()
    .min(1, "URL obrigatória.")
    .max(500, "URL muito longa.")
    .superRefine((v, ctx) => {
      const problem = checkGitRepositoryUrl(v);
      if (problem) {
        ctx.addIssue({
          code: "custom",
          message: GIT_REPOSITORY_URL_PROBLEM_MESSAGE[problem],
        });
      }
    }),
  notes: shortNotes,
});

export type RepositoryLinkBody = z.output<typeof repositoryLinkBodySchema>;

export const repositoryLinkCreateSchema = repositoryLinkBodySchema
  .extend({
    client_id: z.string().uuid(),
    operation_id: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
    frente_id: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  })
  .refine((d) => !d.frente_id || d.operation_id, {
    message: "operation_id obrigatório quando frente_id está presente.",
    path: ["operation_id"],
  });

export const repositoryLinkUpdateSchema = repositoryLinkBodySchema.extend({
  link_id: z.string().uuid(),
});
