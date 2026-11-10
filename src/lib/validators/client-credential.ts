import { z } from "zod";

const optUuid = z
  .string()
  .uuid()
  .optional()
  .or(z.literal(""))
  .transform((v) => (v && v.length > 0 ? v : null));

export const createClientCredentialSchema = z.object({
  client_id: z.string().uuid(),
  operation_id: optUuid,
  service_name: z.string().trim().min(1).max(200),
  url: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  login_username: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  password: z.string().min(1).max(2000),
  notes: z
    .string()
    .max(8000)
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v.trim() : null)),
  two_factor_notes: z
    .string()
    .max(4000)
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v.trim() : null)),
});

const updateFields = createClientCredentialSchema
  .partial({
    client_id: true,
    password: true,
  })
  .extend({
    credential_id: z.string().uuid(),
    password: z.string().min(1).max(2000).optional(),
  });

export const updateClientCredentialSchema = updateFields;

export const updateClientCredentialMcpSchema = updateFields.extend({
  client_id: z.string().uuid(),
});

export const revealClientCredentialSchema = z.object({
  credential_id: z.string().uuid(),
  reason: z.string().trim().min(3).max(500),
});
