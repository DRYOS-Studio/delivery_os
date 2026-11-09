"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  type FieldErrors,
  type UseFormRegister,
  type UseFormWatch,
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
import { MARITAL_STATUS_OPTIONS } from "@/lib/utils/marital-status";
import { UFS } from "@/lib/utils/ufs";
import {
  clientRegistrationSubmissionSchema,
  type ClientRegistrationSubmission,
} from "@/lib/validators/client-registration";
import {
  fieldsForWizardStep,
  WIZARD_STEP_LABELS,
  type RegistrationFormInput,
  wizardStepsForPersonType,
  type WizardStepId,
} from "@/lib/validators/client-registration-wizard";

type Props = {
  token: string;
  prefillPhone: string;
};

const inputClass =
  "w-full max-w-full min-h-[44px] bg-card border border-line rounded px-3 py-2.5 text-base text-ink-soft focus:outline-none focus:ring-2 focus:ring-oak/30 disabled:opacity-60 touch-manipulation";

const labelClass = "block font-mono text-[10px] text-mute uppercase mb-1.5";

function fieldMessage(
  errors: FieldErrors<RegistrationFormInput>,
  key: string,
): string | undefined {
  const bag = errors as Record<string, { message?: string } | undefined>;
  return bag[key]?.message;
}

export function PublicClientRegistrationForm({
  token,
  prefillPhone,
}: Props): React.JSX.Element {
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [personType, setPersonType] = useState<"pf" | "pj" | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  const form = useForm<
    RegistrationFormInput,
    undefined,
    ClientRegistrationSubmission
  >({
    resolver: zodResolver(clientRegistrationSubmissionSchema),
    shouldUnregister: false,
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
    trigger,
    formState: { errors, isSubmitting },
  } = form;

  const { fields, append, remove } = useFieldArray({
    control,
    name: "software_items",
  });

  const steps = useMemo(
    () => (personType ? wizardStepsForPersonType(personType) : []),
    [personType],
  );
  const currentStep = steps[stepIndex];
  const totalSteps = steps.length;
  const zip = watch("address_zip");

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [stepIndex, personType]);

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
    setStepIndex(0);
    setGeneralError(null);
  }

  async function goNext(): Promise<void> {
    if (!personType || !currentStep) return;
    setGeneralError(null);
    const ok = await trigger(fieldsForWizardStep(currentStep, personType));
    if (!ok) return;
    if (stepIndex < totalSteps - 1) {
      setStepIndex(stepIndex + 1);
    }
  }

  function goBack(): void {
    setGeneralError(null);
    if (stepIndex > 0) {
      setStepIndex(stepIndex - 1);
    }
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
          <Button
            type="button"
            variant="primary"
            className="w-full min-h-[44px] justify-center"
            onClick={() => chooseType("pf")}
          >
            Pessoa física
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full min-h-[44px] justify-center"
            onClick={() => chooseType("pj")}
          >
            Empresa (PJ)
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <>
      <ProgressHeader
        stepIndex={stepIndex}
        totalSteps={totalSteps}
        stepId={currentStep}
      />

      {generalError && (
        <p className="text-sm text-critical bg-critical-bg rounded px-3 py-2 mb-4">
          {generalError}
        </p>
      )}

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4 pb-4 max-w-full"
      >
        {currentStep === "qualification" && personType === "pf" && (
          <PfQualificationStep register={register} errors={errors} />
        )}
        {currentStep === "qualification" && personType === "pj" && (
          <PjQualificationStep register={register} errors={errors} />
        )}
        {currentStep === "address" && (
          <AddressStep
            register={register}
            errors={errors}
            onCepBlur={() => void lookupCep()}
          />
        )}
        {currentStep === "legal_rep" && personType === "pj" && (
          <LegalRepStep register={register} errors={errors} />
        )}
        {currentStep === "focal" && (
          <FocalStep register={register} errors={errors} />
        )}
        {currentStep === "financial" && (
          <FinancialStep register={register} errors={errors} />
        )}
        {currentStep === "tools" && (
          <ToolsStep
            register={register}
            fields={fields}
            append={append}
            remove={remove}
          />
        )}
        {currentStep === "review" && (
          <ReviewStep
            register={register}
            errors={errors}
            watch={watch}
            personType={personType}
          />
        )}

        <WizardFooter
          stepIndex={stepIndex}
          totalSteps={totalSteps}
          isReview={currentStep === "review"}
          isSubmitting={isSubmitting}
          onBack={goBack}
          onNext={() => void goNext()}
        />
      </form>
    </>
  );
}

