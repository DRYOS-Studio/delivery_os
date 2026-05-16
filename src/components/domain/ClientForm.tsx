"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import {
  archiveClientAction,
  createClientAction,
  updateClientAction,
} from "@/lib/actions/clients";
import type { ClientDetail } from "@/lib/db/queries/clients";
import { slugify } from "@/lib/utils/slug";
import {
  clientSchema,
  type ClientInput,
  type ClientOutput,
} from "@/lib/validators/client";

type Props =
  | { mode: "create" }
  | {
      mode: "edit";
      initialData: ClientDetail;
      canChangeSlug: boolean;
      canArchive: boolean;
    };

export function ClientForm(props: Props): React.JSX.Element {
  const router = useRouter();
  const isEdit = props.mode === "edit";
  const [isPending, startTransition] = useTransition();
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(isEdit);

  const defaultValues: ClientInput = isEdit
    ? {
        name: props.initialData.name,
        slug: props.initialData.slug,
        notes: props.initialData.notes ?? undefined,
      }
    : { name: "", slug: "", notes: undefined };

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    formState: { errors },
  } = useForm<ClientInput, undefined, ClientOutput>({
    resolver: zodResolver(clientSchema),
    defaultValues,
  });

  const slugDisabled = isEdit && !props.canChangeSlug;
  const watchedName = watch("name");

  useEffect(() => {
    if (slugTouched || slugDisabled) return;
    setValue("slug", slugify(watchedName ?? ""), { shouldDirty: true });
  }, [watchedName, slugTouched, slugDisabled, setValue]);

  function onSubmit(data: ClientOutput) {
    startTransition(async () => {
      setGeneralError(null);
      const fd = new FormData();
      fd.set("name", data.name);
      fd.set("slug", data.slug);
      fd.set("notes", data.notes ?? "");

      const result = isEdit
        ? await updateClientAction(props.initialData.id, fd)
        : await createClientAction(fd);

      if (result.ok) {
        const id = isEdit ? props.initialData.id : result.data.id;
        router.push(`/clients/${id}`);
        router.refresh();
        return;
      }
      const code = result.code;
      if (code === "slug_taken" || code === "slug_locked" || code === "validation_slug") {
        setError("slug", { message: result.error });
      } else if (code === "validation_name") {
        setError("name", { message: result.error });
      } else if (code === "validation_notes") {
        setError("notes", { message: result.error });
      } else {
        setGeneralError(result.error);
      }
    });
  }

  function handleArchive() {
    if (!isEdit || !props.canArchive) return;
    if (!window.confirm("Arquivar este Cliente?")) return;
    startTransition(async () => {
      setGeneralError(null);
      const result = await archiveClientAction(props.initialData.id);
      if (result.ok) {
        router.push("/clients");
        router.refresh();
      } else {
        setGeneralError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-xl">
      {generalError && (
        <div className="bg-critical-bg border border-critical text-critical text-sm rounded px-3 py-2">
          {generalError}
        </div>
      )}

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
          maxLength={120}
          disabled={isPending}
          autoFocus={!isEdit}
          className={inputCn}
        />
      </Field>

      <Field
        label="Slug"
        htmlFor="slug"
        required
        error={errors.slug?.message}
        hint={
          slugDisabled
            ? "Slug não pode mudar enquanto houver Operações ativas."
            : "minúsculas, números e hífens"
        }
      >
        <input
          id="slug"
          type="text"
          {...register("slug", {
            onChange: () => setSlugTouched(true),
          })}
          maxLength={60}
          disabled={isPending || slugDisabled}
          className={inputCn}
        />
      </Field>

      <Field label="Notas" htmlFor="notes" error={errors.notes?.message}>
        <textarea
          id="notes"
          {...register("notes")}
          maxLength={1000}
          rows={4}
          disabled={isPending}
          className={`${inputCn} resize-y`}
        />
      </Field>

      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <Button type="submit" variant="primary" disabled={isPending}>
            {isPending ? "Salvando..." : isEdit ? "Salvar" : "Criar cliente"}
          </Button>
          <Link href={isEdit ? `/clients/${props.initialData.id}` : "/clients"}>
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
            disabled={isPending}
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
