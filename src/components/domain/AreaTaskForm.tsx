"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DeleteTaskButton } from "@/components/domain/DeleteTaskButton";
import { Button } from "@/components/ui/Button";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { createAreaTaskAction, updateTaskAction } from "@/lib/actions/tasks";
import { AREA_LABELS, ALL_AREAS, type TaskArea } from "@/lib/utils/areas";
import type { TaskRow } from "@/lib/db/queries/tasks";

type AssigneeOption = { id: string; name: string };

type Props = (
  | { mode: "create"; operationId: string }
  | { mode: "edit"; operationId: string; initialData: TaskRow }
) & {
  assignees: AssigneeOption[];
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
  area: TaskArea;
  assignee_person_ids: string[];
  start_date: string;
  due_date: string;
  tags_raw: string;
};

export function AreaTaskForm(props: Props): React.JSX.Element {
  const router = useRouter();
  const isEdit = props.mode === "edit";
  const [generalError, setGeneralError] = useState<string | null>(null);

  const initialArea =
    isEdit && props.initialData.area ? props.initialData.area : "cs";

  const defaultValues: FormShape = isEdit
    ? {
        title: props.initialData.title,
        description: props.initialData.description ?? "",
        status: props.initialData.status,
        area: initialArea,
        assignee_person_ids: props.initialData.assignees.map((a) => a.id),
        start_date: props.initialData.startDate ?? "",
        due_date: props.initialData.dueDate ?? "",
        tags_raw: (props.initialData.tags ?? []).join(", "),
      }
    : {
        title: "",
        description: "",
        status: "todo",
        area: "cs",
        assignee_person_ids: [],
        start_date: "",
        due_date: "",
        tags_raw: "",
      };

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormShape>({ defaultValues });

  const backHref = `/operations/${props.operationId}`;

  async function onSubmit(values: FormShape) {
    setGeneralError(null);
    const fd = new FormData();
    fd.set("title", values.title);
    fd.set("description", values.description);
    fd.set("status", values.status);
    fd.set("area", values.area);
    for (const id of values.assignee_person_ids) {
      fd.append("assignee_person_ids", id);
    }
    fd.set("start_date", values.start_date);
    fd.set("due_date", values.due_date);
    fd.set("tags", values.tags_raw);

    const result = isEdit
      ? await updateTaskAction(props.initialData.id, fd)
      : await createAreaTaskAction(props.operationId, fd);

    if (result.ok) {
      router.push(backHref);
      router.refresh();
      return;
    }
    if (result.code?.startsWith("validation_")) {
      const field = result.code.replace("validation_", "");
      const key = (field === "tags" ? "tags_raw" : field) as keyof FormShape;
      setError(key, { message: result.error });
      return;
    }
    setGeneralError(result.error);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-2xl">
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
        <Field label="Área" htmlFor="area" required>
          {isEdit ? (
            <input
              id="area"
              type="text"
              value={AREA_LABELS[initialArea]}
              disabled
              className={inputCn}
            />
          ) : (
            <select
              id="area"
              {...register("area")}
              disabled={isSubmitting}
              className={inputCn}
            >
              {ALL_AREAS.map((a) => (
                <option key={a} value={a}>
                  {AREA_LABELS[a]}
                </option>
              ))}
            </select>
          )}
        </Field>

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
      </div>

      <Field
        label="Responsáveis"
        htmlFor="assignee_person_ids"
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
        <Field label="Prazo" htmlFor="due_date" error={errors.due_date?.message} hint="Opcional.">
          <input
            id="due_date"
            type="date"
            {...register("due_date")}
            disabled={isSubmitting}
            className={inputCn}
          />
        </Field>
      </div>

      <Field label="Tags" htmlFor="tags_raw" error={errors.tags_raw?.message} hint="Separe por vírgula.">
        <input
          id="tags_raw"
          type="text"
          {...register("tags_raw")}
          disabled={isSubmitting}
          placeholder="ex: contrato, renovação"
          className={inputCn}
        />
      </Field>

      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? "Salvando..." : isEdit ? "Salvar" : "Criar tarefa"}
          </Button>
          <Link href={backHref}>
            <Button variant="ghost" type="button">
              Cancelar
            </Button>
          </Link>
        </div>
        {isEdit && props.isAdmin && (
          <DeleteTaskButton
            taskId={props.initialData.id}
            title={props.initialData.title}
            redirectTo={backHref}
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
