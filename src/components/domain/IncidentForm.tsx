"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import {
  createIncidentAction,
  deleteIncidentAction,
  updateIncidentAction,
} from "@/lib/actions/incidents";
import type { IncidentRow } from "@/lib/db/queries/incidents";
import {
  dateTimeLocalToISO,
  isoToDateTimeLocal,
} from "@/lib/utils/datetime";
import {
  incidentSchema,
  type IncidentInput,
  type IncidentOutput,
} from "@/lib/validators/incident";

type Props = (
  | { mode: "create"; operationId: string }
  | { mode: "edit"; operationId: string; initialData: IncidentRow }
) & { isAdmin?: boolean };

const SEVERITY_OPTIONS = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
] as const;

const STATUS_OPTIONS = [
  { value: "open", label: "Aberto" },
  { value: "responded", label: "Respondido" },
  { value: "resolved", label: "Resolvido" },
  { value: "cancelled", label: "Cancelado" },
] as const;

function mapErrorToFields(
  code: string | undefined,
  message: string,
  setError: ReturnType<typeof useForm<IncidentInput>>["setError"],
  setGeneral: (m: string | null) => void,
): void {
  if (!code) return setGeneral(message);
  if (code.startsWith("validation_")) {
    const field = code.replace("validation_", "") as keyof IncidentInput;
    setError(field, { message });
    return;
  }
  setGeneral(message);
}

function defaultOpenedAt(): string {
  return isoToDateTimeLocal(new Date().toISOString());
}

export function IncidentForm(props: Props): React.JSX.Element {
  const router = useRouter();
  const isEdit = props.mode === "edit";
  const isAdmin = props.isAdmin ?? false;
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const defaultValues: IncidentInput = isEdit
    ? {
        title: props.initialData.title,
        description: props.initialData.description ?? "",
        severity: props.initialData.severity,
        status: props.initialData.status,
        opened_at: isoToDateTimeLocal(props.initialData.opened_at),
        responded_at: props.initialData.responded_at
          ? isoToDateTimeLocal(props.initialData.responded_at)
          : "",
        resolved_at: props.initialData.resolved_at
          ? isoToDateTimeLocal(props.initialData.resolved_at)
          : "",
      }
    : {
        title: "",
        description: "",
        severity: "medium",
        status: "open",
        opened_at: defaultOpenedAt(),
        responded_at: "",
        resolved_at: "",
      };

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<IncidentInput, undefined, IncidentOutput>({
    resolver: zodResolver(incidentSchema),
    defaultValues,
  });

  const busy = isSubmitting || isDeleting;

  async function onSubmit(data: IncidentOutput) {
    setGeneralError(null);
    const fd = new FormData();
    fd.set("title", data.title);
    fd.set("description", data.description ?? "");
    fd.set("severity", data.severity);
    fd.set("status", data.status);
    fd.set("opened_at", dateTimeLocalToISO(data.opened_at));
    fd.set(
      "responded_at",
      data.responded_at ? dateTimeLocalToISO(data.responded_at) : "",
    );
    fd.set(
      "resolved_at",
      data.resolved_at ? dateTimeLocalToISO(data.resolved_at) : "",
    );

    const result = isEdit
      ? await updateIncidentAction(props.initialData.id, fd)
      : await createIncidentAction(props.operationId, fd);

    if (result.ok) {
      router.push(`/operations/${result.data.operationId}`);
      router.refresh();
      return;
    }
    mapErrorToFields(result.code, result.error, setError, setGeneralError);
  }

  async function handleDelete() {
    if (!isEdit) return;
    if (!window.confirm("Remover este incidente? Não pode ser desfeito."))
      return;
    setIsDeleting(true);
    setGeneralError(null);
    const result = await deleteIncidentAction(props.initialData.id);
    if (result.ok) {
      router.push(`/operations/${result.data.operationId}`);
      router.refresh();
    } else {
      setGeneralError(result.error);
      setIsDeleting(false);
    }
  }

  const cancelHref = `/operations/${props.operationId}`;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-2xl">
      {generalError && (
        <div className="bg-critical-bg border border-critical text-critical text-sm rounded px-3 py-2">
          {generalError}
        </div>
      )}

      <Field
        label="Título"
        htmlFor="title"
        required
        error={errors.title?.message}
      >
        <input
          id="title"
          type="text"
          {...register("title")}
          disabled={busy}
          placeholder="Resumo do incidente em uma linha"
          className={inputCn}
        />
      </Field>

      <Field
        label="Descrição"
        htmlFor="description"
        error={errors.description?.message}
        hint="Detalhes, impacto, contexto."
      >
        <textarea
          id="description"
          {...register("description")}
          disabled={busy}
          rows={5}
          className={textareaCn}
        />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field
          label="Severidade"
          htmlFor="severity"
          required
          error={errors.severity?.message}
        >
          <select
            id="severity"
            {...register("severity")}
            disabled={busy}
            className={inputCn}
          >
            {SEVERITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
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
            disabled={busy}
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
        label="Aberto em"
        htmlFor="opened_at"
        required
        error={errors.opened_at?.message}
      >
        <input
          id="opened_at"
          type="datetime-local"
          {...register("opened_at")}
          disabled={busy}
          className={inputCn}
        />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field
          label="Respondido em"
          htmlFor="responded_at"
          error={errors.responded_at?.message}
          hint="Quando a primeira resposta foi dada."
        >
          <input
            id="responded_at"
            type="datetime-local"
            {...register("responded_at")}
            disabled={busy}
            className={inputCn}
          />
        </Field>

        <Field
          label="Resolvido em"
          htmlFor="resolved_at"
          error={errors.resolved_at?.message}
          hint="Quando o incidente foi resolvido."
        >
          <input
            id="resolved_at"
            type="datetime-local"
            {...register("resolved_at")}
            disabled={busy}
            className={inputCn}
          />
        </Field>
      </div>

      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <Button type="submit" variant="primary" disabled={busy}>
            {isSubmitting ? "Salvando..." : isEdit ? "Salvar" : "Criar incidente"}
          </Button>
          <Link href={cancelHref}>
            <Button variant="ghost" type="button">
              Cancelar
            </Button>
          </Link>
        </div>
        {isEdit && isAdmin && (
          <Button
            type="button"
            variant="ghost"
            onClick={handleDelete}
            disabled={busy}
            className="text-critical hover:text-critical hover:bg-critical-bg"
          >
            {isDeleting ? "Removendo..." : "Remover"}
          </Button>
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
