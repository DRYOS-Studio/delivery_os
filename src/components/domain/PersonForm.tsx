"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import {
  archivePersonAction,
  createPersonAction,
  updatePersonAction,
} from "@/lib/actions/persons";
import type { PersonDetail } from "@/lib/db/queries/persons";
import {
  personSchema,
  type PersonInput,
  type PersonOutput,
} from "@/lib/validators/person";

type ClientForSelect = { id: string; name: string };

type Props = (
  | {
      mode: "create";
      clientsForSelect: ClientForSelect[];
    }
  | {
      mode: "edit";
      initialData: PersonDetail;
      clientsForSelect: ClientForSelect[];
      canArchive: boolean;
      /** Motivo exibido quando `canArchive` é falso. `null` quando liberado. */
      archiveBlockedReason: string | null;
    }
) & { isAdmin?: boolean };

function mapErrorToFields(
  code: string | undefined,
  message: string,
  setError: ReturnType<typeof useForm<PersonInput>>["setError"],
  setGeneral: (m: string | null) => void,
): void {
  if (!code) return setGeneral(message);
  if (code.startsWith("validation_")) {
    const field = code.replace("validation_", "") as keyof PersonInput;
    setError(field, { message });
    return;
  }
  if (code === "invalid_client") {
    setError("client_id" as keyof PersonInput, { message });
    return;
  }
  setGeneral(message);
}

