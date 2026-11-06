import { z } from "zod";

const emailSchema = z.string().trim().email("E-mail inválido.").max(320);

export const inviteUserFormSchema = z
  .object({
    email: emailSchema,
    name: z.string().trim().min(1, "Nome obrigatório.").max(200),
    role: z.enum(["admin", "member"]),
    person_id: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? undefined : v),
      z.string().uuid().optional(),
    ),
    operation_ids: z.array(z.string().uuid()).default([]),
  })
  .refine((v) => v.role === "admin" || v.operation_ids.length > 0, {
    message: "Membro precisa de pelo menos uma Operação.",
    path: ["operation_ids"],
  });

export type InviteUserFormOutput = z.output<typeof inviteUserFormSchema>;

export const setPersonLinkFormSchema = z.object({
  profile_id: z.string().uuid(),
  person_id: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.string().uuid().optional(),
  ),
});
