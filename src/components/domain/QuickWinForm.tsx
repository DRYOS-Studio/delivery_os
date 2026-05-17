"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import {
  createQuickWinAction,
  updateQuickWinAction,
} from "@/lib/actions/quick-wins";
import type { OperationVillainListItem } from "@/lib/db/queries/operation-villains";
import type { QuickWinListItem } from "@/lib/db/queries/quick-wins";
import {
  quickWinSchema,
  type QuickWinInput,
  type QuickWinOutput,
} from "@/lib/validators/quick-win";

type Props =
  | {
      mode: "create";
      operationId: string;
      operationVillains: OperationVillainListItem[];
      operationFrentes: Array<{ id: string; name: string }>;
      onClose: () => void;
    }
  | {
      mode: "edit";
      operationId: string;
      initialData: QuickWinListItem;
      operationVillains: OperationVillainListItem[];
      operationFrentes: Array<{ id: string; name: string }>;
      onClose: () => void;
    };

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function QuickWinForm(props: Props): React.JSX.Element {
  const router = useRouter();
  const isEdit = props.mode === "edit";
  const [generalError, setGeneralError] = useState<string | null>(null);

  const defaultValues: QuickWinInput = isEdit
    ? {
        title: props.initialData.title,
        description: props.initialData.description ?? "",
        happened_at: props.initialData.happenedAt,
        frente_id: props.initialData.frenteId ?? undefined,
        impacts: props.initialData.impacts.map((imp) => ({
          operation_villain_id: imp.operationVillainId,
          impact_pct: imp.impactPct,
        })),
      }
    : {
        title: "",
        description: "",
        happened_at: todayISO(),
        frente_id: undefined,
        impacts: [],
      };

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<QuickWinInput, undefined, QuickWinOutput>({
    resolver: zodResolver(quickWinSchema),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "impacts",
  });

  async function onSubmit(data: QuickWinOutput) {
    setGeneralError(null);
    const fd = new FormData();
    fd.set("title", data.title);
    fd.set("description", data.description ?? "");
    fd.set("happened_at", data.happened_at);
    fd.set("frente_id", data.frente_id ?? "");
    fd.set("impacts", JSON.stringify(data.impacts));

    const result = isEdit
      ? await updateQuickWinAction(props.initialData.id, fd)
      : await createQuickWinAction(props.operationId, fd);

    if (result.ok) {
      router.refresh();
      props.onClose();
      return;
    }
    if (result.code?.startsWith("validation_")) {
      const field = result.code.replace("validation_", "") as keyof QuickWinInput;
      setError(field, { message: result.error });
    } else {
      setGeneralError(result.error);
    }
  }

  // Lista de vilões já em uso pelos outros impacts (impede duplicar)
  const usedOvIds = new Set(fields.map((f) => f.operation_villain_id));

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="bg-card border border-line rounded p-4 space-y-3"
    >
      {generalError && (
        <div className="bg-critical-bg border border-critical text-critical text-xs rounded px-3 py-2">
          {generalError}
        </div>
      )}

      <Field label="Título" htmlFor="title" required error={errors.title?.message}>
        <input
          id="title"
          type="text"
          {...register("title")}
          disabled={isSubmitting}
          placeholder="Ex: Automatizou captura de leads WhatsApp"
          className={inputCn}
        />
      </Field>

      <Field
        label="Descrição"
        htmlFor="description"
        error={errors.description?.message}
        hint="O que foi feito e por que importa."
      >
        <textarea
          id="description"
          {...register("description")}
          disabled={isSubmitting}
          rows={3}
          className={textareaCn}
        />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field
          label="Aconteceu em"
          htmlFor="happened_at"
          required
          error={errors.happened_at?.message}
        >
          <input
            id="happened_at"
            type="date"
            {...register("happened_at")}
            disabled={isSubmitting}
            className={inputCn}
          />
        </Field>

        <Field
          label="Frente"
          htmlFor="frente_id"
          error={errors.frente_id?.message}
          hint="Opcional."
        >
          <select
            id="frente_id"
            {...register("frente_id")}
            disabled={isSubmitting}
            className={inputCn}
          >
            <option value="">— Sem Frente associada —</option>
            {props.operationFrentes.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <fieldset className="space-y-2">
        <legend className="font-mono text-[10px] text-mute uppercase tracking-wide">
          Impactos em vilões
        </legend>
        <p className="font-mono text-[10px] text-mute-soft">
          Soma de impactos por vilão capped 100% (Inv. 08).
        </p>

        {props.operationVillains.length === 0 && (
          <p className="text-sm text-mute italic">
            Atribua vilões à Operação antes de registrar impactos.
          </p>
        )}

        {fields.map((field, idx) => {
          const villainErr =
            errors.impacts?.[idx]?.operation_villain_id?.message;
          const pctErr = errors.impacts?.[idx]?.impact_pct?.message;
          return (
            <div
              key={field.id}
              className="flex items-start gap-2"
            >
              <select
                {...register(`impacts.${idx}.operation_villain_id` as const)}
                disabled={isSubmitting}
                className={`${inputCn} flex-1`}
              >
                <option value="">—</option>
                {props.operationVillains.map((ov) => (
                  <option
                    key={ov.id}
                    value={ov.id}
                    disabled={
                      ov.id !== field.operation_villain_id &&
                      usedOvIds.has(ov.id)
                    }
                  >
                    {ov.villain.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                max={100}
                step={1}
                placeholder="%"
                {...register(`impacts.${idx}.impact_pct` as const)}
                disabled={isSubmitting}
                className={`${inputCn} w-20`}
              />
              <button
                type="button"
                onClick={() => remove(idx)}
                disabled={isSubmitting}
                className="text-mute hover:text-critical disabled:opacity-50 p-2"
                title="Remover impacto"
              >
                <X className="w-4 h-4" strokeWidth={1.75} />
              </button>
              {(villainErr || pctErr) && (
                <p className="text-critical text-xs">
                  {villainErr ?? pctErr}
                </p>
              )}
            </div>
          );
        })}

        {props.operationVillains.length > 0 && fields.length < 7 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              append({ operation_villain_id: "", impact_pct: 5 })
            }
            disabled={isSubmitting}
            className="inline-flex items-center gap-1"
          >
            <Plus className="w-3 h-3" strokeWidth={1.75} />
            Adicionar impacto
          </Button>
        )}

        {errors.impacts && typeof errors.impacts.message === "string" && (
          <p className="text-critical text-xs">{errors.impacts.message}</p>
        )}
      </fieldset>

      <div className="flex items-center gap-2 pt-2">
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting
            ? "Salvando..."
            : isEdit
              ? "Salvar"
              : "Registrar conquista"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={props.onClose}
          disabled={isSubmitting}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}

const inputCn =
  "w-full bg-bg border border-line rounded px-3 py-1.5 text-sm text-ink-soft placeholder:text-mute-soft focus:outline-none focus:border-line-strong disabled:opacity-50";

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
