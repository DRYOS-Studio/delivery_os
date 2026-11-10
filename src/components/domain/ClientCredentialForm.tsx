"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  createClientCredentialAction,
  updateClientCredentialAction,
} from "@/lib/actions/client-credentials";
import type { ClientCredentialListRow } from "@/lib/db/queries/client-credentials";
import { Button } from "@/components/ui/Button";

const inputCn =
  "w-full rounded border border-line bg-cream-paper px-3 py-2 text-sm";

type OperationOption = { id: string; name: string };

type Props = {
  clientId: string;
  operations: OperationOption[];
  credential?: ClientCredentialListRow;
};

export function ClientCredentialForm({
  clientId,
  operations,
  credential,
}: Props): React.JSX.Element {
  const router = useRouter();
  const isEdit = Boolean(credential);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setError(null);
    setBusy(true);
    const res = isEdit
      ? await updateClientCredentialAction(
          clientId,
          credential!.id,
          formData,
        )
      : await createClientCredentialAction(clientId, formData);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.push(`/clients/${clientId}/cofre`);
    router.refresh();
  }

  return (
    <div className="max-w-xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg text-ink font-semibold">
          {isEdit ? "Editar credencial" : "Nova credencial"}
        </h2>
        <Link
          href={`/clients/${clientId}/cofre`}
          className="text-sm text-oak hover:underline"
        >
          Voltar
        </Link>
      </div>
      {error && (
        <p className="text-sm text-critical" role="alert">
          {error}
        </p>
      )}
      <form action={onSubmit} className="grid gap-3">
        <Field label="Serviço / nome" htmlFor="service_name" required>
          <input
            id="service_name"
            name="service_name"
            required
            defaultValue={credential?.serviceName ?? ""}
            className={inputCn}
            disabled={busy}
          />
        </Field>
        <Field label="URL" htmlFor="url">
          <input
            id="url"
            name="url"
            type="url"
            defaultValue={credential?.url ?? ""}
            className={inputCn}
            disabled={busy}
          />
        </Field>
        <Field label="Login / usuário" htmlFor="login_username">
          <input
            id="login_username"
            name="login_username"
            autoComplete="off"
            defaultValue={credential?.loginUsername ?? ""}
            className={inputCn}
            disabled={busy}
          />
        </Field>
        <Field
          label={isEdit ? "Nova senha (deixe vazio para manter)" : "Senha"}
          htmlFor="password"
          required={!isEdit}
        >
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required={!isEdit}
            className={inputCn}
            disabled={busy}
          />
        </Field>
        <Field label="Notas (secretas)" htmlFor="notes">
          <textarea
            id="notes"
            name="notes"
            rows={3}
            className={inputCn}
            disabled={busy}
            placeholder={isEdit ? "Deixe vazio para não alterar" : undefined}
          />
        </Field>
        <Field label="2FA / observações (secretas)" htmlFor="two_factor_notes">
          <textarea
            id="two_factor_notes"
            name="two_factor_notes"
            rows={2}
            className={inputCn}
            disabled={busy}
            placeholder={isEdit ? "Deixe vazio para não alterar" : undefined}
          />
        </Field>
        <Field label="Operação (opcional)" htmlFor="operation_id">
          <select
            id="operation_id"
            name="operation_id"
            className={inputCn}
            defaultValue={credential?.operationId ?? ""}
            disabled={busy}
          >
            <option value="">— Nenhuma —</option>
            {operations.map((op) => (
              <option key={op.id} value={op.id}>
                {op.name}
              </option>
            ))}
          </select>
        </Field>
        <Button type="submit" variant="sage" disabled={busy} className="min-h-[44px]">
          {busy ? "Salvando…" : "Salvar"}
        </Button>
      </form>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-xs text-mute mb-1">
        {label}
        {required ? " *" : ""}
      </label>
      {children}
    </div>
  );
}
