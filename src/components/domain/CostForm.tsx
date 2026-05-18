"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { DeleteCostButton } from "@/components/domain/DeleteCostButton";
import {
  createOperationCostAction,
  updateOperationCostAction,
} from "@/lib/actions/operationCosts";
import type { OperationCostRow } from "@/lib/db/queries/operation-costs";

type Props = (
  | { mode: "create"; operationId: string }
  | {
      mode: "edit";
      operationId: string;
      initialData: OperationCostRow;
    }
) & { isAdmin: boolean };

type FormShape = {
  label: string;
  amount: string;
  recurrence: "mensal" | "unica";
  started_at: string;
  ended_at: string;
  notes: string;
};

const RECURRENCE_OPTIONS = [
  { value: "mensal", label: "Mensal (recorrente)" },
  { value: "unica", label: "Única (pontual)" },
] as const;

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function CostForm(props: Props): React.JSX.Element {
  const router = useRouter();
  const isEdit = props.mode === "edit";
  const [generalError, setGeneralError] = useState<string | null>(null);

  const defaultValues: FormShape = isEdit
    ? {
        label: props.initialData.label,
        amount: String(props.initialData.amount),
        recurrence: props.initialData.recurrence,
        started_at: props.initialData.startedAt,
        ended_at: props.initialData.endedAt ?? "",
        notes: props.initialData.notes ?? "",
      }
    : {
        label: "",
        amount: "",
        recurrence: "mensal",
        started_at: todayISO(),
        ended_at: "",
        notes: "",
      };

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormShape>({ defaultValues });

  async function onSubmit(values: FormShape) {
    setGeneralError(null);
    const fd = new FormData();
    fd.set("label", values.label);
    fd.set("amount", values.amount);
    fd.set("recurrence", values.recurrence);
    fd.set("started_at", values.started_at);
    fd.set("ended_at", values.ended_at);
    fd.set("notes", values.notes);

    const result = isEdit
      ? await updateOperationCostAction(props.initialData.id, fd)
      : await createOperationCostAction(props.operationId, fd);

    if (result.ok) {
      router.push(`/operations/${props.operationId}?tab=custos`);
      router.refresh();
      return;
    }
    if (result.code?.startsWith("validation_")) {
      const field = result.code.replace("validation_", "") as keyof FormShape;
      setError(field, { message: result.error });
    } else {
      setGeneralError(result.error);
    }
  }

  const cancelHref = `/operations/${props.operationId}?tab=custos`;

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

      <Field label="Descrição" htmlFor="label" required error={errors.label?.message}>
        <input
          id="label"
          type="text"
          {...register("label")}
          maxLength={150}
          disabled={isSubmitting}
          placeholder="Ex: Licença Figma, hospedagem, freelancer Maria"
          className={inputCn}
        />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field
          label="Valor (R$)"
          htmlFor="amount"
          required
          error={errors.amount?.message}
        >
          <input
            id="amount"
            type="text"
            inputMode="decimal"
            {...register("amount")}
            disabled={isSubmitting}
            placeholder="1000.00"
            className={inputCn}
          />
        </Field>

        <Field
          label="Recorrência"
          htmlFor="recurrence"
          required
          error={errors.recurrence?.message}
        >
          <select
            id="recurrence"
            {...register("recurrence")}
            disabled={isSubmitting}
            className={inputCn}
          >
            {RECURRENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field
          label="Início"
          htmlFor="started_at"
          required
          error={errors.started_at?.message}
        >
          <input
            id="started_at"
            type="date"
            {...register("started_at")}
            disabled={isSubmitting}
            className={inputCn}
          />
        </Field>

        <Field
          label="Fim"
          htmlFor="ended_at"
          error={errors.ended_at?.message}
          hint="Opcional. Vazio = ativo até cancelar."
        >
          <input
            id="ended_at"
            type="date"
            {...register("ended_at")}
            disabled={isSubmitting}
            className={inputCn}
          />
        </Field>
      </div>

      <Field label="Notas" htmlFor="notes" error={errors.notes?.message}>
        <textarea
          id="notes"
          {...register("notes")}
          rows={3}
          maxLength={1000}
          disabled={isSubmitting}
          className={`${inputCn} resize-y`}
        />
      </Field>

      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? "Salvando..." : isEdit ? "Salvar" : "Criar custo"}
          </Button>
          <Link href={cancelHref}>
            <Button variant="ghost" type="button">
              Cancelar
            </Button>
          </Link>
        </div>
        {isEdit && props.isAdmin && (
          <DeleteCostButton
            costId={props.initialData.id}
            label={props.initialData.label}
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
