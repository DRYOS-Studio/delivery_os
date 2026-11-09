"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  type FieldErrors,
  type UseFormRegister,
  useFieldArray,
  useForm,
} from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { submitClientRegistrationAction } from "@/lib/actions/client-registration";
import {
  applyCepMask,
  applyCnpjMask,
  applyCpfMask,
} from "@/lib/utils/mask";
import { UFS } from "@/lib/utils/ufs";
import {
  clientRegistrationSubmissionSchema,
  type ClientRegistrationSubmission,
} from "@/lib/validators/client-registration";
import type { z } from "zod";

type RegistrationFormInput = z.input<typeof clientRegistrationSubmissionSchema>;

type Props = {
  token: string;
  prefillPhone: string;
};

const inputClass =
  "w-full bg-card border border-line rounded px-3 py-2 text-sm text-ink-soft focus:outline-none focus:ring-2 focus:ring-oak/30 disabled:opacity-60";

const labelClass = "block font-mono text-[10px] text-mute uppercase mb-1";

export function PublicClientRegistrationForm({
  token,
  prefillPhone,
}: Props): React.JSX.Element {
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [personType, setPersonType] = useState<"pf" | "pj" | null>(null);

  const form = useForm<
    RegistrationFormInput,
    undefined,
    ClientRegistrationSubmission
  >({
    resolver: zodResolver(clientRegistrationSubmissionSchema),
    defaultValues: {
      person_type: "pf",
      software_items: [],
      focal_point_phone: prefillPhone,
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    formState: { errors, isSubmitting },
  } = form;

  const { fields, append, remove } = useFieldArray({
    control,
    name: "software_items",
  });

  const zip = watch("address_zip");

  async function lookupCep(): Promise<void> {
    const digits = String(zip ?? "").replace(/\D/g, "");
    if (digits.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = (await res.json()) as {
        erro?: boolean;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
      };
      if (data.erro) return;
      if (data.logradouro) setValue("address_street", data.logradouro);
      if (data.bairro) setValue("address_district", data.bairro);
      if (data.localidade) setValue("address_city", data.localidade);
      if (data.uf) setValue("address_state", data.uf);
    } catch {
      /* ViaCEP opcional */
    }
  }

  function chooseType(type: "pf" | "pj"): void {
    setPersonType(type);
    setValue("person_type", type);
  }

  async function onSubmit(data: ClientRegistrationSubmission): Promise<void> {
    setGeneralError(null);
    const result = await submitClientRegistrationAction(token, data);
    if (result.ok) {
      setSubmitted(true);
      return;
    }
    setGeneralError(result.error);
  }

  if (submitted) {
    return (
      <Card className="p-6 text-center">
        <h1 className="font-display text-xl text-ink font-semibold mb-2">
          Cadastro enviado
        </h1>
        <p className="text-sm text-mute">
          Obrigado! Nossa equipe vai revisar seus dados e entrar em contato em
          breve.
        </p>
      </Card>
    );
  }

  if (personType === null) {
    return (
      <Card className="p-6">
        <h1 className="font-display text-xl text-ink font-semibold mb-2">
          Como vamos te cadastrar?
        </h1>
        <p className="text-sm text-mute mb-6">
          Escolha se o contrato será com pessoa física ou empresa (PJ).
        </p>
        <div className="flex flex-col gap-3">
          <Button type="button" variant="primary" onClick={() => chooseType("pf")}>
            Pessoa física
          </Button>
          <Button type="button" variant="ghost" onClick={() => chooseType("pj")}>
            Empresa (PJ)
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {generalError && (
        <p className="text-sm text-critical bg-critical-bg rounded px-3 py-2">
          {generalError}
        </p>
      )}

      {personType === "pf" ? (
        <PfFields register={register} errors={errors} />
      ) : (
        <PjFields register={register} errors={errors} />
      )}

      <AddressFields register={register} onCepBlur={() => void lookupCep()} />

      <Card className="p-5 space-y-4">
        <h2 className="font-display text-base text-ink font-semibold">Contatos</h2>
        <ContactGroup
          title="Ponto focal"
          nameKey="focal_point_name"
          emailKey="focal_point_email"
          phoneKey="focal_point_phone"
          register={register}
        />
        <ContactGroup
          title="Contato financeiro (NF/cobrança)"
          nameKey="financial_contact_name"
          emailKey="financial_contact_email"
          phoneKey="financial_contact_phone"
          register={register}
        />
      </Card>

      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base text-ink font-semibold">
            Ferramentas que já usa
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => append({ name: "", purpose: "", url: "" })}
          >
            <Plus className="w-4 h-4" strokeWidth={1.75} />
            Adicionar
          </Button>
        </div>
        {fields.map((field, index) => (
          <div key={field.id} className="border border-line rounded p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-mono text-[10px] text-mute">#{index + 1}</span>
              <button
                type="button"
                className="text-mute hover:text-critical p-1"
                aria-label="Remover ferramenta"
                onClick={() => remove(index)}
              >
                <Trash2 className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>
            <input className={inputClass} placeholder="Nome da ferramenta" {...register(`software_items.${index}.name`)} />
            <input className={inputClass} placeholder="Link de acesso (opcional)" {...register(`software_items.${index}.url`)} />
            <input className={inputClass} placeholder="Para que usa" {...register(`software_items.${index}.purpose`)} />
          </div>
        ))}
      </Card>

      <Card className="p-5">
        <label className="flex gap-3 items-start text-sm">
          <input type="checkbox" className="mt-1" {...register("lgpd_consent")} />
          <span>
            Autorizo o tratamento dos meus dados conforme a LGPD, exclusivamente
            para formalização do contrato e comunicações relacionadas à prestação
            de serviços da DRYOS.
          </span>
        </label>
        {errors.lgpd_consent && (
          <p className="text-xs text-critical mt-2">{errors.lgpd_consent.message}</p>
        )}
      </Card>

      <Button type="submit" variant="sage" disabled={isSubmitting} className="w-full">
        {isSubmitting ? "Enviando…" : "Enviar cadastro"}
      </Button>
    </form>
  );
}

function fieldMessage(
  errors: FieldErrors<RegistrationFormInput>,
  key: string,
): string | undefined {
  const bag = errors as Record<string, { message?: string } | undefined>;
  return bag[key]?.message;
}

function PfFields({
  register,
  errors,
}: {
  register: UseFormRegister<RegistrationFormInput>;
  errors: FieldErrors<RegistrationFormInput>;
}): React.JSX.Element {
  return (
    <Card className="p-5 space-y-4">
      <h2 className="font-display text-base text-ink font-semibold">Pessoa física</h2>
      <Field label="Nome completo" error={fieldMessage(errors, "full_name")}>
        <input className={inputClass} {...register("full_name")} />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Profissão" error={fieldMessage(errors, "profession")}>
          <input className={inputClass} {...register("profession")} />
        </Field>
        <Field label="Estado civil" error={fieldMessage(errors, "marital_status")}>
          <input className={inputClass} {...register("marital_status")} />
        </Field>
      </div>
      <Field label="CPF" error={fieldMessage(errors, "cpf")}>
        <input
          className={inputClass}
          {...register("cpf", {
            onChange: (e) => {
              e.target.value = applyCpfMask(e.target.value);
            },
          })}
        />
      </Field>
      <Field label="E-mail para comunicações formais" error={fieldMessage(errors, "formal_email")}>
        <input className={inputClass} type="email" {...register("formal_email")} />
      </Field>
    </Card>
  );
}

function PjFields({
  register,
  errors,
}: {
  register: UseFormRegister<RegistrationFormInput>;
  errors: FieldErrors<RegistrationFormInput>;
}): React.JSX.Element {
  return (
    <Card className="p-5 space-y-4">
      <h2 className="font-display text-base text-ink font-semibold">Empresa</h2>
      <Field label="Razão social" error={fieldMessage(errors, "legal_name")}>
        <input className={inputClass} {...register("legal_name")} />
      </Field>
      <Field label="Nome fantasia">
        <input className={inputClass} {...register("trade_name")} />
      </Field>
      <Field label="CNPJ" error={fieldMessage(errors, "cnpj")}>
        <input
          className={inputClass}
          {...register("cnpj", {
            onChange: (e) => {
              e.target.value = applyCnpjMask(e.target.value);
            },
          })}
        />
      </Field>
      <h3 className="font-display text-sm text-ink font-semibold pt-2">
        Representante legal
      </h3>
      <Field label="Nome" error={fieldMessage(errors, "legal_representative_name")}>
        <input className={inputClass} {...register("legal_representative_name")} />
      </Field>
      <Field label="Cargo" error={fieldMessage(errors, "legal_representative_role")}>
        <input className={inputClass} {...register("legal_representative_role")} />
      </Field>
      <Field label="CPF" error={fieldMessage(errors, "legal_representative_cpf")}>
        <input
          className={inputClass}
          {...register("legal_representative_cpf", {
            onChange: (e) => {
              e.target.value = applyCpfMask(e.target.value);
            },
          })}
        />
      </Field>
      <Field label="E-mail" error={fieldMessage(errors, "legal_representative_email")}>
        <input className={inputClass} type="email" {...register("legal_representative_email")} />
      </Field>
    </Card>
  );
}

function AddressFields({
  register,
  onCepBlur,
}: {
  register: UseFormRegister<RegistrationFormInput>;
  onCepBlur: () => void;
}): React.JSX.Element {
  return (
    <Card className="p-5 space-y-4">
      <h2 className="font-display text-base text-ink font-semibold">Endereço</h2>
      <Field label="CEP">
        <input
          className={inputClass}
          {...register("address_zip", {
            onChange: (e) => {
              e.target.value = applyCepMask(e.target.value);
            },
            onBlur: onCepBlur,
          })}
        />
      </Field>
      <Field label="Logradouro">
        <input className={inputClass} {...register("address_street")} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Número">
          <input className={inputClass} {...register("address_number")} />
        </Field>
        <Field label="Complemento">
          <input className={inputClass} {...register("address_complement")} />
        </Field>
      </div>
      <Field label="Bairro">
        <input className={inputClass} {...register("address_district")} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Cidade">
          <input className={inputClass} {...register("address_city")} />
        </Field>
        <Field label="UF">
          <select className={inputClass} {...register("address_state")}>
            <option value="">—</option>
            {UFS.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </Card>
  );
}

function ContactGroup({
  title,
  nameKey,
  emailKey,
  phoneKey,
  register,
}: {
  title: string;
  nameKey: "focal_point_name" | "financial_contact_name";
  emailKey: "focal_point_email" | "financial_contact_email";
  phoneKey: "focal_point_phone" | "financial_contact_phone";
  register: UseFormRegister<RegistrationFormInput>;
}): React.JSX.Element {
  return (
    <fieldset className="space-y-3">
      <legend className="font-display text-sm text-ink font-semibold mb-2">
        {title}
      </legend>
      <Field label="Nome">
        <input className={inputClass} {...register(nameKey)} />
      </Field>
      <Field label="E-mail">
        <input className={inputClass} type="email" {...register(emailKey)} />
      </Field>
      <Field label="Telefone / WhatsApp">
        <input className={inputClass} {...register(phoneKey)} />
      </Field>
    </fieldset>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | undefined;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div>
      <span className={labelClass}>{label}</span>
      {children}
      {error && <p className="text-xs text-critical mt-1">{error}</p>}
    </div>
  );
}
