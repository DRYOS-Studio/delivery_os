"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import {
  createMeetingAction,
  deleteMeetingAction,
  updateMeetingAction,
} from "@/lib/actions/meetings";
import { VISIBILITY_LABEL } from "@/lib/constants/visibility";
import type { AttendeeRef, MeetingWithAttendees } from "@/lib/db/queries/meetings";
import {
  isoToDateTimeLocal,
  dateTimeLocalToISO,
} from "@/lib/utils/datetime";
import {
  meetingSchema,
  type MeetingInput,
  type MeetingOutput,
} from "@/lib/validators/meeting";

type Props =
  | {
      mode: "create";
      operationId: string;
      clientName: string;
      attendeeCandidates: AttendeeRef[];
    }
  | {
      mode: "edit";
      operationId: string;
      clientName: string;
      initialData: MeetingWithAttendees;
      attendeeCandidates: AttendeeRef[];
    };

function mapErrorToFields(
  code: string | undefined,
  message: string,
  setError: ReturnType<typeof useForm<MeetingInput>>["setError"],
  setGeneral: (m: string | null) => void,
): void {
  if (!code) return setGeneral(message);
  if (code.startsWith("validation_")) {
    const field = code.replace("validation_", "") as keyof MeetingInput;
    setError(field, { message });
    return;
  }
  setGeneral(message);
}

function defaultScheduledAt(): string {
  return isoToDateTimeLocal(new Date().toISOString());
}

export function MeetingForm(props: Props): React.JSX.Element {
  const router = useRouter();
  const isEdit = props.mode === "edit";
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const defaultValues: MeetingInput = isEdit
    ? {
        title: props.initialData.title,
        scheduled_at: isoToDateTimeLocal(props.initialData.scheduled_at),
        notes: props.initialData.notes ?? "",
        visibility: props.initialData.visibility,
        attendee_ids: props.initialData.attendees.map((a) => a.id),
      }
    : {
        title: "",
        scheduled_at: defaultScheduledAt(),
        notes: "",
        visibility: "interno",
        attendee_ids: [],
      };

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<MeetingInput, undefined, MeetingOutput>({
    resolver: zodResolver(meetingSchema),
    defaultValues,
  });

  const busy = isSubmitting || isDeleting;

  const internals = props.attendeeCandidates.filter((a) => a.kind === "internal");
  const externals = props.attendeeCandidates.filter((a) => a.kind === "external");

  async function onSubmit(data: MeetingOutput) {
    setGeneralError(null);
    const fd = new FormData();
    fd.set("title", data.title);
    fd.set("scheduled_at", dateTimeLocalToISO(data.scheduled_at));
    fd.set("notes", data.notes ?? "");
    fd.set("visibility", data.visibility);
    for (const id of data.attendee_ids) {
      fd.append("attendee_ids", id);
    }

    const result = isEdit
      ? await updateMeetingAction(props.initialData.id, fd)
      : await createMeetingAction(props.operationId, fd);

    if (result.ok) {
      router.push(`/operations/${result.data.operationId}`);
      router.refresh();
      return;
    }
    mapErrorToFields(result.code, result.error, setError, setGeneralError);
  }

  async function handleDelete() {
    if (!isEdit) return;
    if (!window.confirm("Remover esta reunião? Decisões associadas perderão o link.")) return;
    setIsDeleting(true);
    setGeneralError(null);
    const result = await deleteMeetingAction(props.initialData.id);
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
          placeholder="Kickoff, semanal, retro..."
          className={inputCn}
        />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field
          label="Data e hora"
          htmlFor="scheduled_at"
          required
          error={errors.scheduled_at?.message}
        >
          <input
            id="scheduled_at"
            type="datetime-local"
            {...register("scheduled_at")}
            disabled={busy}
            className={inputCn}
          />
        </Field>

        <Field label="Visibility" htmlFor="visibility" required error={errors.visibility?.message}>
          <select
            id="visibility"
            {...register("visibility")}
            disabled={busy}
            className={inputCn}
          >
            <option value="interno">{VISIBILITY_LABEL.interno}</option>
            <option value="cliente">{VISIBILITY_LABEL.cliente}</option>
          </select>
        </Field>
      </div>

      <Field label="Notas" htmlFor="notes" error={errors.notes?.message} hint="Pauta, decisões, próximos passos.">
        <textarea
          id="notes"
          {...register("notes")}
          disabled={busy}
          rows={6}
          className={textareaCn}
        />
      </Field>

      <fieldset className="space-y-3">
        <legend className="block font-mono text-[10px] text-mute uppercase tracking-wide mb-2">
          Participantes
        </legend>

        {internals.length > 0 && (
          <AttendeeGroup
            title="Internos"
            persons={internals}
            register={register}
            disabled={busy}
          />
        )}
        {externals.length > 0 && (
          <AttendeeGroup
            title={`Externos — ${props.clientName}`}
            persons={externals}
            register={register}
            disabled={busy}
          />
        )}
        {internals.length === 0 && externals.length === 0 && (
          <p className="text-sm text-mute">
            Sem pessoas cadastradas pra esta Operação.
          </p>
        )}
      </fieldset>

      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <Button type="submit" variant="primary" disabled={busy}>
            {isSubmitting ? "Salvando..." : isEdit ? "Salvar" : "Criar reunião"}
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

function AttendeeGroup({
  title,
  persons,
  register,
  disabled,
}: {
  title: string;
  persons: AttendeeRef[];
  register: ReturnType<typeof useForm<MeetingInput>>["register"];
  disabled: boolean;
}) {
  return (
    <div className="space-y-2">
      <p className="font-mono text-[10px] text-mute-soft uppercase tracking-wide">
        {title}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
        {persons.map((p) => (
          <label
            key={p.id}
            className="flex items-center gap-2 text-sm text-ink-soft cursor-pointer"
          >
            <input
              type="checkbox"
              value={p.id}
              disabled={disabled}
              {...register("attendee_ids")}
              className="accent-sage"
            />
            {p.name}
          </label>
        ))}
      </div>
    </div>
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
