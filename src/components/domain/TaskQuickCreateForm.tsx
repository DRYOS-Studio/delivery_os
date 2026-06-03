"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { createTaskAction } from "@/lib/actions/tasks";
import type { OperationWithFrentes } from "@/lib/db/queries/operations";
import type { InternalPersonItem } from "@/lib/db/queries/persons";

type Props = {
  operations: OperationWithFrentes[];
  assignees: InternalPersonItem[];
};

const STATUS_OPTIONS = [
  { value: "todo", label: "A fazer" },
  { value: "doing", label: "Em andamento" },
  { value: "blocked", label: "Bloqueada" },
  { value: "done", label: "Concluída" },
] as const;

type FormShape = {
  operation_id: string;
  frente_id: string;
  title: string;
  description: string;
  status: "todo" | "doing" | "blocked" | "done";
  assignee_person_id: string;
  start_date: string;
  due_date: string;
  tags_raw: string;
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
    const field = (raw === "tags" ? "tags_raw" : raw) as keyof FormShape;
    setError(field, { message });
    return;
  }
  setGeneral(message);
}

export function TaskQuickCreateForm({
  operations,
  assignees,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [generalError, setGeneralError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormShape>({
    defaultValues: {
      operation_id: "",
      frente_id: "",
      title: "",
      description: "",
      status: "todo",
      assignee_person_id: "",
      start_date: "",
      due_date: "",
      tags_raw: "",
    },
  });

  const selectedOperationId = watch("operation_id");
  const frentes = useMemo(
    () =>
      operations.find((op) => op.id === selectedOperationId)?.frentes ?? [],
    [operations, selectedOperationId],
  );

  async function onSubmit(values: FormShape) {
    setGeneralError(null);
    if (!values.frente_id) {
      setError("frente_id", { message: "Selecione uma Frente." });
      return;
    }

    const fd = new FormData();
    fd.set("title", values.title);
    fd.set("description", values.description);
    fd.set("status", values.status);
    fd.set("assignee_person_id", values.assignee_person_id);
    fd.set("start_date", values.start_date);
    fd.set("due_date", values.due_date);
    fd.set("tags", values.tags_raw);
    fd.set("quick_win_id", "");
    fd.set("sla_incident_id", "");

    const result = await createTaskAction(values.frente_id, fd);
    if (result.ok) {
      router.push("/tasks");
      router.refresh();
      return;
    }
    mapErrorToFields(result.code, result.error, setError, setGeneralError);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-2xl">
      {generalError && (
        <div className="bg-critical-bg border border-critical text-critical text-sm rounded px-3 py-2">
          {generalError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field
          label="Operação"
          htmlFor="operation_id"
          required
          error={errors.operation_id?.message}
        >
          <select
            id="operation_id"
            {...register("operation_id", {
              required: "Selecione uma Operação.",
              onChange: () => setValue("frente_id", ""),
            })}
            disabled={isSubmitting}
            className={inputCn}
          >
            <option value="">Selecione…</option>
            {operations.map((op) => (
              <option key={op.id} value={op.id}>
                {op.clientName} · {op.name}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Frente"
          htmlFor="frente_id"
          required
          error={errors.frente_id?.message}
          hint={
            !selectedOperationId ? "Escolha a Operação primeiro." : undefined
          }
        >
          <select
            id="frente_id"
            {...register("frente_id")}
            disabled={isSubmitting || !selectedOperationId}
            className={inputCn}
          >
            <option value="">
              {selectedOperationId ? "Selecione…" : "—"}
            </option>
            {frentes.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

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
          label="Responsável"
          htmlFor="assignee_person_id"
          error={errors.assignee_person_id?.message}
        >
          <select
            id="assignee_person_id"
            {...register("assignee_person_id")}
            disabled={isSubmitting}
            className={inputCn}
          >
            <option value="">— sem responsável</option>
            {assignees.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

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

      <div className="flex items-center gap-2 pt-2">
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : "Criar tarefa"}
        </Button>
        <Link href="/tasks">
          <Button variant="ghost" type="button">
            Cancelar
          </Button>
        </Link>
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
