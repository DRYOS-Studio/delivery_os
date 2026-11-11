"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, dbErr, err, ok } from "@/lib/actions/_types";
import { requireUserAction } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";
import { getMeetingNextStep } from "@/lib/db/queries/meetings";
import { promoteMeetingNextStepToTask } from "@/lib/meetings/meeting-next-step-tasks";

function parseFormData(formData: FormData) {
  return {
    next_step_id: ((formData.get("next_step_id") as string | null) ?? "").trim(),
    frente_id: ((formData.get("frente_id") as string | null) ?? "").trim(),
  };
}

export async function createTaskFromMeetingNextStepAction(
  formData: FormData,
): Promise<
  ActionResult<{ taskId: string; operationId: string; frenteId: string }>
> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const { next_step_id: nextStepId, frente_id: frenteId } =
    parseFormData(formData);
  if (!nextStepId || !frenteId) {
    return err("Próximo passo e Frente são obrigatórios.", "validation");
  }

  const step = await getMeetingNextStep(nextStepId);
  if (!step) return err("Próximo passo não encontrado.", "not_found");
  if (step.task_id) {
    return err("Este passo já virou tarefa.", "state_conflict");
  }

  const supabase = await createServer();
  try {
    const result = await promoteMeetingNextStepToTask(supabase, {
      nextStepId,
      meetingId: step.meeting_id,
      operationId: step.operation_id,
      description: step.description,
      dueDate: step.due_date,
      assigneePersonId: step.assignee_person_id,
      explicitFrenteId: frenteId,
      existingTaskId: step.task_id,
    });
    if (!result.ok) {
      if (result.reason === "ambiguous_frente" || result.reason === "no_frente") {
        return err("Frente inválida para esta operação.", "invalid_frente");
      }
      return err("Não foi possível criar a tarefa.", "state_conflict");
    }
    revalidatePath(`/operations/${step.operation_id}`);
    revalidatePath(
      `/operations/${step.operation_id}/meetings/${step.meeting_id}/edit`,
    );
    revalidatePath(`/operations/${step.operation_id}/frentes/${result.frenteId}`);
    return ok({
      taskId: result.taskId,
      operationId: step.operation_id,
      frenteId: result.frenteId,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha ao criar tarefa.";
    return dbErr({ message }, "createTaskFromMeetingNextStepAction");
  }
}
