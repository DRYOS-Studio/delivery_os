"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { DeleteTaskButton } from "@/components/domain/DeleteTaskButton";
import { createTaskAction, updateTaskAction } from "@/lib/actions/tasks";
import type { TaskRow } from "@/lib/db/queries/tasks";

type AssigneeOption = { id: string; name: string };
type QuickWinOption = { id: string; title: string };
type IncidentOption = { id: string; title: string };
type ParentOption = { id: string; title: string };

type Props = (
  | {
      mode: "create";
      frenteId: string;
      operationId: string;
      defaultParentId?: string;
    }
  | {
      mode: "edit";
      frenteId: string;
      operationId: string;
      initialData: TaskRow;
    }
) & {
  assignees: AssigneeOption[];
  quickWins: QuickWinOption[];
  incidents: IncidentOption[];
  parents: ParentOption[];
  isAdmin: boolean;
};

const STATUS_OPTIONS = [
  { value: "todo", label: "A fazer" },
  { value: "doing", label: "Em andamento" },
  { value: "blocked", label: "Bloqueada" },
  { value: "done", label: "Concluída" },
] as const;

type FormShape = {
  title: string;
  description: string;
  status: "todo" | "doing" | "blocked" | "done";
  assignee_person_ids: string[];
  parent_task_id: string;
  start_date: string;
  due_date: string;
  tags_raw: string;
  quick_win_id: string;
  sla_incident_id: string;
};

function mapErrorToFields(
  code: string | undefined,
  message: string,
  setError: ReturnType<typeof useForm<FormShape>>["setError"],
  setGeneral: (m: string | null) => void,
): void {
  if (!code) return setGeneral(message);
  if (code.startsWith("validation_")) {
    const raw = code.replace("validation_", "");
    const field = (
      raw === "tags"
        ? "tags_raw"
        : raw === "assignee_person_ids"
          ? "assignee_person_ids"
          : raw
    ) as keyof FormShape;
    setError(field, { message });
    return;
  }
  setGeneral(message);
}

