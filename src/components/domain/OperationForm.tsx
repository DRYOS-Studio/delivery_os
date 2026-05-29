"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import {
  archiveOperationAction,
  createOperationAction,
  updateOperationAction,
} from "@/lib/actions/operations";
import type { OperationDetail } from "@/lib/db/queries/operations";
import { formatMoneyBR, parseMoneyBR } from "@/lib/utils/money";
import {
  operationSchema,
  type OperationInput,
  type OperationOutput,
} from "@/lib/validators/operation";

type ClientForSelect = { id: string; name: string };

type DiagnosticOption = { id: string; clientId: string; label: string };

type Props =
  | {
      mode: "create";
      clientsForSelect: ClientForSelect[];
      diagnosticsByClient: DiagnosticOption[];
      isAdmin?: boolean;
    }
  | {
      mode: "edit";
      initialData: OperationDetail;
      clientsForSelect: ClientForSelect[];
      canArchive: boolean;
      diagnosticsByClient: DiagnosticOption[];
      isAdmin?: boolean;
    };

const PRODUCT_LINE_LABEL: Record<"core" | "spark" | "studio", string> = {
  core: "Core",
  spark: "Spark",
  studio: "Studio",
};

function nameFromCombo(clientName: string, line: string): string {
  if (!clientName || !line) return "";
  const lineLabel = PRODUCT_LINE_LABEL[line as "core" | "spark" | "studio"];
  return `${clientName} ${lineLabel}`;
}

