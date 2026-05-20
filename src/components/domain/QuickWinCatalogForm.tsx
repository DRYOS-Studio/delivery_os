"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import {
  createQuickWinCatalogAction,
  updateQuickWinCatalogAction,
} from "@/lib/actions/quick-win-catalog";
import type { QuickWinCatalogRow } from "@/lib/db/queries/quick-win-catalog";
import type { VillainListItem } from "@/lib/db/queries/villains";
import {
  quickWinCatalogSchema,
  type QuickWinCatalogInput,
  type QuickWinCatalogOutput,
} from "@/lib/validators/quick-win-catalog";

type Props =
  | { mode: "create"; villains: VillainListItem[] }
  | {
      mode: "edit";
      initialData: QuickWinCatalogRow;
      villains: VillainListItem[];
    };

function mapErrorToFields(
  code: string | undefined,
  message: string,
  setError: ReturnType<typeof useForm<QuickWinCatalogInput>>["setError"],
  setGeneral: (m: string | null) => void,
): void {
  if (!code) return setGeneral(message);
  if (code === "title_conflict") {
    setError("title", { message });
    return;
  }
  if (code.startsWith("validation_")) {
    const field = code.replace(
      "validation_",
      "",
    ) as keyof QuickWinCatalogInput;
    setError(field, { message });
    return;
  }
  setGeneral(message);
}

export function QuickWinCatalogForm(props: Props): React.JSX.Element {
  const router = useRouter();
  const isEdit = props.mode === "edit";
  const [generalError, setGeneralError] = useState<string | null>(null);

  const defaultValues: QuickWinCatalogInput = isEdit
    ? {
        title: props.initialData.title,
        description: props.initialData.description ?? undefined,
        suggested_villain_id:
          props.initialData.suggested_villain_id ?? undefined,
        default_impact_pct:
          props.initialData.default_impact_pct ?? undefined,
      }
    : {
        title: "",
        description: undefined,
        suggested_villain_id: undefined,
        default_impact_pct: undefined,
      };

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<QuickWinCatalogInput, undefined, QuickWinCatalogOutput>({
    resolver: zodResolver(quickWinCatalogSchema),
    defaultValues,
  });

  async function onSubmit(data: QuickWinCatalogOutput) {
    setGeneralError(null);
    const fd = new FormData();
    fd.set("title", data.title);
    fd.set("description", data.description ?? "");
    fd.set("suggested_villain_id", data.suggested_villain_id ?? "");
    fd.set(
      "default_impact_pct",
      data.default_impact_pct != null ? String(data.default_impact_pct) : "",
    );

    const result = isEdit
      ? await updateQuickWinCatalogAction(props.initialData.id, fd)
      : await createQuickWinCatalogAction(fd);

    if (result.ok) {
      router.push("/catalog/quick-wins");
      router.refresh();
      return;
    }
    mapErrorToFields(result.code, result.error, setError, setGeneralError);
  }

  const activeVillains = props.villains.filter((v) => v.archivedAt === null);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-2xl">
      {generalError && (
        <div className="bg-critical-bg border border-critical text-critical text-sm rounded px-3 py-2">
          {generalError}
        </div>
      )}

      <Field
        label="Título"
        htmlFor="title"
        required
        error={errors.title?.message}
      >
        <input
          id="title"
          type="text"
          {...register("title")}
          maxLength={120}
          disabled={isSubmitting}
          className={inputCn}
        />
      </Field>

      <Field
        label="Descrição"
        htmlFor="description"
        error={errors.description?.message}
        hint="Opcional. Aparece no card e no form de QW da Operação. Máx 2000 chars."
      >
        <textarea
          id="description"
          rows={4}
          {...register("description")}
          disabled={isSubmitting}
          className={textareaCn}
        />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field
          label="Vilão sugerido"
          htmlFor="suggested_villain_id"
          error={errors.suggested_villain_id?.message}
          hint="Opcional. Vilão tipicamente atacado por este tipo de QW."
        >
          <select
            id="suggested_villain_id"
            {...register("suggested_villain_id")}
            disabled={isSubmitting}
            className={inputCn}
          >
            <option value="">— sem sugestão —</option>
            {activeVillains.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Impacto sugerido (%)"
          htmlFor="default_impact_pct"
          error={errors.default_impact_pct?.message}
          hint="Opcional. 1-100. Pré-preenche o impacto quando QW é criada via catálogo."
        >
          <input
            id="default_impact_pct"
            type="number"
            min={1}
            max={100}
            step={1}
            {...register("default_impact_pct")}
            disabled={isSubmitting}
            className={inputCn}
          />
        </Field>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : isEdit ? "Salvar" : "Criar tipo"}
        </Button>
        <Link href="/catalog/quick-wins">
          <Button variant="ghost" type="button">
            Cancelar
          </Button>
        </Link>
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