export function TaskForm(props: Props): React.JSX.Element {
  const router = useRouter();
  const isEdit = props.mode === "edit";
  const [generalError, setGeneralError] = useState<string | null>(null);

  const defaultValues: FormShape = isEdit
    ? {
        title: props.initialData.title,
        description: props.initialData.description ?? "",
        status: props.initialData.status,
        assignee_person_ids: props.initialData.assignees.map((a) => a.id),
        parent_task_id: props.initialData.parentTaskId ?? "",
        start_date: props.initialData.startDate ?? "",
        due_date: props.initialData.dueDate ?? "",
        tags_raw: (props.initialData.tags ?? []).join(", "),
        quick_win_id: props.initialData.quickWinId ?? "",
        sla_incident_id: props.initialData.slaIncidentId ?? "",
      }
    : {
        title: "",
        description: "",
        status: "todo",
        assignee_person_ids: [],
        parent_task_id: props.mode === "create" ? (props.defaultParentId ?? "") : "",
        start_date: "",
        due_date: "",
        tags_raw: "",
        quick_win_id: "",
        sla_incident_id: "",
      };

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormShape>({
    defaultValues,
  });

  async function onSubmit(values: FormShape) {
    setGeneralError(null);
    const fd = new FormData();
    fd.set("title", values.title);
    fd.set("description", values.description);
    fd.set("status", values.status);
    for (const id of values.assignee_person_ids) {
      fd.append("assignee_person_ids", id);
    }
    fd.set("parent_task_id", values.parent_task_id);
    fd.set("start_date", values.start_date);
    fd.set("due_date", values.due_date);
    fd.set("tags", values.tags_raw);
    fd.set("quick_win_id", values.quick_win_id);
    fd.set("sla_incident_id", values.sla_incident_id);

    const result = isEdit
      ? await updateTaskAction(props.initialData.id, fd)
      : await createTaskAction(props.frenteId, fd);

    if (result.ok) {
      router.push(
        `/operations/${props.operationId}/frentes/${props.frenteId}`,
      );
      router.refresh();
      return;
    }
    mapErrorToFields(result.code, result.error, setError, setGeneralError);
  }

  const cancelHref = `/operations/${props.operationId}/frentes/${props.frenteId}`;

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4 max-w-2xl"
    >
      {generalError && (
        <div className="bg-critical-bg border border-critical text-critical text-sm rounded px-3 py-2">
          {generalError}
        </div>
      )}

      <Field label="Título" htmlFor="title" required error={errors.title?.message}>
        <input
          id="title"
          type="text"
          {...register("title")}
          disabled={isSubmitting}
          placeholder="O que precisa ser feito"
          className={inputCn}
        />
      </Field>

      <Field
        label="Descrição"
        htmlFor="description"
        error={errors.description?.message}
        hint="Detalhes, contexto, critério de pronto."
      >
        <textarea
          id="description"
          {...register("description")}
          disabled={isSubmitting}
          rows={5}
          className={textareaCn}
        />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field
          label="Status"
          htmlFor="status"
          required
          error={errors.status?.message}
        >
          <select
            id="status"
            {...register("status")}
            disabled={isSubmitting}
            className={inputCn}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Responsáveis"
          htmlFor="assignee_person_ids"
          error={errors.assignee_person_ids?.message}
          hint="Busque e marque uma ou mais pessoas."
        >
          <Controller
            control={control}
            name="assignee_person_ids"
            render={({ field }) => (
              <MultiSelect
                id="assignee_person_ids"
                options={props.assignees}
                value={field.value}
                onChange={field.onChange}
                disabled={isSubmitting}
                placeholder="— sem responsável"
                emptyText="Nenhuma pessoa interna cadastrada."
              />
            )}
          />
        </Field>
      </div>

      {props.parents.length > 0 && (
        <Field
          label="Tarefa-pai"
          htmlFor="parent_task_id"
          error={errors.parent_task_id?.message}
          hint="Opcional. Vira subtarefa da escolhida (mesma Frente)."
        >
          <select
            id="parent_task_id"
            {...register("parent_task_id")}
            disabled={isSubmitting}
            className={inputCn}
          >
            <option value="">— nenhuma (tarefa top-level)</option>
            {props.parents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </Field>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field
          label="Data de início"
          htmlFor="start_date"
          error={errors.start_date?.message}
          hint="Opcional. Não pode ser depois do prazo."
        >
          <input
            id="start_date"
            type="date"
            {...register("start_date")}
            disabled={isSubmitting}
            className={inputCn}
          />
        </Field>

        <Field
          label="Prazo"
          htmlFor="due_date"
          error={errors.due_date?.message}
          hint="Opcional."
        >
          <input
            id="due_date"
            type="date"
            {...register("due_date")}
            disabled={isSubmitting}
            className={inputCn}
          />
        </Field>
      </div>

      <Field
        label="Tags"
        htmlFor="tags_raw"
        error={errors.tags_raw?.message}
        hint="Separe por vírgula."
      >
        <input
          id="tags_raw"
          type="text"
          {...register("tags_raw")}
          disabled={isSubmitting}
          placeholder="ex: copy, infra, urgente"
          className={inputCn}
        />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field
          label="Vincular Quick Win"
          htmlFor="quick_win_id"
          error={errors.quick_win_id?.message}
          hint="Opcional."
        >
          <select
            id="quick_win_id"
            {...register("quick_win_id")}
            disabled={isSubmitting}
            className={inputCn}
          >
            <option value="">— nenhum</option>
            {props.quickWins.map((q) => (
              <option key={q.id} value={q.id}>
                {q.title}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Vincular Incidente SLA"
          htmlFor="sla_incident_id"
          error={errors.sla_incident_id?.message}
          hint="Opcional."
        >
          <select
            id="sla_incident_id"
            {...register("sla_incident_id")}
            disabled={isSubmitting}
            className={inputCn}
          >
            <option value="">— nenhum</option>
            {props.incidents.map((i) => (
              <option key={i.id} value={i.id}>
                {i.title}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? "Salvando..." : isEdit ? "Salvar" : "Criar tarefa"}
          </Button>
          <Link href={cancelHref}>
            <Button variant="ghost" type="button">
              Cancelar
            </Button>
          </Link>
        </div>
        {isEdit && props.isAdmin && (
          <DeleteTaskButton
            taskId={props.initialData.id}
            title={props.initialData.title}
            redirectTo={cancelHref}
            variant="button"
          />
        )}
      </div>
    </form>
  );
}

const inputCn =
  "w-full bg-card border border-line rounded px-3 py-2 text-sm text-ink-soft placeholder:text-mute-soft focus:outline-none focus:border-line-strong disabled:opacity-50 disabled:cursor-not-allowed";

const textareaCn = `${inputCn} font-body leading-relaxed resize-y`;

function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean | undefined;
  hint?: string | undefined;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label
        htmlFor={htmlFor}
        className="block font-mono text-[10px] text-mute uppercase tracking-wide"
      >
        {label}
        {required && <span className="text-critical ml-1">*</span>}
      </label>
      {children}
      {hint && !error && (
        <p className="font-mono text-[10px] text-mute-soft">{hint}</p>
      )}
      {error && <p className="text-critical text-xs">{error}</p>}
    </div>
  );
}
