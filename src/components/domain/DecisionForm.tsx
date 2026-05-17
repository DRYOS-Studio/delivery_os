"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import {
  createDecisionAction,
  deleteDecisionAction,
  updateDecisionAction,
} from "@/lib/actions/decisions";
import { VISIBILITY_LABEL } from "@/lib/constants/visibility";
import type { DecisionRow } from "@/lib/db/queries/decisions";
import type { MeetingListItem } from "@/lib/db/queries/meetings";
import {
  dateTimeLocalToISO,
  formatDateTimeBR,
  isoToDateTimeLocal,
} from "@/lib/utils/datetime";
import {
  decisionSchema,
  type DecisionInput,
  type DecisionOutput,
} from "@/lib/validators/decision";

type Props =
  | {
      mode: "create";
      operationId: string;
      meetings: MeetingListItem[];
    }
  | {
      mode: "edit";
      operationId: string;
      initialData: DecisionRow;
      meetings: MeetingListItem[];
    };

function mapErrorToFields(
  code: string | undefined,
  message: string,
  setError: ReturnType<typeof useForm<DecisionInput>>["setError"],
  setGeneral: (m: string | null) => void,
): void {
  if (!code) return setGeneral(message);
  if (code.startsWith("validation_")) {
    const field = code.replace("validation_", "") as keyof DecisionInput;
    setError(field, { message });
    return;
  }
  if (code === "invalid_meeting") {
    setError("meeting_id", { message });
    return;
  }
  setGeneral(message);
}

function defaultDecidedAt(): string {
  return isoToDateTimeLocal(new Date().toISOString());
}

export function DecisionForm(props: Props): React.JSX.Element {
  const router = useRouter();
  const isEdit = props.mode === "edit";
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const defaultValues: DecisionInput = isEdit
    ? {
        title: props.initialData.title,
        context: props.initialData.context ?? "",
        decision: props.initialData.decision,
        visibility: props.initialData.visibility,
        decided_at: isoToDateTimeLocal(props.initialData.decided_at),
        meeting_id: props.initialData.meeting_id ?? "",
      }
    : {
        title: "",
        context: "",
        decision: "",
        visibility: "cliente",
        decided_at: defaultDecidedAt(),
        meeting_id: "",
      };

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DecisionInput, undefined, DecisionOutput>({
    resolver: zodResolver(decisionSchema),
    defaultValues,
  });

  const busy = isSubmitting || isDeleting;

  async function onSubmit(data: DecisionOutput) {
    setGeneralError(null);
    const fd = new FormData();
    fd.set("title", data.title);
    fd.set("context", data.context ?? "");
    fd.set("decision", data.decision);
    fd.set("visibility", data.visibility);
    fd.set("decided_at", dateTimeLocalToISO(data.decided_at));
    fd.set("meeting_id", data.meeting_id ?? "");

    const result = isEdit
      ? await updateDecisionAction(props.initialData.id, fd)
      : await createDecisionAction(props.operationId, fd);

    if (result.ok) {
      router.push(`/operations/${result.data.operationId}`);
      router.refresh();
      return;
    }
    mapErrorToFields(result.code, result.error, setError, setGeneralError);
  }

  async function handleDelete() {
    if (!isEdit) return;
    if (!window.confirm("Remover esta decisão?")) return;
    setIsDeleting(true);
    setGeneralError(null);
    const result = await deleteDecisionAction(props.initialData.id);
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

      <Field label="Título" htmlFor="title" required error={errors.title?.message}>
        <input
          id="title"
          type="text"
          {...register("title")}
          disabled={busy}
          placeholder="Resumo da decisão em uma linha"
          className={inputCn}
        />
      </Field>

      <Field
        label="Contexto"
        htmlFor="context"
        error={errors.context?.message}
        hint="Situação que motivou a decisão (opcional)."
      >
        <textarea
          id="context"
          {...register("context")}
          disabled={busy}
          rows={4}
          className={textareaCn}
        />
      </Field>

      <Field
        label="Decisão"
        htmlFor="decision"
        required
        error={errors.decision?.message}
        hint="O que foi decidido, em prosa."
      >
        <textarea
          id="decision"
          {...register("decision")}
          disabled={busy}
          rows={6}
          className={textareaCn}
        />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field
          label="Data da decisão"
          htmlFor="decided_at"
          required
          error={errors.decided_at?.message}
        >
          <input
            id="decided_at"
            type="datetime-local"
            {...register("decided_at")}
            disabled={busy}
            className={inputCn}
          />
        </Field>

        <Field
          label="Visibility"
          htmlFor="visibility"
          required
          error={errors.visibility?.message}
        >
          <select
            id="visibility"
            {...register("visibility")}
            disabled={busy}
            className={inputCn}
          >
            <option value="cliente">{VISIBILITY_LABEL.cliente}</option>
            <option value="interno">{VISIBILITY_LABEL.interno}</option>
          </select>
        </Field>
      </div>

      <Field
        label="Reunião associada"
        htmlFor="meeting_id"
        error={errors.meeting_id?.message}
        hint="Opcional. Decisão pode existir sem reunião."
      >
        <select
          id="meeting_id"
          {...register("meeting_id")}
          disabled={busy}
          className={inputCn}
        >
          <option value="">— Sem reunião associada —</option>
          {props.meetings.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title} · {formatDateTimeBR(m.scheduledAt)}
            </option>
          ))}
        </select>
      </Field>

      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <Button type="submit" variant="primary" disabled={busy}>
            {isSubmitting ? "Salvando..." : isEdit ? "Salvar" : "Criar decisão"}
          </Button>
          <Link href={cancelHref}>
            <Button variant="ghost" type="button">
              Cancelar
            </Button>
          </Link>
        </div>
        {isEdit && (
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
