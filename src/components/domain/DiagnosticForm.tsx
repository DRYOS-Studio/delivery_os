"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { upsertDiagnosticAction } from "@/lib/actions/diagnostics";
import type { DiagnosticRow } from "@/lib/db/queries/diagnostics";
import {
  diagnosticSchema,
  type DiagnosticInput,
  type DiagnosticOutput,
} from "@/lib/validators/diagnostic";

type Props = {
  clientId: string;
  initialData: DiagnosticRow | null;
};

const PRODUCT_OPTIONS = [
  { value: "core", label: "Core" },
  { value: "spark", label: "Spark" },
  { value: "studio", label: "Studio" },
] as const;

export function DiagnosticForm({
  clientId,
  initialData,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [generalError, setGeneralError] = useState<string | null>(null);

  const defaultValues: DiagnosticInput = {
    notes: initialData?.notes ?? "",
    recommended_product: initialData?.recommended_product ?? undefined,
    conducted_at: initialData?.conducted_at ?? undefined,
  };

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DiagnosticInput, undefined, DiagnosticOutput>({
    resolver: zodResolver(diagnosticSchema),
    defaultValues,
  });

  async function onSubmit(data: DiagnosticOutput) {
    setGeneralError(null);
    const fd = new FormData();
    fd.set("notes", data.notes);
    fd.set("recommended_product", data.recommended_product ?? "");
    fd.set("conducted_at", data.conducted_at ?? "");
    const result = await upsertDiagnosticAction(clientId, fd);
    if (result.ok) {
      router.push(`/clients/${clientId}`);
      router.refresh();
      return;
    }
    if (result.code?.startsWith("validation_")) {
      const field = result.code.replace("validation_", "") as keyof DiagnosticInput;
      setError(field, { message: result.error });
    } else {
      setGeneralError(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-2xl">
      {generalError && (
        <div className="bg-critical-bg border border-critical text-critical text-sm rounded px-3 py-2">
          {generalError}
        </div>
      )}

      <Field
        label="Notas do diagnóstico"
        htmlFor="notes"
        required
        error={errors.notes?.message}
        hint="Vilões detectados, evidências, contexto. Mínimo 10 caracteres."
      >
        <textarea
          id="notes"
          {...register("notes")}
          disabled={isSubmitting}
          rows={10}
          className={textareaCn}
        />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field
          label="Produto recomendado"
          htmlFor="recommended_product"
          error={errors.recommended_product?.message}
        >
          <select
            id="recommended_product"
            {...register("recommended_product")}
            disabled={isSubmitting}
            className={inputCn}
          >
            <option value="">—</option>
            {PRODUCT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Conduzido em"
          htmlFor="conducted_at"
          error={errors.conducted_at?.message}
        >
          <input
            id="conducted_at"
            type="date"
            {...register("conducted_at")}
            disabled={isSubmitting}
            className={inputCn}
          />
        </Field>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : "Salvar"}
        </Button>
        <Link href={`/clients/${clientId}`}>
          <Button variant="ghost" type="button">
            Cancelar
          </Button>
        </Link>
      </div>
    </form>
  );
}

const inputCn =
  "w-full bg-card border border-line rounded px-3 py-2 text-sm text-ink-soft placeholder:text-mute-soft focus:outline-none focus:border-line-strong disabled:opacity-50";

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
