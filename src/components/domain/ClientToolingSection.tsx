"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { OptionalHttpsLink } from "@/components/domain/OptionalHttpsLink";
import { RepositoryLinksPanel } from "@/components/domain/RepositoryLinksPanel";
import { Button } from "@/components/ui/Button";
import {
  createClientSoftwareItemAction,
  createClientTechItemAction,
  deleteClientSoftwareItemAction,
  deleteClientTechItemAction,
  updateClientSoftwareItemAction,
  updateClientTechItemAction,
} from "@/lib/actions/client-tooling";
import type {
  ClientSoftwareItemRow,
  ClientTechItemRow,
} from "@/lib/db/queries/client-tooling";
import type { RepositoryLinkRow } from "@/lib/db/queries/repository-links";

type Props = {
  clientId: string;
  isAdmin: boolean;
  repoLinks: RepositoryLinkRow[];
  techItems: ClientTechItemRow[];
  softwareItems: ClientSoftwareItemRow[];
};

const inputCn =
  "w-full rounded border border-line bg-cream-paper px-3 py-2 text-sm text-ink disabled:opacity-50";

export function ClientToolingSection({
  clientId,
  isAdmin,
  repoLinks,
  techItems,
  softwareItems,
}: Props): React.JSX.Element {
  const [showTechForm, setShowTechForm] = useState(false);
  const [showSoftwareForm, setShowSoftwareForm] = useState(false);
  return (
    <section className="mb-9">
      <h2 className="font-display text-lg text-ink font-semibold mb-2">
        Tecnologia &amp; ferramentas
      </h2>
      <p className="text-sm text-mute mb-6">
        Referências do ecossistema do cliente — sem senhas nem tokens. Softwares
        são ferramentas que o cliente já utiliza (ex.: automação, CRM); cadastre
        o nome em texto livre e, quando souber, o link de acesso ao workspace do
        cliente.
      </p>

      <div className="space-y-8">
        <RepositoryLinksPanel
          scope={{ kind: "client", clientId }}
          displayLinks={repoLinks}
          manageableLinks={repoLinks}
          canManageLocal={isAdmin}
          hint="Múltiplos repositórios no nível do cliente. Operações e Frentes podem ter links próprios nas respectivas telas."
        />

        <ToolingBlock
          title="Stack técnica"
          subtitle="Linguagens, frameworks, cloud, dados — desenvolvimento e infra."
          isAdmin={isAdmin}
        >
          {techItems.length === 0 ? (
            <p className="text-sm text-mute">Nenhuma tecnologia cadastrada.</p>
          ) : (
            <ul className="space-y-3">
              {techItems.map((item) => (
                <EditableToolingRow
                  key={item.id}
                  name={item.name}
                  meta={item.category}
                  notes={item.notes}
                  url={item.url}
                  isAdmin={isAdmin}
                  fieldMeta="category"
                  metaPlaceholder="Categoria"
                  urlHint={undefined}
                  onDelete={() => deleteClientTechItemAction(item.id, clientId)}
                  onSave={(fd) =>
                    updateClientTechItemAction(item.id, clientId, fd)
                  }
                />
              ))}
            </ul>
          )}
          {isAdmin && !showTechForm && (
            <Button
              type="button"
              size="sm"
              variant="primary"
              className="mt-4"
              onClick={() => setShowTechForm(true)}
            >
              Adicionar tecnologia
            </Button>
          )}
          {isAdmin && showTechForm && (
            <InlineTechForm
              clientId={clientId}
              disabled={false}
              onClose={() => setShowTechForm(false)}
            />
          )}
        </ToolingBlock>

        <ToolingBlock
          title="Softwares do cliente"
          subtitle="Ferramentas operacionais/comerciais que o cliente já usa."
          isAdmin={isAdmin}
        >
          {softwareItems.length === 0 ? (
            <p className="text-sm text-mute">Nenhum software cadastrado.</p>
          ) : (
            <ul className="space-y-3">
              {softwareItems.map((item) => (
                <EditableToolingRow
                  key={item.id}
                  name={item.name}
                  meta={item.purpose}
                  notes={item.notes}
                  url={item.url}
                  isAdmin={isAdmin}
                  fieldMeta="purpose"
                  metaPlaceholder="Finalidade"
                  urlHint="Acesso ao sistema"
                  onDelete={() =>
                    deleteClientSoftwareItemAction(item.id, clientId)
                  }
                  onSave={(fd) =>
                    updateClientSoftwareItemAction(item.id, clientId, fd)
                  }
                />
              ))}
            </ul>
          )}
          {isAdmin && !showSoftwareForm && (
            <Button
              type="button"
              size="sm"
              variant="primary"
              className="mt-4"
              onClick={() => setShowSoftwareForm(true)}
            >
              Adicionar software
            </Button>
          )}
          {isAdmin && showSoftwareForm && (
            <InlineSoftwareForm
              clientId={clientId}
              disabled={false}
              onClose={() => setShowSoftwareForm(false)}
            />
          )}
        </ToolingBlock>
      </div>
    </section>
  );
}

