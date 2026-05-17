import { z } from "zod";

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

const optionalText = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.string().max(500, "Máximo 500 caracteres.").optional(),
);

const optionalUuid = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.string().uuid().optional(),
);

export const attachmentUploadSchema = z.object({
  filename: z
    .string()
    .trim()
    .min(1, "Nome de arquivo obrigatório.")
    .max(200, "Nome muito longo (máx 200)."),
  size_bytes: z
    .number()
    .int()
    .positive("Arquivo vazio.")
    .max(MAX_ATTACHMENT_BYTES, "Arquivo > 10MB."),
  mime_type: z.string().min(1).max(200),
  description: optionalText,
  meeting_id: optionalUuid,
});

export type AttachmentUploadInput = z.input<typeof attachmentUploadSchema>;
export type AttachmentUploadOutput = z.output<typeof attachmentUploadSchema>;
