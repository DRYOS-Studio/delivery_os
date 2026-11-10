import { z } from "zod";

export const ntfyIngestMessageSchema = z.object({
  id: z.string().min(1, "id obrigatório"),
  time: z.union([z.number(), z.string()]),
  topic: z.string().min(1, "topic obrigatório"),
  title: z.string().optional(),
  message: z.string().optional(),
  priority: z.union([z.number(), z.string()]).optional(),
  tags: z.array(z.string()).optional(),
});

export type NtfyIngestMessage = z.infer<typeof ntfyIngestMessageSchema>;

export type NtfyIngestOutcome =
  | "created"
  | "deduped"
  | "recovered"
  | "unmapped"
  | "ignored_recovery"
  | "duplicate";

export type NtfyTopicMapping = {
  operation_id: string;
  topic: string;
  recovery_tags: string[];
  default_problem_origin: "dryos" | "client" | "vendor" | "unclassified";
  priority_severity_map: Record<string, string>;
};
