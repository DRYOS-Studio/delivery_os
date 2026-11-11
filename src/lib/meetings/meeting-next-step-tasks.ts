import { isPostgrestMissingColumnError } from "@/lib/db/postgrest-schema";
import type { Database } from "@/lib/db/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type MeetingNextStepAutoWarning = {
  nextStepId: string;
  code: "no_frente" | "ambiguous_frente" | "empty_description";
  message: string;
};

type PersonKind = Database["public"]["Enums"]["person_kind"];

export function appendExternalAssigneeNote(
  description: string,
  assigneeName: string,
): string {
  const suffix = `Responsável: ${assigneeName} (cliente)`;
  if (description.includes(suffix)) return description;
  const sep = description.trim().length > 0 ? "\n\n" : "";
  return `${description.trim()}${sep}${suffix}`;
}

export function buildTaskTitleAndBody(description: string): {
  title: string;
  description: string | null;
} {
  const trimmed = description.trim();
  return {
    title: trimmed.slice(0, 200),
    description: trimmed.length > 200 ? trimmed : null,
  };
}

export async function resolveFrenteIdForNextStep(
  supabase: SupabaseClient<Database>,
  operationId: string,
  explicitFrenteId: string | null,
): Promise<
  | { ok: true; frenteId: string }
  | { ok: false; reason: "none" | "ambiguous" }