function ProgressHeader({
  stepIndex,
  totalSteps,
  stepId,
}: {
  stepIndex: number;
  totalSteps: number;
  stepId: WizardStepId | undefined;
}): React.JSX.Element {
  const pct = Math.round(((stepIndex + 1) / totalSteps) * 100);
  const label = stepId ? WIZARD_STEP_LABELS[stepId] : "";
  return (
    <div className="mb-5">
      <div className="flex justify-between items-baseline mb-2">
        <p className="font-mono text-[10px] text-mute uppercase">
          Etapa {stepIndex + 1} de {totalSteps}
        </p>
        <p className="text-sm font-medium text-ink">{label}</p>
      </div>
      <div
        className="h-1.5 w-full bg-surface rounded-pill overflow-hidden"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full bg-oak transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function WizardFooter({
  stepIndex,
  totalSteps,
  isReview,
  isSubmitting,
  onBack,
  onNext,
}: {
  stepIndex: number;
  totalSteps: number;
  isReview: boolean;
  isSubmitting: boolean;
  onBack: () => void;
  onNext: () => void;
}): React.JSX.Element {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-card/95 backdrop-blur px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="max-w-lg mx-auto w-full flex gap-2">
        <Button
          type="button"
          variant="ghost"
          className="flex-1 min-h-[44px] justify-center"
          disabled={stepIndex === 0 || isSubmitting}
          onClick={onBack}
        >
          Voltar
        </Button>
        {isReview ? (
          <Button
            type="submit"
            variant="sage"
            className="flex-[2] min-h-[44px] justify-center"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Enviando…" : "Enviar cadastro"}
          </Button>
        ) : (
          <Button
            type="button"
            variant="primary"
            className="flex-[2] min-h-[44px] justify-center"
            disabled={isSubmitting}
            onClick={onNext}
          >
            Continuar
          </Button>
        )}
      </div>
    </div>
  );
}

function PfQualificationStep({
  register,
  errors,
}: {
  register: UseFormRegister<RegistrationFormInput>;
  errors: FieldErrors<RegistrationFormInput>;
}): React.JSX.Element {
  return (
    <Card className="p-4 sm:p-5 space-y-4 max-w-full">
      <Field label="Nome completo" error={fieldMessage(errors, "full_name")}>
        <input className={inputClass} autoComplete="name" {...register("full_name")} />
      </Field>
      <Field label="Profissão" error={fieldMessage(errors, "profession")}>
        <input className={inputClass} {...register("profession")} />
      </Field>
      <Field label="Estado civil" error={fieldMessage(errors, "marital_status")}>
        <select className={inputClass} {...register("marital_status")}>
          <option value="">Selecione…</option>
          {MARITAL_STATUS_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </Field>
      <Field label="CPF" error={fieldMessage(errors, "cpf")}>
        <input
          className={inputClass}
          inputMode="numeric"
          autoComplete="off"
          {...register("cpf", {
            onChange: (e) => {
              e.target.value = applyCpfMask(e.target.value);
            },
          })}
        />
      </Field>
      <Field label="E-mail para comunicações formais" error={fieldMessage(errors, "formal_email")}>
        <input
          className={inputClass}
          type="email"
          inputMode="email"
          autoComplete="email"
          {...register("formal_email")}
        />
      </Field>
    </Card>
  );
}

function PjQualificationStep({
  register,
  errors,
}: {
  register: UseFormRegister<RegistrationFormInput>;
  errors: FieldErrors<RegistrationFormInput>;
}): React.JSX.Element {
  return (
    <Card className="p-4 sm:p-5 space-y-4 max-w-full">
      <Field label="Razão social" error={fieldMessage(errors, "legal_name")}>
        <input className={inputClass} {...register("legal_name")} />
      </Field>
      <Field label="Nome fantasia (opcional)">
        <input className={inputClass} {...register("trade_name")} />
      </Field>
      <Field label="CNPJ" error={fieldMessage(errors, "cnpj")}>
        <input
          className={inputClass}
          inputMode="numeric"
          {...register("cnpj", {
            onChange: (e) => {
              e.target.value = applyCnpjMask(e.target.value);
            },
          })}
        />
      </Field>
    </Card>
  );
}

function LegalRepStep({
  register,
  errors,
}: {
  register: UseFormRegister<RegistrationFormInput>;
  errors: FieldErrors<RegistrationFormInput>;
}): React.JSX.Element {
  return (
    <Card className="p-4 sm:p-5 space-y-4 max-w-full">
      <Field
        label="Nome do representante"
        error={fieldMessage(errors, "legal_representative_name")}
      >
        <input className={inputClass} {...register("legal_representative_name")} />
      </Field>
      <Field label="Cargo" error={fieldMessage(errors, "legal_representative_role")}>
        <input className={inputClass} {...register("legal_representative_role")} />
      </Field>
      <Field label="CPF" error={fieldMessage(errors, "legal_representative_cpf")}>
        <input
          className={inputClass}
          inputMode="numeric"
          {...register("legal_representative_cpf", {
            onChange: (e) => {
              e.target.value = applyCpfMask(e.target.value);
            },
          })}
        />
      </Field>
      <Field
        label="Estado civil"
        error={fieldMessage(errors, "legal_representative_marital_status")}
      >
        <select className={inputClass} {...register("legal_representative_marital_status")}>
          <option value="">Selecione…</option>
          {MARITAL_STATUS_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label="E-mail"
        error={fieldMessage(errors, "legal_representative_email")}
      >
        <input
          className={inputClass}
          type="email"
          inputMode="email"
          {...register("legal_representative_email")}
        />
      </Field>
    </Card>
  );
}

function AddressStep({
  register,
  errors,
  onCepBlur,
}: {
  register: UseFormRegister<RegistrationFormInput>;
  errors: FieldErrors<RegistrationFormInput>;
  onCepBlur: () => void;
}): React.JSX.Element {
  return (
    <Card className="p-4 sm:p-5 space-y-4 max-w-full">
      <Field label="CEP" error={fieldMessage(errors, "address_zip")}>
        <input
          className={inputClass}
          inputMode="numeric"
          autoComplete="postal-code"
          {...register("address_zip", {
            onChange: (e) => {
              e.target.value = applyCepMask(e.target.value);
            },
            onBlur: onCepBlur,
          })}
        />
      </Field>
      <Field label="Logradouro" error={fieldMessage(errors, "address_street")}>
        <input className={inputClass} autoComplete="street-address" {...register("address_street")} />
      </Field>
      <GridTwo>
        <Field label="Número" error={fieldMessage(errors, "address_number")}>
          <input className={inputClass} {...register("address_number")} />
        </Field>
        <Field label="Complemento">
          <input className={inputClass} {...register("address_complement")} />
        </Field>
      </GridTwo>
      <Field label="Bairro" error={fieldMessage(errors, "address_district")}>
        <input className={inputClass} {...register("address_district")} />
      </Field>
      <GridTwo>
        <Field label="Cidade" error={fieldMessage(errors, "address_city")}>
          <input className={inputClass} {...register("address_city")} />
        </Field>
        <Field label="UF" error={fieldMessage(errors, "address_state")}>
          <select className={inputClass} {...register("address_state")}>
            <option value="">—</option>
            {UFS.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </select>
        </Field>
      </GridTwo>
    </Card>
  );
}

function FocalStep({
  register,
  errors,
}: {
  register: UseFormRegister<RegistrationFormInput>;
  errors: FieldErrors<RegistrationFormInput>;
}): React.JSX.Element {
  return (
    <Card className="p-4 sm:p-5 space-y-4 max-w-full">
      <p className="text-sm text-mute">
        Quem será o ponto focal do dia a dia com a DRYOS?
      </p>
      <Field label="Nome" error={fieldMessage(errors, "focal_point_name")}>
        <input className={inputClass} {...register("focal_point_name")} />
      </Field>
      <Field label="E-mail" error={fieldMessage(errors, "focal_point_email")}>
        <input
          className={inputClass}
          type="email"
          inputMode="email"
          {...register("focal_point_email")}
        />
      </Field>
      <Field label="WhatsApp / telefone" error={fieldMessage(errors, "focal_point_phone")}>
        <input
          className={inputClass}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          {...register("focal_point_phone")}
        />
      </Field>
    </Card>
  );
}

function FinancialStep({
  register,
  errors,
}: {
  register: UseFormRegister<RegistrationFormInput>;
  errors: FieldErrors<RegistrationFormInput>;
}): React.JSX.Element {
  return (
    <Card className="p-4 sm:p-5 space-y-4 max-w-full">
      <p className="text-sm text-mute">Contato para nota fiscal e cobrança.</p>
      <Field label="Nome" error={fieldMessage(errors, "financial_contact_name")}>
        <input className={inputClass} {...register("financial_contact_name")} />
      </Field>
      <Field label="E-mail" error={fieldMessage(errors, "financial_contact_email")}>
        <input
          className={inputClass}
          type="email"
          inputMode="email"
          {...register("financial_contact_email")}
        />
      </Field>
      <Field label="Telefone" error={fieldMessage(errors, "financial_contact_phone")}>
        <input
          className={inputClass}
          type="tel"
          inputMode="tel"
          {...register("financial_contact_phone")}
        />
      </Field>
    </Card>
  );
}

function ToolsStep({
  register,
  fields,
  append,
  remove,
}: {
  register: UseFormRegister<RegistrationFormInput>;
  fields: { id: string }[];
  append: (v: { name: string; purpose: string; url?: string }) => void;
  remove: (index: number) => void;
}): React.JSX.Element {
  return (
    <Card className="p-4 sm:p-5 space-y-4 max-w-full">
      <p className="text-sm text-mute">
        Opcional: ferramentas que você já usa hoje.
      </p>
      {fields.map((field, index) => (
        <div key={field.id} className="border border-line rounded p-3 space-y-2 max-w-full">
          <div className="flex justify-between items-center">
            <span className="font-mono text-[10px] text-mute">#{index + 1}</span>
            <button
              type="button"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-mute hover:text-critical"
              aria-label="Remover ferramenta"
              onClick={() => remove(index)}
            >
              <Trash2 className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>
          <input
            className={inputClass}
            placeholder="Nome da ferramenta"
            {...register(`software_items.${index}.name`)}
          />
          <input
            className={inputClass}
            placeholder="Link (opcional)"
            inputMode="url"
            {...register(`software_items.${index}.url`)}
          />
          <input
            className={inputClass}
            placeholder="Para que usa"
            {...register(`software_items.${index}.purpose`)}
          />
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        className="w-full min-h-[44px] justify-center"
        onClick={() => append({ name: "", purpose: "", url: "" })}
      >
        <Plus className="w-4 h-4" strokeWidth={1.75} />
        Adicionar ferramenta
      </Button>
    </Card>
  );
}

function ReviewStep({
  register,
  errors,
  watch,
  personType,
}: {
  register: UseFormRegister<RegistrationFormInput>;
  errors: FieldErrors<RegistrationFormInput>;
  watch: UseFormWatch<RegistrationFormInput>;
  personType: "pf" | "pj";
}): React.JSX.Element {
  const street = watch("address_street");
  const number = watch("address_number");
  const city = watch("address_city");
  const state = watch("address_state");
  const focalName = watch("focal_point_name");
  const focalEmail = watch("focal_point_email");
  return (
    <Card className="p-4 sm:p-5 space-y-4 max-w-full">
      <h2 className="font-display text-base text-ink font-semibold">
        Revise seus dados
      </h2>
      <div className="text-sm text-ink-soft space-y-2 break-words">
        {personType === "pf" ? (
          <p>
            <span className="text-mute font-mono text-[10px] uppercase block">PF</span>
            {String(watch("full_name") ?? "")} · CPF {String(watch("cpf") ?? "")}
          </p>
        ) : (
          <p>
            <span className="text-mute font-mono text-[10px] uppercase block">PJ</span>
            {String(watch("legal_name") ?? "")} · CNPJ {String(watch("cnpj") ?? "")}
          </p>
        )}
        <p>
          <span className="text-mute font-mono text-[10px] uppercase block">
            Endereço
          </span>
          {String(street ?? "")}, {String(number ?? "")} — {String(city ?? "")}/
          {String(state ?? "")}
        </p>
        <p>
          <span className="text-mute font-mono text-[10px] uppercase block">
            Ponto focal
          </span>
          {String(focalName ?? "")} · {String(focalEmail ?? "")}
        </p>
      </div>
      <label className="flex gap-3 items-start text-sm min-h-[44px] pt-1">
        <input type="checkbox" className="mt-2.5 shrink-0" {...register("lgpd_consent")} />
        <span>
          Autorizo o tratamento dos meus dados conforme a LGPD, exclusivamente
          para formalização do contrato e comunicações da DRYOS.
        </span>
      </label>
      {errors.lgpd_consent && (
        <p className="text-xs text-critical">{errors.lgpd_consent.message}</p>
      )}
    </Card>
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
    <div className="max-w-full">
      <span className={labelClass}>{label}</span>
      {children}
      {error && <p className="text-xs text-critical mt-1">{error}</p>}
    </div>
  );
}

function GridTwo({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-full">{children}</div>
  );
}
