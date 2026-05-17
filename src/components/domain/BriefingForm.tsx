"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { saveBriefingAction } from "@/lib/actions/briefings";
import { BRIEFING_SECTIONS } from "@/lib/constants/briefing";
import type { BriefingContent } from "@/lib/db/queries/briefings";
import {
  briefingSchema,
  type BriefingInput,
  type BriefingOutput,
} from "@/lib/validators/briefing";

type Props =
  | { mode: "create"; operationId: string }
  | { mode: "edit"; operationId: string; initialData: BriefingContent };

function mapErrorToFields(
  code: string | undefined,
  message: string,
  setError: ReturnType<typeof useForm<BriefingInput>>["setError"],
  setGeneral: (m: string | null) => void,
): void {
  if (!code) return setGeneral(message);
  if (code.startsWith("validation_")) {
    const field = code.replace("validation_", "") as keyof BriefingInput;
    setError(field, { message });
    return;
  }
  setGeneral(message);
}

export function BriefingForm(props: Props): React.JSX.Element {
  const router = useRouter();
  const [generalError, setGeneralError] = useState<string | null>(null);

  const defaultValues: BriefingInput =
    props.mode === "edit"
      ? {
          contexto: props.initialData.contexto ?? "",
          objetivos: props.initialData.objetivos ?? "",
          escopo_incluido: props.initialData.escopo_incluido ?? "",
          escopo_excluido: props.initialData.escopo_excluido ?? "",
          premissas: props.initialData.premissas ?? "",
          riscos: props.initialData.riscos ?? "",
          stakeholders: props.initialData.stakeholders ?? "",
          observacoes: props.initialData.observacoes ?? "",
        }
      : {
          contexto: "",
          objetivos: "",
          escopo_incluido: "",
          escopo_excluido: "",
          premissas: "",
          riscos: "",
          stakeholders: "",
          observacoes: "",
        };

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<BriefingInput, undefined, BriefingOutput>({
    resolver: zodResolver(briefingSchema),
    defaultValues,
  });

  async function onSubmit(data: BriefingOutput) {
    setGeneralError(null);
    const fd = new FormData();
    for (const section of BRIEFING_SECTIONS) {
      fd.set(section.key, data[section.key] ?? "");
    }
    const result = await saveBriefingAction(props.operationId, fd);
    if (result.ok) {
      router.push(`/operations/${result.data.operationId}/briefing`);
      router.refresh();
      return;
    }
    mapErrorToFields(result.code, result.error, setError, setGeneralError);
  }

  const cancelHref = `/operations/${props.operationId}/briefing`;

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-6 max-w-3xl"
    >
      {generalError && (
        <div className="bg-critical-bg border border-critical text-critical text-sm rounded px-3 py-2">
          {generalError}
        </div>
      )}

      {BRIEFING_SECTIONS.map((section) => (
        <Field
          key={section.key}
          label={section.label}
          htmlFor={section.key}
          hint={section.helper}
          error={errors[section.key]?.message}
        >
          <textarea
            id={section.key}
            {...register(section.key)}
            disabled={isSubmitting}
            rows={6}
            className={textareaCn}
            placeholder=""
          />
        </Field>
      ))}

      <div className="flex items-center gap-2 pt-2">
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting
            ? "Salvando..."
            : props.mode === "edit"
              ? "Salvar nova versão"
              : "Criar briefing"}
        </Button>
        <Link href={cancelHref}>
          <Button variant="ghost" type="button">
            Cancelar
          </Button>
        </Link>
      </div>
    </form>
  );
}

const textareaCn =
  "w-full bg-card border border-line rounded px-3 py-2 text-sm text-ink-soft placeholder:text-mute-soft focus:outline-none focus:border-line-strong disabled:opacity-50 disabled:cursor-not-allowed font-body leading-relaxed resize-y";

function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
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
      </label>
      {children}
      {hint && !error && (
        <p className="font-mono text-[10px] text-mute-soft">{hint}</p>
      )}
      {error && <p className="text-critical text-xs">{error}</p>}
    </div>
  );
}