export function OperationForm(props: Props): React.JSX.Element {
  const router = useRouter();
  const isEdit = props.mode === "edit";
  const isAdmin = props.isAdmin ?? false;
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [mrrInput, setMrrInput] = useState(
    isEdit
      ? formatMrrInput(props.initialData.monthlyRecurringRevenue)
      : "",
  );
  const [fixedCostInput, setFixedCostInput] = useState(
    isEdit
      ? formatMrrInput(props.initialData.monthlyFixedCost ?? null)
      : "",
  );
  const [nameTouched, setNameTouched] = useState(isEdit);

  const defaultValues: OperationInput = isEdit
    ? {
        client_id: props.initialData.client.id,
        product_line: props.initialData.productLine,
        name: props.initialData.name,
        status:
          props.initialData.status === "arquivada"
            ? "em_operacao"
            : props.initialData.status,
        recurrence: props.initialData.recurrence ?? undefined,
        monthly_recurring_revenue:
          props.initialData.monthlyRecurringRevenue ?? null,
        monthly_fixed_cost:
          props.initialData.monthlyFixedCost ?? null,
        response_hours: props.initialData.responseHours ?? undefined,
        resolution_hours: props.initialData.resolutionHours ?? undefined,
        diagnostic_id: props.initialData.diagnosticId ?? undefined,
        start_date: props.initialData.startDate ?? undefined,
        end_date: props.initialData.endDate ?? undefined,
        notification_webhook_url:
          props.initialData.notificationWebhookUrl ?? undefined,
      }
    : {
        client_id: "",
        product_line: "core",
        name: "",
        status: "em_construcao",
        recurrence: undefined,
        monthly_recurring_revenue: null,
        monthly_fixed_cost: null,
        response_hours: undefined,
        resolution_hours: undefined,
        diagnostic_id: undefined,
        start_date: undefined,
        end_date: undefined,
        notification_webhook_url: undefined,
      };

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<OperationInput, undefined, OperationOutput>({
    resolver: zodResolver(operationSchema),
    defaultValues,
  });

  const busy = isSubmitting || isArchiving;

  const watchedClientId = watch("client_id");
  const watchedLine = watch("product_line");

  useEffect(() => {
    if (nameTouched) return;
    const client = props.clientsForSelect.find(
      (c) => c.id === watchedClientId,
    );
    if (!client || !watchedLine) return;
    setValue("name", nameFromCombo(client.name, watchedLine), {
      shouldDirty: true,
    });
  }, [watchedClientId, watchedLine, nameTouched, setValue, props.clientsForSelect]);

  async function onSubmit(data: OperationOutput) {
    setGeneralError(null);
    const fd = new FormData();
    fd.set("client_id", data.client_id);
    fd.set("product_line", data.product_line);
    fd.set("name", data.name);
    fd.set("status", data.status);
    fd.set("recurrence", data.recurrence ?? "");
    fd.set(
      "monthly_recurring_revenue",
      data.monthly_recurring_revenue !== null &&
        data.monthly_recurring_revenue !== undefined
        ? String(data.monthly_recurring_revenue)
        : "",
    );
    fd.set(
      "monthly_fixed_cost",
      data.monthly_fixed_cost !== null && data.monthly_fixed_cost !== undefined
        ? String(data.monthly_fixed_cost)
        : "",
    );
    fd.set(
      "response_hours",
      data.response_hours !== undefined && data.response_hours !== null
        ? String(data.response_hours)
        : "",
    );
    fd.set(
      "resolution_hours",
      data.resolution_hours !== undefined && data.resolution_hours !== null
        ? String(data.resolution_hours)
        : "",
    );
    fd.set("diagnostic_id", data.diagnostic_id ?? "");
    fd.set("start_date", data.start_date ?? "");
    fd.set("end_date", data.end_date ?? "");
    fd.set("notification_webhook_url", data.notification_webhook_url ?? "");

    const result = isEdit
      ? await updateOperationAction(props.initialData.id, fd)
      : await createOperationAction(fd);

    if (result.ok) {
      const id = isEdit ? props.initialData.id : result.data.id;
      router.push(`/operations/${id}`);
      router.refresh();
      return;
    }
    mapErrorToFields(result.code, result.error, setError, setGeneralError);
  }

  async function handleArchive() {
    if (!isEdit || !props.canArchive) return;
    if (!window.confirm("Arquivar esta Operação?")) return;
    setIsArchiving(true);
    setGeneralError(null);
    const result = await archiveOperationAction(props.initialData.id);
    if (result.ok) {
      router.push("/operations");
      router.refresh();
    } else {
      setGeneralError(result.error);
      setIsArchiving(false);
    }
  }

  const allowedStatus: { value: OperationInput["status"]; label: string }[] = [
    { value: "em_construcao", label: "Em construção" },
    { value: "em_operacao", label: "Em operação" },
    ...(isEdit
      ? [{ value: "janela_critica" as const, label: "Janela crítica" }]
      : []),
  ];

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4 max-w-2xl"
    >
      {generalError && (
        <div className="bg-critical-bg border border-critical text-critical text-sm rounded px-3 py-2">
          {generalError}
        </div>
      )}

      <Field
        label="Cliente"
        htmlFor="client_id"
        required
        error={errors.client_id?.message}
      >
        <select
          id="client_id"
          {...register("client_id")}
          disabled={busy || isEdit}
          className={selectCn}
        >
          <option value="">Selecione…</option>
          {props.clientsForSelect.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {isEdit && (
          <p className="font-mono text-[10px] text-mute-soft">
            Cliente não pode mudar. Pra trocar, crie nova Operação.
          </p>
        )}
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field
          label="Linha de produto"
          htmlFor="product_line"
          required
          error={errors.product_line?.message}
        >
          <select
            id="product_line"
            {...register("product_line")}
            disabled={busy}
            className={selectCn}
          >
            <option value="core">Core</option>
            <option value="spark">Spark</option>
            <option value="studio">Studio</option>
          </select>
        </Field>

        <Field
          label="Status"
          htmlFor="status"
          required
          error={errors.status?.message}
        >
          <select
            id="status"
            {...register("status")}
            disabled={busy}
            className={selectCn}
          >
            {allowedStatus.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field
        label="Nome da Operação"
        htmlFor="name"
        required
        error={errors.name?.message}
        hint={!isEdit ? "Sugerido a partir do cliente + linha. Editável." : undefined}
      >
        <input
          id="name"
          type="text"
          {...register("name", {
            onChange: () => setNameTouched(true),
          })}
          disabled={busy}
          className={inputCn}
        />
      </Field>

      {isAdmin ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              label="Recorrência"
              htmlFor="recurrence"
              error={errors.recurrence?.message}
            >
              <select
                id="recurrence"
                {...register("recurrence")}
                disabled={busy}
                className={selectCn}
              >
                <option value="">—</option>
                <option value="mensal">Mensal</option>
                <option value="trimestral">Trimestral</option>
                <option value="anual">Anual</option>
                <option value="unica">Única</option>
              </select>
            </Field>

            <Field
              label="MRR (Receita recorrente mensal)"
              htmlFor="mrr"
              error={errors.monthly_recurring_revenue?.message}
              hint='Aceita "R$ 8.500,00", "8500" etc.'
            >
              <input
                id="mrr"
                type="text"
                inputMode="decimal"
                value={mrrInput}
                onChange={(e) => {
                  const raw = e.target.value;
                  setMrrInput(raw);
                  const parsed = parseMoneyBR(raw);
                  setValue("monthly_recurring_revenue", parsed, {
                    shouldValidate: true,
                  });
                }}
                placeholder="R$ 0,00"
                disabled={busy}
                className={inputCn}
              />
            </Field>
          </div>

          <Field
            label="Custo fixo mensal"
            htmlFor="monthly_fixed_cost"
            error={errors.monthly_fixed_cost?.message}
            hint="Hospedagem, infra etc. Custos de pessoas vêm das alocações."
          >
            <input
              id="monthly_fixed_cost"
              type="text"
              inputMode="decimal"
              value={fixedCostInput}
              onChange={(e) => {
                const raw = e.target.value;
                setFixedCostInput(raw);
                const parsed = parseMoneyBR(raw);
                setValue("monthly_fixed_cost", parsed, {
                  shouldValidate: true,
                });
              }}
              placeholder="R$ 0,00"
              disabled={busy}
              className={inputCn}
            />
          </Field>
        </>
      ) : (
        <>
          <input type="hidden" {...register("recurrence")} />
          <input
            type="hidden"
            {...register("monthly_recurring_revenue")}
          />
          <input type="hidden" {...register("monthly_fixed_cost")} />
        </>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field
          label="SLA — Resposta (horas)"
          htmlFor="response_hours"
          error={errors.response_hours?.message}
          hint="Tempo prometido pra primeira resposta. Em branco = sem SLA."
        >
          <input
            id="response_hours"
            type="number"
            min={0}
            max={720}
            step={1}
            {...register("response_hours")}
            disabled={busy}
            placeholder="4"
            className={inputCn}
          />
        </Field>

        <Field
          label="SLA — Resolução (horas)"
          htmlFor="resolution_hours"
          error={errors.resolution_hours?.message}
          hint="Tempo prometido pra resolução total. Em branco = sem SLA."
        >
          <input
            id="resolution_hours"
            type="number"
            min={0}
            max={720}
            step={1}
            {...register("resolution_hours")}
            disabled={busy}
            placeholder="24"
            className={inputCn}
          />
        </Field>
      </div>

      <Field
        label="Diagnóstico de origem"
        htmlFor="diagnostic_id"
        error={errors.diagnostic_id?.message}
        hint={
          watchedClientId
            ? props.diagnosticsByClient.some(
                (d) => d.clientId === watchedClientId,
              )
              ? "Linkar esta Operação ao diagnóstico do cliente."
              : "Cliente sem diagnóstico registrado."
            : "Selecione um cliente primeiro."
        }
      >
        <select
          id="diagnostic_id"
          {...register("diagnostic_id")}
          disabled={busy}
          className={selectCn}
        >
          <option value="">— Sem diagnóstico vinculado —</option>
          {props.diagnosticsByClient
            .filter((d) => d.clientId === watchedClientId)
            .map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
        </select>
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field
          label="Data de início"
          htmlFor="start_date"
          error={errors.start_date?.message}
        >
          <input
            id="start_date"
            type="date"
            {...register("start_date")}
            disabled={busy}
            className={inputCn}
          />
        </Field>

        <Field
          label="Data de fim"
          htmlFor="end_date"
          error={errors.end_date?.message}
          hint="Frentes Tipo C/E (contínuo) não têm fim."
        >
          <input
            id="end_date"
            type="date"
            {...register("end_date")}
            disabled={busy}
            className={inputCn}
          />
        </Field>
      </div>

      <fieldset className="border-t border-line pt-5 mt-2">
        <legend className="font-display text-sm font-semibold text-ink mb-3 px-0">
          Integrações
        </legend>
        <Field
          label="Webhook de notificação (n8n)"
          htmlFor="notification_webhook_url"
          error={errors.notification_webhook_url?.message}
          hint="URL pra onde DRYOS posta eventos (Frente parada, SLA estourado). Deixe em branco pra desligar."
        >
          <input
            id="notification_webhook_url"
            type="url"
            placeholder="https://n8n.exemplo.com/webhook/dryos-..."
            {...register("notification_webhook_url")}
            disabled={busy}
            className={inputCn}
          />
        </Field>
      </fieldset>

      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <Button type="submit" variant="primary" disabled={busy}>
            {isSubmitting ? "Salvando..." : isEdit ? "Salvar" : "Criar operação"}
          </Button>
          <Link href={isEdit ? `/operations/${props.initialData.id}` : "/operations"}>
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

function formatMrrInput(value: number | null): string {
  if (value === null || value === undefined) return "";
  return formatMoneyBR(value);
}

function mapErrorToFields(
  code: string | undefined,
  message: string,
  setError: ReturnType<typeof useForm<OperationInput>>["setError"],
  setGeneral: (m: string | null) => void,
): void {
  if (!code) return setGeneral(message);
  if (code.startsWith("validation_")) {
    const field = code.replace("validation_", "") as keyof OperationInput;
    setError(field, { message });
    return;
  }
  if (code === "invalid_client") {
    setError("client_id", { message });
    return;
  }
  setGeneral(message);
}

const inputCn =
  "w-full bg-card border border-line rounded px-3 py-2 text-sm text-ink-soft placeholder:text-mute-soft focus:outline-none focus:border-line-strong disabled:opacity-50 disabled:cursor-not-allowed";
const selectCn = inputCn;

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