> {
  if (explicitFrenteId) {
    const { data: frente, error } = await supabase
      .from("frentes")
      .select("id, operation_id, archived_at")
      .eq("id", explicitFrenteId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (
      !frente ||
      frente.archived_at ||
      frente.operation_id !== operationId
    ) {
      return { ok: false, reason: "none" };
    }
    return { ok: true, frenteId: frente.id };
  }

  const { data: frentes, error: listErr } = await supabase
    .from("frentes")
    .select("id")
    .eq("operation_id", operationId)
    .is("archived_at", null)
    .order("name", { ascending: true });
  if (listErr) throw new Error(listErr.message);
  const ids = (frentes ?? []).map((f) => f.id);
  if (ids.length === 1) return { ok: true, frenteId: ids[0]! };
  if (ids.length === 0) return { ok: false, reason: "none" };
  return { ok: false, reason: "ambiguous" };
}

async function loadAssignee(
  supabase: SupabaseClient<Database>,
  personId: string,
): Promise<{ id: string; name: string; kind: PersonKind } | null> {
  const { data, error } = await supabase
    .from("persons")
    .select("id, name, kind")
    .eq("id", personId)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
}

export type PromoteNextStepInput = {
  nextStepId: string;
  meetingId: string;
  operationId: string;
  description: string;
  dueDate: string | null;
  assigneePersonId: string | null;
  explicitFrenteId: string | null;
  existingTaskId: string | null;
};

export type PromoteNextStepResult =
  | { ok: true; taskId: string; frenteId: string; assigneeSkippedExternal: boolean }
  | { ok: false; reason: "already_linked" | "no_frente" | "ambiguous_frente" | "empty" };

export async function promoteMeetingNextStepToTask(
  supabase: SupabaseClient<Database>,
  input: PromoteNextStepInput,
): Promise<PromoteNextStepResult> {
  if (input.existingTaskId) {
    return { ok: false, reason: "already_linked" };
  }
  const desc = input.description.trim();
  if (!desc || desc === "—") {
    return { ok: false, reason: "empty" };
  }

  const frenteResolved = await resolveFrenteIdForNextStep(
    supabase,
    input.operationId,
    input.explicitFrenteId,
  );
  if (!frenteResolved.ok) {
    return {
      ok: false,
      reason:
        frenteResolved.reason === "ambiguous" ? "ambiguous_frente" : "no_frente",
    };
  }
  const frenteId = frenteResolved.frenteId;

  let body = desc;
  let internalAssigneeId: string | null = null;
  let assigneeSkippedExternal = false;

  if (input.assigneePersonId) {
    const person = await loadAssignee(supabase, input.assigneePersonId);
    if (person?.kind === "internal") {
      internalAssigneeId = person.id;
    } else if (person?.kind === "external") {
      body = appendExternalAssigneeNote(body, person.name);
      assigneeSkippedExternal = true;
    }
  }

  const { title, description } = buildTaskTitleAndBody(body);
  const { data: taskRow, error: insErr } = await supabase
    .from("tasks")
    .insert({
      frente_id: frenteId,
      operation_id: input.operationId,
      title,
      description,
      status: "todo",
      parent_task_id: null,
      due_date: input.dueDate,
      source_meeting_id: input.meetingId,
    })
    .select("id")
    .single();
  if (insErr) throw new Error(insErr.message);
  if (!taskRow) throw new Error("Falha ao criar tarefa.");

  if (internalAssigneeId) {
    const { error: aErr } = await supabase.from("task_assignees").insert({
      task_id: taskRow.id,
      person_id: internalAssigneeId,
    });
    if (aErr) {
      const person = await loadAssignee(supabase, internalAssigneeId);
      if (person) {
        const enriched = appendExternalAssigneeNote(
          description ?? body,
          person.name,
        );
        const rebuilt = buildTaskTitleAndBody(enriched);
        await supabase
          .from("tasks")
          .update({
            description:
              rebuilt.description ??
              (enriched.length > 200 ? enriched : null),
            title: rebuilt.title,
          })
          .eq("id", taskRow.id);
        assigneeSkippedExternal = true;
      }
    }
  }

  const { error: linkErr } = await supabase
    .from("meeting_agenda_next_steps")
    .update({ task_id: taskRow.id })
    .eq("id", input.nextStepId);
  if (linkErr) throw new Error(linkErr.message);

  return {
    ok: true,
    taskId: taskRow.id,
    frenteId,
    assigneeSkippedExternal,
  };
}

type NextStepRow = {
  id: string;
  description: string;
  due_date: string | null;
  task_id: string | null;
  assignee_person_id: string | null;
  frente_id: string | null;
};

export async function syncAutoTasksForMeeting(
  supabase: SupabaseClient<Database>,
  meetingId: string,
): Promise<{
  createdTaskIds: string[];
  warnings: MeetingNextStepAutoWarning[];
}> {
  const { data: meeting, error: mErr } = await supabase
    .from("meetings")
    .select("id, operation_id, auto_create_tasks_from_next_steps")
    .eq("id", meetingId)
    .maybeSingle();
  if (mErr) {
    if (isPostgrestMissingColumnError(mErr)) {
      return { createdTaskIds: [], warnings: [] };
    }
    throw new Error(mErr.message);
  }
  if (!meeting) throw new Error("Reunião não encontrada.");
  if (meeting.auto_create_tasks_from_next_steps === false) {
    return { createdTaskIds: [], warnings: [] };
  }

  const stepsWithFrente = await supabase
    .from("meeting_agenda_next_steps")
    .select(
      "id, description, due_date, task_id, assignee_person_id, frente_id",
    )
    .eq("meeting_id", meetingId)
    .order("sort_order", { ascending: true });
  let stepsError = stepsWithFrente.error;
  let steps: Array<{
    id: string;
    description: string;
    due_date: string | null;
    task_id: string | null;
    assignee_person_id: string | null;
    frente_id?: string | null;
  }> | null = stepsWithFrente.data;
  if (stepsError && isPostgrestMissingColumnError(stepsError)) {
    const legacy = await supabase
      .from("meeting_agenda_next_steps")
      .select("id, description, due_date, task_id, assignee_person_id")
      .eq("meeting_id", meetingId)
      .order("sort_order", { ascending: true });
    stepsError = legacy.error;
    steps = legacy.data;
  }
  if (stepsError) throw new Error(stepsError.message);

  const createdTaskIds: string[] = [];
  const warnings: MeetingNextStepAutoWarning[] = [];

  for (const step of steps ?? []) {
    if (step.task_id) continue;
    const result = await promoteMeetingNextStepToTask(supabase, {
      nextStepId: step.id,
      meetingId: meeting.id,
      operationId: meeting.operation_id,
      description: step.description,
      dueDate: step.due_date,
      assigneePersonId: step.assignee_person_id,
      explicitFrenteId: step.frente_id ?? null,
      existingTaskId: null,
    });
    if (result.ok) {
      createdTaskIds.push(result.taskId);
      continue;
    }
    if (result.reason === "already_linked" || result.reason === "empty") {
      continue;
    }
    if (result.reason === "ambiguous_frente") {
      warnings.push({
        nextStepId: step.id,
        code: "ambiguous_frente",
        message:
          "Várias frentes na operação — selecione uma frente no passo ou promova manualmente.",
      });
    } else if (result.reason === "no_frente") {
      warnings.push({
        nextStepId: step.id,
        code: "no_frente",
        message:
          "Nenhuma frente ativa — defina a frente no passo ou promova manualmente.",
      });
    }
  }

  return { createdTaskIds, warnings };
}