function ToolingBlock({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-line rounded p-4 bg-card">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="text-xs text-mute mb-4">{subtitle}</p>
      {children}
    </div>
  );
}

function EditableToolingRow({
  name,
  meta,
  notes,
  url,
  urlHint,
  isAdmin,
  fieldMeta,
  metaPlaceholder,
  onDelete,
  onSave,
}: {
  name: string;
  meta: string | null;
  notes: string | null;
  url: string | null;
  urlHint?: string | undefined;
  isAdmin: boolean;
  fieldMeta: "category" | "purpose";
  metaPlaceholder: string;
  onDelete: () => Promise<{ ok: boolean; error?: string }>;
  onSave: (
    fd: FormData,
  ) => Promise<{ ok: boolean; error?: string }>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!globalThis.confirm(`Remover "${name}"?`)) return;
    setBusy(true);
    const res = await onDelete();
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Falha ao remover.");
      return;
    }
    router.refresh();
  }

  async function handleSave(formData: FormData) {
    setError(null);
    setBusy(true);
    const res = await onSave(formData);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Falha ao salvar.");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  if (editing && isAdmin) {
    return (
      <li className="border-b border-line pb-3 last:border-0">
        <form action={handleSave} className="grid gap-2 max-w-xl">
          {error && (
            <p className="text-sm text-critical" role="alert">
              {error}
            </p>
          )}
          <input
            name="name"
            required
            defaultValue={name}
            className={inputCn}
            disabled={busy}
          />
          <input
            name={fieldMeta}
            defaultValue={meta ?? ""}
            placeholder={metaPlaceholder}
            className={inputCn}
            disabled={busy}
          />
          <input
            name="url"
            type="url"
            defaultValue={url ?? ""}
            className={inputCn}
            disabled={busy}
          />
          <input
            name="notes"
            defaultValue={notes ?? ""}
            className={inputCn}
            disabled={busy}
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" variant="primary" disabled={busy}>
              Salvar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => setEditing(false)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-1 border-b border-line pb-3 last:border-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-ink">{name}</span>
        {meta && (
          <span className="font-mono text-[10px] uppercase tracking-wide text-mute">
            {meta}
          </span>
        )}
        {isAdmin && (
          <div className="ml-auto flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => setEditing(true)}
            >
              Editar
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-critical"
              disabled={busy}
              onClick={handleDelete}
            >
              Remover
            </Button>
          </div>
        )}
      </div>
      {url && (
        <div className="flex items-center gap-2 text-xs text-mute">
          {urlHint && <span>{urlHint}:</span>}
          <OptionalHttpsLink url={url} />
        </div>
      )}
      {notes && <p className="text-xs text-mute">{notes}</p>}
      {error && !editing && (
        <p className="text-sm text-critical" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}

function InlineTechForm({
  clientId,
  disabled,
  onClose,
}: {
  clientId: string;
  disabled: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(formData: FormData) {
    setError(null);
    setBusy(true);
    const res = await createClientTechItemAction(clientId, formData);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    ref.current?.reset();
    onClose();
    router.refresh();
  }

  return (
    <form ref={ref} action={onSubmit} className="grid gap-2 mt-4 max-w-xl">
      {error && (
        <p className="text-sm text-critical" role="alert">
          {error}
        </p>
      )}
      <input
        name="name"
        required
        placeholder="Tecnologia (ex: PostgreSQL)"
        className={inputCn}
        disabled={disabled || busy}
      />
      <input
        name="category"
        placeholder="Categoria (ex: banco, cloud)"
        className={inputCn}
        disabled={disabled || busy}
      />
      <input
        name="url"
        type="url"
        placeholder="Link opcional (https)"
        className={inputCn}
        disabled={disabled || busy}
      />
      <input
        name="notes"
        placeholder="Notas (opcional)"
        className={inputCn}
        disabled={disabled || busy}
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="primary" disabled={disabled || busy}>
          Salvar
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={onClose}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function InlineSoftwareForm({
  clientId,
  disabled,
  onClose,
}: {
  clientId: string;
  disabled: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(formData: FormData) {
    setError(null);
    setBusy(true);
    const res = await createClientSoftwareItemAction(clientId, formData);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    ref.current?.reset();
    onClose();
    router.refresh();
  }

  return (
    <form ref={ref} action={onSubmit} className="grid gap-2 mt-4 max-w-xl">
      {error && (
        <p className="text-sm text-critical" role="alert">
          {error}
        </p>
      )}
      <input
        name="name"
        required
        placeholder="Software (nome livre)"
        className={inputCn}
        disabled={disabled || busy}
      />
      <input
        name="purpose"
        placeholder="Finalidade no cliente (ex: CRM, automação WhatsApp)"
        className={inputCn}
        disabled={disabled || busy}
      />
      <input
        name="url"
        type="url"
        placeholder="URL de acesso ao workspace/sistema do cliente (opcional)"
        className={inputCn}
        disabled={disabled || busy}
      />
      <input
        name="notes"
        placeholder="Notas (opcional)"
        className={inputCn}
        disabled={disabled || busy}
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="primary" disabled={disabled || busy}>
          Salvar
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={onClose}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
