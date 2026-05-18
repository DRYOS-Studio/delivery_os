"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import {
  archiveClientAction,
  createClientAction,
  updateClientAction,
} from "@/lib/actions/clients";
import type { ClientDetail } from "@/lib/db/queries/clients";
import {
  applyCepMask,
  applyCnpjMask,
  formatCep,
  formatCnpj,
  stripDigits,
} from "@/lib/utils/mask";
import { slugify } from "@/lib/utils/slug";
import { UFS } from "@/lib/utils/ufs";
import {
  clientSchema,
  type ClientInput,
  type ClientOutput,
} from "@/lib/validators/client";

type Props = (
  | { mode: "create" }
  | {
      mode: "edit";
      initialData: ClientDetail;
      canChangeSlug: boolean;
      canArchive: boolean;
    }
) & { isAdmin?: boolean };

const ERROR_TO_FIELD: Record<string, keyof ClientInput> = {
  validation_name: "name",
  validation_slug: "slug",
  slug_taken: "slug",
  slug_locked: "slug",
  validation_notes: "notes",
  validation_legal_name: "legal_name",
  validation_cnpj: "cnpj",
  validation_inscricao_estadual: "inscricao_estadual",
  validation_primary_contact_name: "primary_contact_name",
  validation_primary_contact_email: "primary_contact_email",
  validation_primary_contact_phone: "primary_contact_phone",
  validation_address_street: "address_street",
  validation_address_number: "address_number",
  validation_address_complement: "address_complement",
  validation_address_district: "address_district",
  validation_address_city: "address_city",
  validation_address_state: "address_state",
  validation_address_zip: "address_zip",
};