export function PersonForm(props: Props): React.JSX.Element {
  const router = useRouter();
  const isEdit = props.mode === "edit";
  const isAdmin = props.isAdmin ?? false;
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);

  const defaultValues: PersonInput = isEdit
    ? props.initialData.kind === "internal"
      ? {
          kind: "internal",
          name: props.initialData.name,
          email: props.initialData.email ?? undefined,
          specialty: props.initialData.specialty ?? "",
          hourly_rate: props.initialData.hourly_rate ?? null,
          monthly_compensation:
            props.initialData.monthly_compensation ?? null,
          contracted_weekly_hours:
            props.initialData.contracted_weekly_hours ?? null,
        }
      : {
          kind: "external",
          name: props.initialData.name,
          email: props.initialData.email ?? undefined,
          external_role: props.initialData.external_role ?? "",
          client_id: props.initialData.client_id ?? "",
          hourly_rate: props.initialData.hourly_rate ?? null,
          monthly_compensation:
            props.initialData.monthly_compensation ?? null,
          contracted_weekly_hours:
            props.initialData.contracted_weekly_hours ?? null,
        }
    : {
        kind: "internal",
        name: "",
        email: undefined,
        specialty: "",
        hourly_rate: null,
        monthly_compensation: null,
        contracted_weekly_hours: null,
      };

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PersonInput, undefined, PersonOutput>({
    resolver: zodResolver(personSchema),
    defaultValues,
  });

  const busy = isSubmitting || isArchiving;
  const watchedKind = watch("kind");

  // Quando kind muda no create, limpa os campos do outro lado
  useEffect(() => {
    if (isEdit) return;
    if (watchedKind === "internal") {
      setValue("external_role" as keyof PersonInput, undefined as never);
      setValue("client_id" as keyof PersonInput, undefined as never);
    } else {
      setValue("specialty" as keyof PersonInput, undefined as never);
    }
  }, [watchedKind, isEdit, setValue]);

  async function onSubmit(data: PersonOutput) {
    setGeneralError(null);
    const fd = new FormData();
    fd.set("kind", data.kind);
    fd.set("name", data.name);
    fd.set("email", data.email ?? "");
    if (data.kind === "internal") {
      fd.set("specialty", data.specialty);
    } else {
      fd.set("external_role", data.external_role);
      fd.set("client_id", data.client_id);
    }
    fd.set(
      "hourly_rate",
      data.hourly_rate !== null && data.hourly_rate !== undefined
        ? String(data.hourly_rate)
        : "",
    );
    fd.set(
      "monthly_compensation",
      data.monthly_compensation !== null &&
        data.monthly_compensation !== undefined
        ? String(data.monthly_compensation)
        : "",
    );
    fd.set(
      "contracted_weekly_hours",
      data.contracted_weekly_hours !== null &&
        data.contracted_weekly_hours !== undefined
        ? String(data.contracted_weekly_hours)
        : "",
    );

    const result = isEdit
      ? await updatePersonAction(props.initialData.id, fd)
      : await createPersonAction(fd);

    if (result.ok) {
      const id = isEdit ? props.initialData.id : result.data.id;
      router.push(`/persons/${id}`);
      router.refresh();
      return;
    }
    mapErrorToFields(result.code, result.error, setError, setGeneralError);
  }

  async function handleArchive() {
    if (!isEdit || !props.canArchive) return;
    if (!window.confirm("Arquivar esta Pessoa?")) return;
    setIsArchiving(true);
    setGeneralError(null);
    const result = await archivePersonAction(props.initialData.id);
    if (result.ok) {
      router.push("/persons");
      router.refresh();
    } else {
      setGeneralError(result.error);
      setIsArchiving(false);
    }
  }

  const isExternal = watchedKind === "external";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-2xl">
      {generalError && (
        <div className="bg-critical-bg border border-critical text-critical text-sm rounded px-3 py-2">
          {generalError}
        </div>
      )}

      <Field
        label="Tipo"
        htmlFor="kind"
        required
        error={errors.kind?.message}
        hint={isEdit ? "Tipo não pode mudar. Pra trocar, crie nova pessoa." : undefined}
      >
        <select
          id="kind"
          {...register("kind")}
          disabled={busy || isEdit}
          className={inputCn}
        >
          <option value="internal">Interna (DRYOS)</option>
          <option value="external">Externa (cliente / parceiro)</option>
        </select>
      </Field>

      <Field label="Nome" htmlFor="name" required error={errors.name?.message}>
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
        label="E-mail"
        htmlFor="email"
        error={errors.email?.message}
        hint="Opcional"
      >
        <input
          id="email"
          type="email"
          {...register("email")}
          disabled={busy}
          className={inputCn}
        />
      </Field>

      {!isExternal && (
        <Field
          label="Especialidade"
          htmlFor="specialty"
          required
          error={errors.specialty?.message}
          hint="Ex: Engenharia, Marketing, Operações"
        >
          <input
            id="specialty"
            type="text"
            {...register("specialty")}
            maxLength={80}
            disabled={busy}
            className={inputCn}
          />
        </Field>
      )}

      {isExternal && (
        <>
          <Field
            label="Papel externo"
            htmlFor="external_role"
            required
            error={errors.external_role?.message}
            hint="Ex: Diretor de Operações, Tech Lead"
          >
            <input
              id="external_role"
              type="text"
              {...register("external_role")}
              maxLength={80}
              disabled={busy}
              className={inputCn}
            />
          </Field>

          <Field
            label="Cliente"
            htmlFor="client_id"
            required
            error={errors.client_id?.message}
            hint={
              props.clientsForSelect.length === 0
                ? "Crie um Cliente primeiro."
                : undefined
            }
          >
            <select
              id="client_id"
              {...register("client_id")}
              disabled={busy || props.clientsForSelect.length === 0}
              className={inputCn}
            >
              <option value="">Selecione…</option>
              {props.clientsForSelect.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </>
      )}

      {isAdmin ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              label="Salário mensal (R$)"
              htmlFor="monthly_compensation"
              error={errors.monthly_compensation?.message}
              hint="Compensação bruta mensal. Junto com horas contratadas, deriva taxa horária."
            >
              <input
                id="monthly_compensation"
                type="number"
                step="0.01"
                min={0}
                {...register("monthly_compensation")}
                placeholder="0.00"
                disabled={busy}
                className={inputCn}
              />
            </Field>

            <Field
              label="Horas contratadas/semana"
              htmlFor="contracted_weekly_hours"
              error={errors.contracted_weekly_hours?.message}
              hint="Ex: 40 (CLT padrão). Usada com salário pra derivar rate."
            >
              <input
                id="contracted_weekly_hours"
                type="number"
                step="0.5"
                min={0}
                {...register("contracted_weekly_hours")}
                placeholder="40"
                disabled={busy}
                className={inputCn}
              />
            </Field>
          </div>

          <DerivedRateHint
            compensation={watch("monthly_compensation")}
            contracted={watch("contracted_weekly_hours")}
          />

          <Field
            label="Taxa horária (R$/h) — legacy"
            htmlFor="hourly_rate"
            error={errors.hourly_rate?.message}
            hint="Fallback usado se salário + horas estiverem em branco. Prefira preencher salário."
          >
            <input
              id="hourly_rate"
              type="number"
              step="0.01"
              min={0}
              {...register("hourly_rate")}
              placeholder="0.00"
              disabled={busy}
              className={inputCn}
            />
          </Field>
        </>
      ) : (
        <>
          <input type="hidden" {...register("hourly_rate")} />
          <input type="hidden" {...register("monthly_compensation")} />
          <input type="hidden" {...register("contracted_weekly_hours")} />
        </>
      )}

      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <Button type="submit" variant="primary" disabled={busy}>
            {isSubmitting ? "Salvando..." : isEdit ? "Salvar" : "Criar pessoa"}
          </Button>
          <Link href={isEdit ? `/persons/${props.initialData.id}` : "/persons"}>
            <Button variant="ghost" type="button">
              Cancelar
            </Button>
          </Link>
        </div>
        {isEdit && isAdmin && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={handleArchive}
              disabled={busy || !props.canArchive}
              aria-describedby={
                props.archiveBlockedReason ? "archive-blocked" : undefined
              }
              className="text-critical hover:text-critical hover:bg-critical-bg"
            >
              Arquivar
            </Button>
            {props.archiveBlockedReason && (
              <p id="archive-blocked" className="text-xs text-mute">
                {props.archiveBlockedReason}
              </p>
            )}
          </div>
        )}
      </div>
    </form>
  );
}

function DerivedRateHint({
  compensation,
  contracted,
}: {
  compensation: unknown;
  contracted: unknown;
}) {
  const c =
    compensation === null || compensation === undefined || compensation === ""
      ? null
      : typeof compensation === "number"
        ? compensation
        : Number(String(compensation).replace(",", "."));
  const h =
    contracted === null || contracted === undefined || contracted === ""
      ? null
      : typeof contracted === "number"
        ? contracted
        : Number(String(contracted).replace(",", "."));
  if (c === null || h === null || !Number.isFinite(c) || !Number.isFinite(h))
    return null;
  if (c <= 0 || h <= 0) return null;
  const rate = c / (h * 4);
  return (
    <p className="font-mono text-[10px] text-mute -mt-2">
      Taxa derivada: R$ {rate.toFixed(2)}/h ({h}h/sem × 4 sem ={" "}
      {(h * 4).toFixed(1)}h/mês)
    </p>
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
