"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import {
  createAllocationAction,
  deleteAllocationAction,
  updateAllocationAction,
} from "@/lib/actions/allocations";
import type { AllocationRow } from "@/lib/db/queries/allocations";
import type { InternalPersonItem } from "@/lib/db/queries/persons";
import {
  allocationSchema,
  type AllocationInput,
  type AllocationOutput,
} from "@/lib/validators/allocation";

type Props = (
  | {
      mode: "create";
      operationId: string;
      frenteId: string;
      internalPersons: InternalPersonItem[];
    }
  | {
      mode: "edit";
      initialData: AllocationRow;
      operationId: string;
      frenteId: string;
      internalPersons: InternalPersonItem[];
    }
) & { isAdmin?: boolean };

const ROLE_OPTIONS: { value: AllocationOutput["role"]; label: string }[] = [
  { value: "responsavel", label: "Responsável" },
  { value: "executor", label: "Executor" },
  { value: "aprovador", label: "Aprovador" },
  { value: "plantao", label: "Plantão" },
];

function mapErrorToFields(
  code: string | undefined,
  message: string,
  setError: ReturnType<typeof useForm<AllocationInput>>["setError"],
  setGeneral: (m: string | null) => void,
): void {
  if (!code) return setGeneral(message);
  if (code.startsWith("validation_")) {
    const field = code.replace("validation_", "") as keyof AllocationInput;
    setError(field, { message });
    return;
  }
  if (code === "invalid_fk") {
    setError("person_id", { message });
    return;
  }
  setGeneral(message);
}

function todayBR(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function AllocationForm(props: Props): React.JSX.Element {
  const router = useRouter();
  const isEdit = props.mode === "edit";
  const isAdmin = props.isAdmin ?? false;
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const defaultValues: AllocationInput = isEdit
    ? {
        person_id: props.initialData.person_id,
        role: props.initialData.role,
        capacity_weekly_pct: Number(props.initialData.capacity_weekly_pct),
        weekly_hours:
          props.initialData.weekly_hours !== null &&
          props.initialData.weekly_hours !== undefined
            ? Number(props.initialData.weekly_hours)
            : null,
        monthly_cost:
          props.initialData.monthly_cost !== null &&
          props.initialData.monthly_cost !== undefined
            ? Number(props.initialData.monthly_cost)
            : null,
        start_date: props.initialData.start_date,
        end_date: props.initialData.end_date ?? undefined,
      }
    : {
        person_id: "",
        role: "executor",
        capacity_weekly_pct: 0,
        weekly_hours: null,
        monthly_cost: null,
        start_date: todayBR(),
        end_date: undefined,
      };

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AllocationInput, undefined, AllocationOutput>({
    resolver: zodResolver(allocationSchema),
    defaultValues,
  });

  const busy = isSubmitting || isDeleting;

  async function onSubmit(data: AllocationOutput) {
    setGeneralError(null);
    const fd = new FormData();
    fd.set("person_id", data.person_id);
    fd.set("role", data.role);
    fd.set("capacity_weekly_pct", String(data.capacity_weekly_pct));
    fd.set(
      "weekly_hours",
      data.weekly_hours !== null && data.weekly_hours !== undefined
        ? String(data.weekly_hours)
        : "",
    );
    fd.set(
      "monthly_cost",
      data.monthly_cost !== null && data.monthly_cost !== undefined
        ? String(data.monthly_cost)
        : "",
    );
    fd.set("start_date", data.start_date);
    fd.set("end_date", data.end_date ?? "");

    const result = isEdit
      ? await updateAllocationAction(props.initialData.id, fd)
      : await createAllocationAction(props.operationId, props.frenteId, fd);

    if (result.ok) {
      router.push(
        `/operations/${result.data.operationId}/frentes/${result.data.frenteId}/edit`,
      );
      router.refresh();
      return;
    }
    mapErrorToFields(result.code, result.error, setError, setGeneralError);
  }

  async function handleDelete() {
    if (!isEdit) return;
    if (!window.confirm("Remover esta alocação?")) return;
    setIsDeleting(true);
    setGeneralError(null);
    const result = await deleteAllocationAction(props.initialData.id);
    if (result.ok) {
      router.push(
        `/operations/${result.data.operationId}/frentes/${result.data.frenteId}/edit`,
      );
      router.refresh();
    } else {
      setGeneralError(result.error);
      setIsDeleting(false);
    }
  }

  const cancelHref = `/operations/${props.operationId}/frentes/${props.frenteId}/edit`;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-2xl">
      {generalError && (
        <div className="bg-critical-bg border border-critical text-critical text-sm rounded px-3 py-2">
          {generalError}
        </div>
      )}

      <Field
        label="Pessoa"
        htmlFor="person_id"
        required
        error={errors.person_id?.message}
        hint={isEdit ? "Pessoa não pode mudar. Pra trocar, crie nova alocação." : undefined}
      >
        <select
          id="person_id"
          {...register("person_id")}
          disabled={busy || isEdit || props.internalPersons.length === 0}
          className={inputCn}
        >
          <option value="">Selecione…</option>
          {props.internalPersons.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field
          label="Papel"
          htmlFor="role"
          required
          error={errors.role?.message}
        >
          <select
            id="role"
            {...register("role")}
            disabled={busy}
            className={inputCn}
          >
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Horas/semana alocadas"
          htmlFor="weekly_hours"
          error={errors.weekly_hours?.message}
          hint="Ex: 16h/sem. Usado se valor mensal fechado abaixo estiver vazio."
        >
          <input
            id="weekly_hours"
            type="number"
            step="0.5"
            min={0}
            {...register("weekly_hours")}
            disabled={busy}
            placeholder="16"
            className={inputCn}
          />
        </Field>
      </div>

      <Field
        label="Valor mensal fechado (R$)"
        htmlFor="monthly_cost"
        error={errors.monthly_cost?.message}
        hint="Custo mensal fechado direto. Quando preenchido, ignora cálculo por horas. Útil pra freelancer/contrato fechado."
      >
        <input
          id="monthly_cost"
          type="number"
          step="0.01"
          min={0}
          {...register("monthly_cost")}
          disabled={busy}
          placeholder="0.00"
          className={inputCn}
        />
      </Field>

      <Field
        label="Capacidade semanal (%) — legacy"
        htmlFor="capacity_weekly_pct"
        required
        error={errors.capacity_weekly_pct?.message}
        hint="0 a 100. Usado se horas/semana acima estiverem em branco."
      >
        <input
          id="capacity_weekly_pct"
          type="text"
          inputMode="decimal"
          {...register("capacity_weekly_pct")}
          disabled={busy}
          placeholder="40"
          className={inputCn}
        />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field
          label="Data de início"
          htmlFor="start_date"
          required
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
          hint="Vazio = aberto"
        >
          <input
            id="end_date"
            type="date"
            {...register("end_date")}
            disabled={busy}
            className={inputCn}
          />
        </Field>
      </div>

      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <Button type="submit" variant="primary" disabled={busy}>
            {isSubmitting ? "Salvando..." : isEdit ? "Salvar" : "Criar alocação"}
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