export function ClientForm(props: Props): React.JSX.Element {
  const router = useRouter();
  const isEdit = props.mode === "edit";
  const isAdmin = props.isAdmin ?? false;
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(isEdit);

  const defaultValues: ClientInput = isEdit
    ? {
        name: props.initialData.name,
        slug: props.initialData.slug,
        notes: props.initialData.notes ?? undefined,
        legal_name: props.initialData.legal_name ?? undefined,
        cnpj: formatCnpj(props.initialData.cnpj) ?? undefined,
        inscricao_estadual:
          props.initialData.inscricao_estadual ?? undefined,
        primary_contact_name:
          props.initialData.primary_contact_name ?? undefined,
        primary_contact_email:
          props.initialData.primary_contact_email ?? undefined,
        primary_contact_phone:
          props.initialData.primary_contact_phone ?? undefined,
        address_street: props.initialData.address_street ?? undefined,
        address_number: props.initialData.address_number ?? undefined,
        address_complement:
          props.initialData.address_complement ?? undefined,
        address_district: props.initialData.address_district ?? undefined,
        address_city: props.initialData.address_city ?? undefined,
        address_state: props.initialData.address_state ?? undefined,
        address_zip: formatCep(props.initialData.address_zip) ?? undefined,
      }
    : {
        name: "",
        slug: "",
        notes: undefined,
        legal_name: undefined,
        cnpj: undefined,
        inscricao_estadual: undefined,
        primary_contact_name: undefined,
        primary_contact_email: undefined,
        primary_contact_phone: undefined,
        address_street: undefined,
        address_number: undefined,
        address_complement: undefined,
        address_district: undefined,
        address_city: undefined,
        address_state: undefined,
        address_zip: undefined,
      };

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ClientInput, undefined, ClientOutput>({
    resolver: zodResolver(
      clientSchema.transform((data) => ({
        ...data,
        cnpj: data.cnpj ? stripDigits(data.cnpj) : data.cnpj,
        address_zip: data.address_zip
          ? stripDigits(data.address_zip)
          : data.address_zip,
      })),
    ),
    defaultValues,
  });

  const busy = isSubmitting || isArchiving;
  const slugDisabled = isEdit && !props.canChangeSlug;
  const watchedName = watch("name");

  useEffect(() => {
    if (slugTouched || slugDisabled) return;
    setValue("slug", slugify(watchedName ?? ""), { shouldDirty: true });
  }, [watchedName, slugTouched, slugDisabled, setValue]);

  async function onSubmit(data: ClientOutput) {
    setGeneralError(null);
    const fd = new FormData();
    fd.set("name", data.name);
    fd.set("slug", data.slug);
    fd.set("notes", data.notes ?? "");
    fd.set("legal_name", data.legal_name ?? "");
    fd.set("cnpj", data.cnpj ?? "");
    fd.set("inscricao_estadual", data.inscricao_estadual ?? "");
    fd.set("primary_contact_name", data.primary_contact_name ?? "");
    fd.set("primary_contact_email", data.primary_contact_email ?? "");
    fd.set("primary_contact_phone", data.primary_contact_phone ?? "");
    fd.set("address_street", data.address_street ?? "");
    fd.set("address_number", data.address_number ?? "");
    fd.set("address_complement", data.address_complement ?? "");
    fd.set("address_district", data.address_district ?? "");
    fd.set("address_city", data.address_city ?? "");
    fd.set("address_state", data.address_state ?? "");
    fd.set("address_zip", data.address_zip ?? "");

    const result = isEdit
      ? await updateClientAction(props.initialData.id, fd)
      : await createClientAction(fd);

    if (result.ok) {
      const id = isEdit ? props.initialData.id : result.data.id;
      router.push(`/clients/${id}`);
      router.refresh();
      return;
    }
    const field = result.code ? ERROR_TO_FIELD[result.code] : undefined;
    if (field) {
      setError(field, { message: result.error });
    } else {
      setGeneralError(result.error);
    }
  }

  async function handleArchive() {
    if (!isEdit || !props.canArchive) return;
    if (!window.confirm("Arquivar este Cliente?")) return;
    setIsArchiving(true);
    setGeneralError(null);
    const result = await archiveClientAction(props.initialData.id);
    if (result.ok) {
      router.push("/clients");
      router.refresh();
    } else {
      setGeneralError(result.error);
      setIsArchiving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-7 max-w-2xl">
      {generalError && (
        <div className="bg-critical-bg border border-critical text-critical text-sm rounded px-3 py-2">
          {generalError}
        </div>
      )}

      <Section title="Identificação">
        <Field label="Nome (fantasia)" htmlFor="name" required error={errors.name?.message}>
          <input
            id="name"
            type="text"
            {...register("name")}
            maxLength={120}
            disabled={busy}
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
            {...register("slug", { onChange: () => setSlugTouched(true) })}
            maxLength={60}
            disabled={busy || slugDisabled}
            className={inputCn}
          />
        </Field>

        <Field label="Razão social" htmlFor="legal_name" error={errors.legal_name?.message}>
          <input
            id="legal_name"
            type="text"
            {...register("legal_name")}
            maxLength={200}
            disabled={busy}
            className={inputCn}
          />
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="CNPJ"
            htmlFor="cnpj"
            error={errors.cnpj?.message}
            hint="14 dígitos"
          >
            <input
              id="cnpj"
              type="text"
              {...register("cnpj", {
                onChange: (e) => {
                  e.target.value = applyCnpjMask(e.target.value);
                },
              })}
              placeholder="00.000.000/0000-00"
              maxLength={18}
              disabled={busy}
              className={inputCn}
              inputMode="numeric"
            />
          </Field>

          <Field
            label="Inscrição Estadual"
            htmlFor="inscricao_estadual"
            error={errors.inscricao_estadual?.message}
          >
            <input
              id="inscricao_estadual"
              type="text"
              {...register("inscricao_estadual")}
              maxLength={30}
              disabled={busy}
              className={inputCn}
            />
          </Field>
        </div>
      </Section>

      <Section title="Contato">
        <Field
          label="Nome do contato"
          htmlFor="primary_contact_name"
          error={errors.primary_contact_name?.message}
        >
          <input
            id="primary_contact_name"
            type="text"
            {...register("primary_contact_name")}
            maxLength={120}
            disabled={busy}
            className={inputCn}
          />
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="E-mail"
            htmlFor="primary_contact_email"
            error={errors.primary_contact_email?.message}
          >
            <input
              id="primary_contact_email"
              type="email"
              {...register("primary_contact_email")}
              maxLength={150}
              disabled={busy}
              className={inputCn}
            />
          </Field>

          <Field
            label="Telefone"
            htmlFor="primary_contact_phone"
            error={errors.primary_contact_phone?.message}
          >
            <input
              id="primary_contact_phone"
              type="tel"
              {...register("primary_contact_phone")}
              maxLength={30}
              disabled={busy}
              className={inputCn}
            />
          </Field>
        </div>
      </Section>

      <Section title="Endereço">
        <div className="grid grid-cols-1 md:grid-cols-[3fr_1fr] gap-4">
          <Field
            label="Rua"
            htmlFor="address_street"
            error={errors.address_street?.message}
          >
            <input
              id="address_street"
              type="text"
              {...register("address_street")}
              maxLength={150}
              disabled={busy}
              className={inputCn}
            />
          </Field>

          <Field
            label="Número"
            htmlFor="address_number"
            error={errors.address_number?.message}
          >
            <input
              id="address_number"
              type="text"
              {...register("address_number")}
              maxLength={20}
              disabled={busy}
              className={inputCn}
            />
          </Field>
        </div>

        <Field
          label="Complemento"
          htmlFor="address_complement"
          error={errors.address_complement?.message}
        >
          <input
            id="address_complement"
            type="text"
            {...register("address_complement")}
            maxLength={100}
            disabled={busy}
            className={inputCn}
          />
        </Field>

        <Field
          label="Bairro"
          htmlFor="address_district"
          error={errors.address_district?.message}
        >
          <input
            id="address_district"
            type="text"
            {...register("address_district")}
            maxLength={100}
            disabled={busy}
            className={inputCn}
          />
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr] gap-4">
          <Field
            label="Cidade"
            htmlFor="address_city"
            error={errors.address_city?.message}
          >
            <input
              id="address_city"
              type="text"
              {...register("address_city")}
              maxLength={100}
              disabled={busy}
              className={inputCn}
            />
          </Field>

          <Field
            label="UF"
            htmlFor="address_state"
            error={errors.address_state?.message}
          >
            <select
              id="address_state"
              {...register("address_state")}
              disabled={busy}
              className={inputCn}
            >
              <option value="">—</option>
              {UFS.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="CEP"
            htmlFor="address_zip"
            error={errors.address_zip?.message}
          >
            <input
              id="address_zip"
              type="text"
              {...register("address_zip", {
                onChange: (e) => {
                  e.target.value = applyCepMask(e.target.value);
                },
              })}
              placeholder="00000-000"
              maxLength={9}
              disabled={busy}
              className={inputCn}
              inputMode="numeric"
            />
          </Field>
        </div>
      </Section>

      <Section title="Observações">
        <Field label="Notas" htmlFor="notes" error={errors.notes?.message}>
          <textarea
            id="notes"
            {...register("notes")}
            maxLength={1000}
            rows={4}
            disabled={busy}
            className={`${inputCn} resize-y`}
          />
        </Field>
      </Section>

      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <Button type="submit" variant="primary" disabled={busy}>
            {isSubmitting ? "Salvando..." : isEdit ? "Salvar" : "Criar cliente"}
          </Button>
          <Link href={isEdit ? `/clients/${props.initialData.id}` : "/clients"}>
            <Button variant="ghost" type="button">
              Cancelar
            </Button>
          </Link>
        </div>
        {isEdit && props.canArchive && isAdmin && (
          <Button
            type="button"
            variant="ghost"
            onClick={handleArchive}
            disabled={busy}
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

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <h3 className="font-mono text-[11px] uppercase tracking-wide text-mute border-b border-line pb-2">
        {title}
      </h3>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

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
