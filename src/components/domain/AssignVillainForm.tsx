"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { assignVillainAction } from "@/lib/actions/operation-villains";
import type { AvailableVillain } from "@/lib/db/queries/operation-villains";
import {
  assignVillainSchema,
  type AssignVillainInput,
  type AssignVillainOutput,
} from "@/lib/validators/operation-villain";

type Props = {
  operationId: string;
  availableVillains: AvailableVillain[];
};

const SEVERITY_OPTIONS = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
  { value: "critical", label: "Crítica" },
] as const;

function mapErrorToFields(
  code: string | undefined,
  message: string,
  setError: ReturnType<typeof useForm<AssignVillainInput>>["setError"],
  setGeneral: (m: string | null) => void,
): void {
  if (!code) return setGeneral(message);
  if (code.startsWith("validation_")) {
    const field = code.replace("validation_", "") as keyof AssignVillainInput;
    setError(field, { message });
    return;
  }
  if (code === "already_assigned") {
    setError("villain_id", { message });
    return;
  }
  setGeneral(message);
}

export function AssignVillainForm({
  operationId,
  availableVillains,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AssignVillainInput, undefined, AssignVillainOutput>({
    resolver: zodResolver(assignVillainSchema),
    defaultValues: {
      villain_id: "",
      initial_severity: "medium",
      progress_pct: 0,
      evidence: "",
    },
  });

  async function onSubmit(data: AssignVillainOutput) {
    setGeneralError(null);
    const fd = new FormData();
    fd.set("villain_id", data.villain_id);
    fd.set("initial_severity", data.initial_severity);
    fd.set("progress_pct", String(data.progress_pct));
    fd.set("evidence", data.evidence ?? "");
    const result = await assignVillainAction(operationId, fd);
    if (result.ok) {
      reset();
      setOpen(false);
      router.refresh();
      return;
    }
    mapErrorToFields(result.code, result.error, setError, setGeneralError);
  }

  if (availableVillains.length === 0) {
    return (
      <p className="text-sm text-mute italic">
        Todos os vilões ativos já estão atribuídos a esta Operação.
      </p>
    );
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="sage"
        size="sm"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5"
      >
        <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
        Atribuir vilão
      </Button>
    );
  }

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field
          label="Vilão"
          htmlFor="villain_id"
          required
          error={errors.villain_id?.message}
        >
          <select
            id="villain_id"
            {...register("villain_id")}
            disabled={isSubmitting}
            className={inputCn}
          >
            <option value="">—</option>
            {availableVillains.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Severidade inicial"
          htmlFor="initial_severity"
          required
          error={errors.initial_severity?.message}
          hint="Write-once (Inv. 07). Não muda depois."
        >
          <select
            id="initial_severity"
            {...register("initial_severity")}
            disabled={isSubmitting}
            className={inputCn}
          >
            {SEVERITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field
        label="Progresso inicial (%)"
        htmlFor="progress_pct"
        error={errors.progress_pct?.message}
        hint="0 se ainda não há progresso."
      >
        <input
          id="progress_pct"
          type="number"
          min={0}
          max={100}
          step={1}
          {...register("progress_pct")}
          disabled={isSubmitting}
          className={inputCn}
        />
      </Field>

      <Field
        label="Evidência (opcional)"
        htmlFor="evidence"
        error={errors.evidence?.message}
        hint="O que motivou identificar esse vilão na Operação."
      >
        <textarea
          id="evidence"
          {...register("evidence")}
          disabled={isSubmitting}
          rows={3}
          className={textareaCn}
        />
      </Field>

      <div className="flex items-center gap-2">
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? "Atribuindo..." : "Atribuir"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={isSubmitting}
          onClick={() => {
            reset();
            setOpen(false);
            setGeneralError(null);
          }}
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
