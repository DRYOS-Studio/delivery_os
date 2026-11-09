"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import {
  createMeetingAction,
  deleteMeetingAction,
  updateMeetingAction,
} from "@/lib/actions/meetings";
import { VISIBILITY_LABEL } from "@/lib/constants/visibility";
import type { AttendeeRef, MeetingWithAttendees } from "@/lib/db/queries/meetings";
import {
  dateTimeLocalToISO,
  isoToDateTimeLocal,
} from "@/lib/utils/datetime";
import {
  appendMeetingOutputToFormData,
  buildMeetingFormPayload,
  meetingFormClientSchema,
  type MeetingFormClientInput,
  type MeetingFormClientOutput,
} from "@/lib/validators/meeting-form";

type Props = (
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
    }
) & { isAdmin?: boolean };

function mapErrorToFields(
  code: string | undefined,
  message: string,
  setError: ReturnType<typeof useForm<MeetingFormClientInput>>["setError"],
  setGeneral: (m: string | null) => void,
): void {
  if (!code) return setGeneral(message);
  if (code.startsWith("validation_")) {
    const field = code.replace("validation_", "") as keyof MeetingFormClientInput;
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
  const isAdmin = props.isAdmin ?? false;
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [granolaPaste, setGranolaPaste] = useState("");

  const defaultValues: MeetingFormClientInput = isEdit
    ? {
        title: props.initialData.title,
        scheduled_at: isoToDateTimeLocal(props.initialData.scheduled_at),
        ended_at: props.initialData.ended_at
          ? isoToDateTimeLocal(props.initialData.ended_at)
          : "",
        notes: props.initialData.notes ?? "",
        visibility: props.initialData.visibility,
        attendee_ids: props.initialData.attendees.map((a) => a.id),
        granola_suggestion_text:
          props.initialData.granola_suggestion_text ?? "",
        granola_source_ref: props.initialData.granola_source_ref ?? "",
        agenda_items:
          props.initialData.agenda_items.length > 0
            ? props.initialData.agenda_items.map((i) => ({
                id: i.id,
                title: i.title,
                notes: i.notes ?? "",
              }))
            : [{ title: "", notes: "" }],
        next_steps:
          props.initialData.next_steps.length > 0
            ? props.initialData.next_steps.map((s) => ({
                id: s.id,
                description: s.description,
                due_date: s.due_date ?? "",
                assignee_person_id: s.assignee_person_id ?? "",
              }))
            : [{ description: "", due_date: "" }],
      }
    : {
        title: "",
        scheduled_at: defaultScheduledAt(),
        ended_at: "",
        notes: "",
        visibility: "interno",
        attendee_ids: [],
        granola_suggestion_text: "",
        granola_source_ref: "",
        agenda_items: [{ title: "", notes: "" }],
        next_steps: [{ description: "", due_date: "", assignee_person_id: "" }],
      };

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<MeetingFormClientInput, undefined, MeetingFormClientOutput>({
    resolver: zodResolver(meetingFormClientSchema),
    defaultValues,
  });

  const {
    fields: agendaFields,
    append: appendAgenda,
    remove: removeAgenda,
  } = useFieldArray({ control, name: "agenda_items" });

  const {
    fields: nextFields,
    append: appendNext,
    remove: removeNext,
  } = useFieldArray({ control, name: "next_steps" });

  const busy = isSubmitting || isDeleting;

  const internals = props.attendeeCandidates.filter((a) => a.kind === "internal");
  const externals = props.attendeeCandidates.filter((a) => a.kind === "external");
  const assigneeCandidates = props.attendeeCandidates;

  async function onSubmit(data: MeetingFormClientOutput) {
    setGeneralError(null);
    const scheduledIso = dateTimeLocalToISO(data.scheduled_at);
    const endedIso = data.ended_at?.trim()
      ? dateTimeLocalToISO(data.ended_at)
      : undefined;
    const built = buildMeetingFormPayload(
      { ...data, scheduled_at: scheduledIso, ended_at: endedIso },
      granolaPaste,
    );
    if (!built.ok) {
      setGeneralError(built.message);
      return;
    }
    const fd = new FormData();
    appendMeetingOutputToFormData(fd, built.data, {
      granolaHasPaste: granolaPaste.trim().length > 0,
    });

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
          label="Início"
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

        <Field
          label="Término"
          htmlFor="ended_at"
          error={errors.ended_at?.message}
          hint="Opcional"
        >
          <input
            id="ended_at"
            type="datetime-local"
            {...register("ended_at")}
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

      <Field label="Notas" htmlFor="notes" error={errors.notes?.message} hint="Contexto livre da reunião (além da pauta estruturada abaixo).">
        <textarea
          id="notes"
          {...register("notes")}
          disabled={busy}
          rows={4}
          className={textareaCn}
        />
      </Field>

      <section className="space-y-3 border border-line rounded-lg p-4 bg-card/40">
        <h3 className="font-mono text-[10px] text-mute uppercase tracking-wide">
          Pauta
        </h3>
        <p className="text-sm text-mute">
          Itens ordenados. Decisões podem referenciar um item específico após salvar.
        </p>
        <div className="space-y-3">
          {agendaFields.map((field, index) => (
            <div
              key={field.id}
              className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_auto] md:items-start"
            >
              <input type="hidden" {...register(`agenda_items.${index}.id`)} />
              <Field
                label="Título do item"
                htmlFor={`agenda_title_${index}`}
                error={errors.agenda_items?.[index]?.title?.message}
              >
                <input
                  id={`agenda_title_${index}`}
                  type="text"
                  {...register(`agenda_items.${index}.title`)}
                  disabled={busy}
                  placeholder="Tópico"
                  className={inputCn}
                />
              </Field>
              <Field
                label="Detalhe (opcional)"
                htmlFor={`agenda_notes_${index}`}
                error={errors.agenda_items?.[index]?.notes?.message}
              >
                <input
                  id={`agenda_notes_${index}`}
                  type="text"
                  {...register(`agenda_items.${index}.notes`)}
                  disabled={busy}
                  placeholder="Notas"
                  className={inputCn}
                />
              </Field>
              <div className="flex md:pt-6">
                <button
                  type="button"
                  onClick={() => removeAgenda(index)}
                  disabled={busy || agendaFields.length <= 1}
                  className="p-2 text-mute hover:text-critical disabled:opacity-30"
                  aria-label="Remover item da pauta"
                >
                  <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={() => appendAgenda({ title: "", notes: "" })}
          className="gap-1.5"
        >
          <Plus className="w-4 h-4" strokeWidth={1.75} />
          Adicionar item
        </Button>
      </section>

      <section className="space-y-3 border border-line rounded-lg p-4 bg-card/40">
        <h3 className="font-mono text-[10px] text-mute uppercase tracking-wide">
          Próximos passos
        </h3>
        <div className="space-y-3">
          {nextFields.map((field, index) => (
            <div
              key={field.id}
              className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto_auto_auto] md:items-start"
            >
              <input type="hidden" {...register(`next_steps.${index}.id`)} />
              <Field
                label="Descrição"
                htmlFor={`next_desc_${index}`}
                error={errors.next_steps?.[index]?.description?.message}
              >
                <textarea
                  id={`next_desc_${index}`}
                  {...register(`next_steps.${index}.description`)}
                  disabled={busy}
                  rows={2}
                  placeholder="O que fazer depois"
                  className={textareaCn}
                />
              </Field>
              <Field
                label="Prazo"
                htmlFor={`next_due_${index}`}
                error={errors.next_steps?.[index]?.due_date?.message}
              >
                <input
                  id={`next_due_${index}`}
                  type="date"
                  {...register(`next_steps.${index}.due_date`)}
                  disabled={busy}
                  className={inputCn}
                />
              </Field>
              <Field label="Responsável" htmlFor={`next_assignee_${index}`} hint="Opcional">
                <select
                  id={`next_assignee_${index}`}
                  {...register(`next_steps.${index}.assignee_person_id`)}
                  disabled={busy}
                  className={inputCn}
                >
                  <option value="">—</option>
                  {assigneeCandidates.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.kind === "external" ? " (cliente)" : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="flex md:pt-6">
                <button
                  type="button"
                  onClick={() => removeNext(index)}
                  disabled={busy || nextFields.length <= 1}
                  className="p-2 text-mute hover:text-critical disabled:opacity-30"
                  aria-label="Remover próximo passo"
                >
                  <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={() =>
            appendNext({ description: "", due_date: "", assignee_person_id: "" })
          }
          className="gap-1.5"
        >
          <Plus className="w-4 h-4" strokeWidth={1.75} />
          Adicionar próximo passo
        </Button>
      </section>

      <section className="space-y-3 border border-line rounded-lg p-4 bg-card/40">
        <h3 className="font-mono text-[10px] text-mute uppercase tracking-wide">
          Sugestão (Granola / cola)
        </h3>
        <p className="text-sm text-mute">
          Cole linhas brutas; cada linha vira um item extra na pauta ao salvar (editável depois). O texto consolidado fica gravado na reunião.
        </p>
        <Field label="Colar agora" htmlFor="granola_paste">
          <textarea
            id="granola_paste"
            value={granolaPaste}
            onChange={(e) => setGranolaPaste(e.target.value)}
            disabled={busy}
            rows={4}
            className={textareaCn}
            placeholder="Uma linha por tópico..."
          />
        </Field>
        <Field
          label="Referência da fonte (opcional)"
          htmlFor="granola_source_ref"
          error={errors.granola_source_ref?.message}
        >
          <input
            id="granola_source_ref"
            type="text"
            {...register("granola_source_ref")}
            disabled={busy}
            placeholder="ex.: id da nota no Granola"
            className={inputCn}
          />
        </Field>
        <Field
          label="Texto consolidado (editável)"
          htmlFor="granola_suggestion_text"
          hint="Preenchido automaticamente ao colar linhas; pode editar antes de salvar."
          error={errors.granola_suggestion_text?.message}
        >
          <textarea
            id="granola_suggestion_text"
            {...register("granola_suggestion_text")}
            disabled={busy}
            rows={3}
            className={textareaCn}
          />
        </Field>
      </section>

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

function AttendeeGroup({
  title,
  persons,
  register,
  disabled,
}: {
  title: string;
  persons: AttendeeRef[];
  register: ReturnType<typeof useForm<MeetingFormClientInput>>["register"];
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
