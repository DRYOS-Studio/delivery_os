import { z } from "zod";

const optionalText = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.string().max(5000, "Máximo 5000 caracteres.").optional(),
);

export const meetingSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Mínimo 3 caracteres.")
    .max(200, "Máximo 200 caracteres."),
  scheduled_at: z.string().min(1, "Data obrigatória."),
  notes: optionalText,
  visibility: z.enum(["interno", "cliente"], {
    message: "Visibility obrigatória.",
  }),
  attendee_ids: z.array(z.string().uuid()).default([]),
});

export type MeetingInput = z.input<typeof meetingSchema>;
export type MeetingOutput = z.output<typeof meetingSchema>;
