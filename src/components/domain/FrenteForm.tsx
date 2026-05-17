"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { StalenessPill } from "@/components/ui/StalenessPill";
import {
  archiveFrenteAction,
  createFrenteAction,
  updateFrenteAction,
} from "@/lib/actions/frentes";
import type { FrenteRow } from "@/lib/db/queries/frentes";
import type { InternalPersonItem } from "@/lib/db/queries/persons";
import { daysSince } from "@/lib/utils/staleness";
import {
  frenteSchema,
  type FrenteInput,
  type FrenteOutput,
} from "@/lib/validators/frente";

type Props =
  | {
      mode: "create";
      operationId: string;
      internalPersons: InternalPersonItem[];
    }
  | {
      mode: "edit";
      initialData: FrenteRow;
      operationId: string;
      internalPersons: InternalPersonItem[];
      canArchive: boolean;
    };

const CYCLE_OPTIONS: { value: "a" | "b" | "c" | "d" | "e"; label: string }[] = [
  { value: "a", label: "A — Finito puro (Studio one-off)" },
  { value: "b", label: "B — Finito → recorrente" },
  { value: "c", label: "C — Contínuo (Core, Sparks)" },
  { value: "d", label: "D — Episódico recorrente (Launch)" },
  { value: "e", label: "E — Manutenção (Evergreen)" },
];

const DOMAIN_OPTIONS: { value: FrenteOutput["domain"]; label: string }[] = [
  { value: "infra", label: "Infra" },
  { value: "dados_analiticos", label: "Dados Analíticos" },
  { value: "dados_tecnicos", label: "Dados Técnicos" },
];

const PHASE_OPTIONS: { value: FrenteOutput["phase"]; label: string }[] = [
  { value: "descoberta", label: "Descoberta" },
  { value: "execucao", label: "Execução" },
  { value: "entrega", label: "Entrega" },
  { value: "encerrada", label: "Encerrada" },
];

function mapErrorToFields(
  code: string | undefined,
  message: string,
  setError: ReturnType<typeof useForm<FrenteInput>>["setError"],
  setGeneral: (m: string | null) => void,
): void {
  if (!code) return setGeneral(message);
  if (code.startsWith("validation_")) {
    const field = code.replace("validation_", "") as keyof FrenteInput;
    setError(field, { message });
    return;
  }
  setGeneral(message);
}

