"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { updateVillainAction } from "@/lib/actions/villains";
import { VILLAIN_ICON_NAMES } from "@/lib/constants/villain-icons";
import type { VillainRow } from "@/lib/db/queries/villains";
import {
  PILL_VARIANTS,
  villainSchema,
  type VillainInput,
  type VillainOutput,
} from "@/lib/validators/villain";

type Props = {
  initialData: VillainRow;
};

function mapErrorToFields(
  code: string | undefined,
  message: string,
  setError: ReturnType<typeof useForm<VillainInput>>["setError"],
  setGeneral: (m: string | null) => void,
): void {
  if (!code) return setGeneral(message);
  if (code.startsWith("validation_")) {
    const field = code.replace("validation_", "") as keyof VillainInput;
    setError(field, { message });
    return;
  }
  setGeneral(message);
}

export function VillainForm({ initialData }: Props): React.JSX.Element {
  const router = useRouter();
  const [generalError, setGeneralError] = useState<string | null>(null);

  const defaultValues: VillainInput = {
    name: initialData.name,
    slug: initialData.slug,
    quote: initialData.quote,
    description: initialData.description,
    icon_name: initialData.icon_name,
    pill_variant:
      initialData.pill_variant as VillainInput["pill_variant"],
    display_order: initialData.display_order,
  };

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<VillainInput, undefined, VillainOutput>({
    resolver: zodResolver(villainSchema),
    defaultValues,
  });

  async function onSubmit(data: VillainOutput) {
    setGeneralError(null);
    const fd = new FormData();
    fd.set("name", data.name);
    fd.set("slug", data.slug);
    fd.set("quote", data.quote);
    fd.set("description", data.description);
    fd.set("icon_name", data.icon_name);
    fd.set("pill_variant", data.pill_variant);
    fd.set("display_order", String(data.display_order));

    const result = await updateVillainAction(initialData.id, fd);
    if (result.ok) {
      router.push("/catalog");
      router.refresh();
      return;
    }
    mapErrorToFields(result.code, result.error, setError, setGeneralError);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-2xl">
      {generalError && (
        <div className="bg-critical-bg border border-critical text-critical text-sm rounded px-3 py-2">
          {generalError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Nome" htmlFor="name" required error={errors.name?.message}>
          <input
            id="name"
            type="text"
            {...register("name")}
            disabled={isSubmitting}
            className={inputCn}
          />
        </Field>

        <Field
          label="Slug"
          htmlFor="slug"
          required
          error={errors.slug?.message}
          hint="a-z, 0-9, hífen. Sem espaço."
        >
          <input
            id="slug"
            type="text"
            {...register("slug")}
            disabled={isSubmitting}
            className={inputCn}
          />
        </Field>
      </div>

      <Field
        label="Citação"
        htmlFor="quote"
        required
        error={errors.quote?.message}
        hint="Frase típica deste vilão (em 1ª pessoa)."
      >
        <input
          id="quote"
          type="text"
          {...register("quote")}
          disabled={isSubmitting}
          className={inputCn}
        />
      </Field>

      <Field
        label="Descrição"
        htmlFor="description"
        required
        error={errors.description?.message}
      >
        <textarea
          id="description"
          {...register("description")}
          disabled={isSubmitting}
          rows={4}
          className={textareaCn}
        />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field
          label="Ícone"
          htmlFor="icon_name"
          required
          error={errors.icon_name?.message}
        >
          <select
            id="icon_name"
            {...register("icon_name")}
            disabled={isSubmitting}
            className={inputCn}
          >
            {VILLAIN_ICON_NAMES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Variante"
          htmlFor="pill_variant"
          required
          error={errors.pill_variant?.message}
        >
          <select
            id="pill_variant"
            {...register("pill_variant")}
            disabled={isSubmitting}
            className={inputCn}
          >
            {PILL_VARIANTS.map((variant) => (
              <option key={variant} value={variant}>
                {variant}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Ordem"
          htmlFor="display_order"
          required
          error={errors.display_order?.message}
          hint="1-99 (UNIQUE)."
        >
          <input
            id="display_order"
            type="number"
            min={1}
            max={99}
            step={1}
            {...register("display_order")}
            disabled={isSubmitting}
            className={inputCn}
          />
        </Field>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : "Salvar"}
        </Button>
        <Link href="/catalog">
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
