"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import {
  createServiceProductAction,
  updateServiceProductAction,
} from "@/lib/actions/service-products";
import type { ServiceProductRow } from "@/lib/db/queries/service-products";
import {
  CATALOG_GROUP_LABELS,
  CATALOG_KIND_LABELS,
  CATALOG_OFFER_GROUPS,
  CATALOG_OFFER_KINDS,
} from "@/lib/catalog/catalog-offer";
import {
  CYCLE_TYPE_VALUES,
  formatCycleTypeLong,
} from "@/lib/utils/cycle-type";
import { slugify } from "@/lib/utils/slug";
import {
  serviceProductSchema,
  type ServiceProductInput,
  type ServiceProductOutput,
} from "@/lib/validators/service-product";

type Props =
  | { mode: "create" }
  | { mode: "edit"; initialData: ServiceProductRow };

function mapErrorToFields(
  code: string | undefined,
  message: string,
  setError: ReturnType<typeof useForm<ServiceProductInput>>["setError"],
  setGeneral: (m: string | null) => void,
): void {
  if (!code) return setGeneral(message);
  if (code === "slug_conflict") {
    setError("slug", { message });
    return;
  }
  if (code.startsWith("validation_")) {
    const field = code.replace("validation_", "") as keyof ServiceProductInput;
    setError(field, { message });
    return;
  }
  setGeneral(message);
}

export function ProductForm(props: Props): React.JSX.Element {
  const router = useRouter();
  const isEdit = props.mode === "edit";
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSlugDirty, setIsSlugDirty] = useState(isEdit);

  const defaultValues: ServiceProductInput = isEdit
    ? {
        name: props.initialData.name,
        slug: props.initialData.slug,
        description: props.initialData.description ?? undefined,
        default_cycle_type: props.initialData.default_cycle_type ?? undefined,
        catalog_group: props.initialData.catalog_group ?? undefined,
        catalog_kind: props.initialData.catalog_kind ?? undefined,
        content_ref: props.initialData.content_ref ?? undefined,
        sort_order: props.initialData.sort_order ?? undefined,
      }
    : {
        name: "",
        slug: "",
        description: undefined,
        default_cycle_type: undefined,
        catalog_group: undefined,
        catalog_kind: "product",
        content_ref: undefined,
        sort_order: undefined,
      };

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ServiceProductInput, undefined, ServiceProductOutput>({
    resolver: zodResolver(serviceProductSchema),
    defaultValues,
  });

  const watchedName = watch("name");

  useEffect(() => {
    if (isSlugDirty) return;
    const next = slugify(watchedName ?? "");
    setValue("slug", next, { shouldValidate: false });
  }, [watchedName, isSlugDirty, setValue]);

  async function onSubmit(data: ServiceProductOutput) {
    setGeneralError(null);
    const fd = new FormData();
    fd.set("name", data.name);
    fd.set("slug", data.slug);
    fd.set("description", data.description ?? "");
    fd.set("default_cycle_type", data.default_cycle_type ?? "");
    fd.set("catalog_group", data.catalog_group ?? "");
    fd.set("catalog_kind", data.catalog_kind ?? "product");
    fd.set("content_ref", data.content_ref ?? "");
    fd.set(
      "sort_order",
      data.sort_order !== undefined ? String(data.sort_order) : "",
    );

    const result = isEdit
      ? await updateServiceProductAction(props.initialData.id, fd)
      : await createServiceProductAction(fd);

    if (result.ok) {
      router.push("/catalog/products");
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
        <Field
          label="Nome"
          htmlFor="name"
          required
          error={errors.name?.message}
        >
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
          hint={isSlugDirty ? "Editado manualmente" : "Derivado do nome"}
        >
          <input
            id="slug"
            type="text"
            {...register("slug", {
              onChange: () => setIsSlugDirty(true),
            })}
            disabled={isSubmitting}
            className={inputCn}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field
          label="Grupo (catálogo)"
          htmlFor="catalog_group"
          error={errors.catalog_group?.message}
          hint="Opcional. Alinha o card e o select da Frente ao grupo dryos-conteudo."
        >
          <select
            id="catalog_group"
            {...register("catalog_group")}
            disabled={isSubmitting}
            className={inputCn}
          >
            <option value="">— sem grupo —</option>
            {CATALOG_OFFER_GROUPS.map((g) => (
              <option key={g} value={g}>
                {CATALOG_GROUP_LABELS[g]}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Tipo no catálogo"
          htmlFor="catalog_kind"
          error={errors.catalog_kind?.message}
        >
          <select
            id="catalog_kind"
            {...register("catalog_kind")}
            disabled={isSubmitting}
            className={inputCn}
          >
            {CATALOG_OFFER_KINDS.map((k) => (
              <option key={k} value={k}>
                {CATALOG_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field
          label="Ordem no grupo"
          htmlFor="sort_order"
          error={errors.sort_order?.message}
          hint="Menor aparece primeiro dentro do grupo."
        >
          <input
            id="sort_order"
            type="number"
            min={0}
            max={32767}
            {...register("sort_order")}
            disabled={isSubmitting}
            className={inputCn}
          />
        </Field>

        <Field
          label="Ref. conteúdo"
          htmlFor="content_ref"
          error={errors.content_ref?.message}
          hint="Path no dryos-conteudo (sem URL completa)."
        >
          <input
            id="content_ref"
            type="text"
            {...register("content_ref")}
            disabled={isSubmitting}
            className={inputCn}
          />
        </Field>
      </div>

      <Field
        label="Ciclo padrão"
        htmlFor="default_cycle_type"
        error={errors.default_cycle_type?.message}
        hint="Quando este produto é escolhido na Frente, o tipo de ciclo é pré-preenchido com este valor."
      >
        <select
          id="default_cycle_type"
          {...register("default_cycle_type")}
          disabled={isSubmitting}
          className={inputCn}
        >
          <option value="">— sem ciclo padrão —</option>
          {CYCLE_TYPE_VALUES.map((v) => (
            <option key={v} value={v}>
              {formatCycleTypeLong(v)}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Descrição"
        htmlFor="description"
        error={errors.description?.message}
        hint="Opcional. Aparece no card do catálogo. Máx 1000 chars."
      >
        <textarea
          id="description"
          rows={4}
          {...register("description")}
          disabled={isSubmitting}
          className={textareaCn}
        />
      </Field>

      <div className="flex items-center gap-2 pt-2">
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : isEdit ? "Salvar" : "Criar produto"}
        </Button>
        <Link href="/catalog/products">
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