export function FrenteForm(props: Props): React.JSX.Element {
  const router = useRouter();
  const isEdit = props.mode === "edit";
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);

  const defaultValues: FrenteInput = isEdit
    ? {
        name: props.initialData.name,
        cycle_type: props.initialData.cycle_type,
        domain: props.initialData.domain,
        phase: props.initialData.phase,
        actionable_status: props.initialData.actionable_status,
        responsible_person_id:
          props.initialData.responsible_person_id ?? undefined,
        start_date: props.initialData.start_date ?? undefined,
        end_date: props.initialData.end_date ?? undefined,
      }
    : {
        name: "",
        cycle_type: "a",
        domain: "infra",
        phase: "descoberta",
        actionable_status: "",
        responsible_person_id: undefined,
        start_date: undefined,
        end_date: undefined,
      };

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FrenteInput, undefined, FrenteOutput>({
    resolver: zodResolver(frenteSchema),
    defaultValues,
  });

  const busy = isSubmitting || isArchiving;
  const watchedCycle = watch("cycle_type");
  const endDateDisabled =
    watchedCycle === "c" || watchedCycle === "e" || busy;
  const endDateHint =
    watchedCycle === "c" || watchedCycle === "e"
      ? `Ciclo ${watchedCycle.toUpperCase()} é contínuo — sem data de fim.`
      : undefined;

  // Quando cycle muda pra C/E, força end_date vazio (state stale poderia passar)
  useEffect(() => {
    if (watchedCycle === "c" || watchedCycle === "e") {
      setValue("end_date", undefined, { shouldValidate: false });
    }
  }, [watchedCycle, setValue]);

  async function onSubmit(data: FrenteOutput) {
    setGeneralError(null);
    const fd = new FormData();
    fd.set("name", data.name);
    fd.set("cycle_type", data.cycle_type);
    fd.set("domain", data.domain);
    fd.set("phase", data.phase);
    fd.set("actionable_status", data.actionable_status);
    fd.set("responsible_person_id", data.responsible_person_id ?? "");
    fd.set("start_date", data.start_date ?? "");
    fd.set("end_date", data.end_date ?? "");

    const result = isEdit
      ? await updateFrenteAction(props.initialData.id, fd)
      : await createFrenteAction(props.operationId, fd);

    if (result.ok) {
      router.push(`/operations/${result.data.operationId}`);
      router.refresh();
      return;
    }
    mapErrorToFields(result.code, result.error, setError, setGeneralError);
  }

  async function handleArchive() {
    if (!isEdit || !props.canArchive) return;
    if (!window.confirm("Arquivar esta Frente?")) return;
    setIsArchiving(true);
    setGeneralError(null);
    const result = await archiveFrenteAction(props.initialData.id);
    if (result.ok) {
      router.push(`/operations/${result.data.operationId}`);
      router.refresh();
    } else {
      setGeneralError(result.error);
      setIsArchiving(false);
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

      <Field label="Nome" htmlFor="name" required error={errors.name?.message}>
        <input
          id="name"
          type="text"
          {...register("name")}
          maxLength={120}
          disabled={busy}
          autoFocus={!isEdit}
          className={inputCn}
        />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field
          label="Tipo de ciclo"
          htmlFor="cycle_type"
          required
          error={errors.cycle_type?.message}
        >
          <select
            id="cycle_type"
            {...register("cycle_type")}
            disabled={busy}
            className={inputCn}
          >
            {CYCLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Domínio"
          htmlFor="domain"
          required
          error={errors.domain?.message}
        >
          <select
            id="domain"
            {...register("domain")}
            disabled={busy}
            className={inputCn}
          >
            {DOMAIN_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field
        label="Fase"
        htmlFor="phase"
        required
        error={errors.phase?.message}
      >
        <select
          id="phase"
          {...register("phase")}
          disabled={busy}
          className={inputCn}
        >
          {PHASE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Status acionável"
        htmlFor="actionable_status"
        required
        error={errors.actionable_status?.message}
        hint='Formato "aguardando X de Y desde Z". Mínimo 15 chars; sem genéricos ("em andamento", "pendente"...).'
        labelExtra={
          props.mode === "edit" ? (
            <span className="inline-flex items-center gap-2 font-mono text-[10px] text-mute normal-case tracking-normal">
              Atualizado há{" "}
              {daysSince(props.initialData.actionable_status_since)}d
              <StalenessPill
                since={props.initialData.actionable_status_since}
              />
            </span>
          ) : undefined
        }
      >
        <textarea
          id="actionable_status"
          {...register("actionable_status")}
          rows={3}
          disabled={busy}
          className={`${inputCn} resize-y`}
        />
      </Field>

      <Field
        label="Responsável"
        htmlFor="responsible_person_id"
        error={errors.responsible_person_id?.message}
        hint={
          props.internalPersons.length === 0
            ? "Crie Pessoas internas pra atribuir responsável."
            : undefined
        }
      >
        <select
          id="responsible_person_id"
          {...register("responsible_person_id")}
          disabled={busy || props.internalPersons.length === 0}
          className={inputCn}
        >
          <option value="">—</option>
          {props.internalPersons.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field
          label="Data de início"
          htmlFor="start_date"
          error={errors.start_date?.message}
        >
          <input
            id="start_date"
            type="date"
            {...register("start_date")}
            disabled={busy}
            className={inputCn}
          />
        </Field>

        <Field
          label="Data de fim"
          htmlFor="end_date"
          error={errors.end_date?.message}
          hint={endDateHint}
        >
          <input
            id="end_date"
            type="date"
            {...register("end_date")}
            disabled={endDateDisabled}
            className={inputCn}
          />
        </Field>
      </div>

      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <Button type="submit" variant="primary" disabled={busy}>
            {isSubmitting ? "Salvando..." : isEdit ? "Salvar" : "Criar Frente"}
          </Button>
          <Link href={cancelHref}>
            <Button variant="ghost" type="button">
              Cancelar
            </Button>
          </Link>
        </div>
        {isEdit && props.canArchive && (
          <Button
            type="button"
            variant="ghost"
            onClick={handleArchive}
            disabled={busy}
            className="text-critical hover:text-critical hover:bg-critical-bg"
          >
            Arquivar
          </Button>
        )}
      </div>
    </form>
  );
}

const inputCn =
  "w-full bg-card border border-line rounded px-3 py-2 text-sm text-ink-soft placeholder:text-mute-soft focus:outline-none focus:border-line-strong disabled:opacity-50 disabled:cursor-not-allowed";

function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
  labelExtra,
}: {
  label: string;
  htmlFor: string;
  required?: boolean | undefined;
  hint?: string | undefined;
  error?: string | undefined;
  children: React.ReactNode;
  labelExtra?: React.ReactNode | undefined;
}) {
  return (
    <div className="space-y-1">
      <label
        htmlFor={htmlFor}
        className="flex items-center justify-between gap-2 font-mono text-[10px] text-mute uppercase tracking-wide"
      >
        <span>
          {label}
          {required && <span className="text-critical ml-1">*</span>}
        </span>
        {labelExtra}
      </label>
      {children}
      {hint && !error && (
        <p className="font-mono text-[10px] text-mute-soft">{hint}</p>
      )}
      {error && <p className="text-critical text-xs">{error}</p>}
    </div>
  );
}
