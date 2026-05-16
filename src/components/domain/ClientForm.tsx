"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import {
  archiveClientAction,
  createClientAction,
  updateClientAction,
} from "@/lib/actions/clients";
import type { ClientDetail } from "@/lib/db/queries/clients";
import { slugify } from "@/lib/utils/slug";

type ClientFormProps =
  | { mode: "create" }
  | {
      mode: "edit";
      initialData: ClientDetail;
      canChangeSlug: boolean;
      canArchive: boolean;
    };

type FieldErrors = {
  name?: string;
  slug?: string;
  notes?: string;
  general?: string;
};

function mapErrorCode(code: string | undefined, message: string): FieldErrors {
  if (!code) return { general: message };
  if (code === "validation_name") return { name: message };
  if (code === "validation_slug" || code === "slug_taken" || code === "slug_locked")
    return { slug: message };
  if (code === "validation_notes") return { notes: message };
  return { general: message };
}

export function ClientForm(props: ClientFormProps): React.JSX.Element {
  const router = useRouter();
  const isEdit = props.mode === "edit";

  const [name, setName] = useState(isEdit ? props.initialData.name : "");
  const [slug, setSlug] = useState(isEdit ? props.initialData.slug : "");
  const [notes, setNotes] = useState(
    isEdit ? (props.initialData.notes ?? "") : "",
  );
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isPending, startTransition] = useTransition();
  const [isArchiving, setIsArchiving] = useState(false);

  const slugDisabled = isEdit && !props.canChangeSlug;

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched && !slugDisabled) {
      setSlug(slugify(value));
    }
  }

  function handleSlugChange(value: string) {
    setSlug(value);
    setSlugTouched(true);
  }

  function handleSubmit(formData: FormData): void {
    setErrors({});
    startTransition(async () => {
      const result = isEdit
        ? await updateClientAction(props.initialData.id, formData)
        : await createClientAction(formData);
      if (result.ok) {
        const id = isEdit ? props.initialData.id : result.data.id;
        router.push(`/clients/${id}`);
        router.refresh();
      } else {
        setErrors(mapErrorCode(result.code, result.error));
      }
    });
  }

  function handleArchive() {
    if (!isEdit || !props.canArchive) return;
    if (!window.confirm("Arquivar este Cliente?")) return;
    setIsArchiving(true);
    setErrors({});
    startTransition(async () => {
      const result = await archiveClientAction(props.initialData.id);
      if (result.ok) {
        router.push("/clients");
        router.refresh();
      } else {
        setErrors({ general: result.error });
        setIsArchiving(false);
      }
    });
  }

  const submitting = isPending && !isArchiving;

  return (
    <form action={handleSubmit} className="space-y-4 max-w-xl">
      {errors.general && (
        <div className="bg-critical-bg border border-critical text-critical text-sm rounded px-3 py-2">
          {errors.general}
        </div>
      )}

      <Field
        label="Nome"
        htmlFor="name"
        error={errors.name}
        required
      >
        <input
          id="name"
          type="text"
          name="name"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          required
          maxLength={120}
          disabled={submitting}
          autoFocus={!isEdit}
          className={inputCn}
        />
      </Field>

      <Field
        label="Slug"
        htmlFor="slug"
        error={errors.slug}
        required
        hint={
          slugDisabled
            ? "Slug não pode mudar enquanto houver Operações ativas."
            : "minúsculas, números e hífens"
        }
      >
        <input
          id="slug"
          type="text"
          name="slug"
          value={slug}
          onChange={(e) => handleSlugChange(e.target.value)}
          required
          maxLength={60}
          pattern="^[a-z0-9-]+$"
          disabled={submitting || slugDisabled}
          className={inputCn}
        />
      </Field>

      <Field label="Notas" htmlFor="notes" error={errors.notes}>
        <textarea
          id="notes"
          name="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={1000}
          rows={4}
          disabled={submitting}
          className={`${inputCn} resize-y`}
        />
      </Field>

      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? "Salvando..." : isEdit ? "Salvar" : "Criar cliente"}
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
            disabled={submitting || isArchiving}
            className="text-critical hover:text-critical hover:bg-critical-bg"
          >
            {isArchiving ? "Arquivando..." : "Arquivar"}
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
