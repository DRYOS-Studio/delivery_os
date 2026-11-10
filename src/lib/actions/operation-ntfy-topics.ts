"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, dbErr, err, ok } from "@/lib/actions/_types";
import { requireUserAction } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";
import {
  operationNtfyTopicSchema,
  type OperationNtfyTopicOutput,
} from "@/lib/validators/operation-ntfy-topic";

export async function createOperationNtfyTopicAction(
  operationId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const raw = {
    topic: formData.get("topic"),
    label: formData.get("label"),
    recovery_tags: formData.get("recovery_tags"),
    default_problem_origin: formData.get("default_problem_origin"),
  };
  const parsed = operationNtfyTopicSchema.safeParse(raw);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Dados inválidos.", "validation");
  }
  const data: OperationNtfyTopicOutput = parsed.data;

  const supabase = await createServer();
  const { data: row, error } = await supabase
    .from("operation_ntfy_topics")
    .insert({
      operation_id: operationId,
      topic: data.topic,
      label: data.label ?? null,
      recovery_tags: data.recovery_tags ?? ["resolved", "recovery"],
      default_problem_origin: data.default_problem_origin,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") {
      return err("Este tópico já está mapeado em outra Operação.", "unique_violation");
    }
    return dbErr(error, "createOperationNtfyTopicAction");
  }
  if (!row) return err("Falha ao salvar.", "no_data");

  revalidatePath(`/operations/${operationId}/settings/ntfy`);
  return ok({ id: row.id });
}

export async function deleteOperationNtfyTopicAction(
  topicId: string,
  operationId: string,
): Promise<ActionResult<{ id: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const supabase = await createServer();
  const { error } = await supabase
    .from("operation_ntfy_topics")
    .delete()
    .eq("id", topicId)
    .eq("operation_id", operationId);
  if (error) return dbErr(error, "deleteOperationNtfyTopicAction");

  revalidatePath(`/operations/${operationId}/settings/ntfy`);
  return ok({ id: topicId });
}
