"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, dbErr, err, ok } from "@/lib/actions/_types";
import { requireUserAction } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";
import { getFrente } from "@/lib/db/queries/frentes";
import { getMeetingNextStep } from "@/lib/db/queries/meetings";

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

  const frente = await getFrente(frenteId);
  if (!frente) return err("Frente não encontrada.", "not_found");
  if (frente.archived_at) {
    return err("Frente arquivada.", "state_conflict");
  }
  if (frente.operation_id !== step.operation_id) {
    return err("A Frente não pertence a esta Operação.", "invalid_frente");
  }

  const supabase = await createServer();
  const { data: taskRow, error: insErr } = await supabase
    .from("tasks")
    .insert({
      frente_id: frenteId,
      operation_id: step.operation_id,
      title: step.description.slice(0, 200),
      description:
        step.description.length > 200 ? step.description : null,
      status: "todo",
      parent_task_id: null,
      start_date: null,
      due_date: step.due_date,
      tags: null,
      quick_win_id: null,
      sla_incident_id: null,
      source_meeting_id: step.meeting_id,
    })
    .select("id")
    .single();
  if (insErr) return dbErr(insErr, "createTaskFromMeetingNextStepAction.task");
  if (!taskRow) return err("Falha ao criar tarefa.", "no_data");

  if (step.assignee_person_id) {
    const { error: assigneeErr } = await supabase.from("task_assignees").insert({
      task_id: taskRow.id,
      person_id: step.assignee_person_id,
    });
    if (assigneeErr) {
      return dbErr(assigneeErr, "createTaskFromMeetingNextStepAction.assignee");
    }
  }

  const { error: upErr } = await supabase
    .from("meeting_agenda_next_steps")
    .update({ task_id: taskRow.id })
    .eq("id", nextStepId);
  if (upErr)
    return dbErr(upErr, "createTaskFromMeetingNextStepAction.link");

  revalidatePath(`/operations/${step.operation_id}`);
  revalidatePath(`/operations/${step.operation_id}/meetings/${step.meeting_id}/edit`);
  revalidatePath(`/operations/${step.operation_id}/frentes/${frenteId}`);
  return ok({
    taskId: taskRow.id,
    operationId: step.operation_id,
    frenteId,
  });
}
