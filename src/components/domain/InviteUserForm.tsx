"use client";

import { MailPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { inviteUserAction } from "@/lib/actions/admin-users";
import type {
  OperationPickItem,
  PersonPickItem,
} from "@/lib/db/queries/admin-directory";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/MultiSelect";
import { Card } from "@/components/ui/Card";

type Props = {
  operations: OperationPickItem[];
  persons: PersonPickItem[];
};

export function InviteUserForm({ operations, persons }: Props): React.JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [personId, setPersonId] = useState("");
  const [operationIds, setOperationIds] = useState<string[]>([]);

  const opOptions: MultiSelectOption[] = operations.map((o) => ({
    id: o.id,
    name: `${o.name} · ${o.clientName}`,
  }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData();
    fd.set("email", email.trim());
    fd.set("name", name.trim());
    fd.set("role", role);
    if (personId) fd.set("person_id", personId);
    for (const id of operationIds) {
      fd.append("operation_ids", id);
    }
    const result = await inviteUserAction(fd);
    if (!result.ok) {
      window.alert(`Erro: ${result.error}`);
      setBusy(false);
      return;
    }
    const data = result.data;
    if (data.mode === "created_confirmed" && data.tempPassword) {
      window.alert(
        `Conta criada e e-mail confirmado. Senha temporária (copie agora; não será mostrada de novo):\n\n${data.tempPassword}`,
      );
    } else {
      window.alert(
        data.mode === "invited"
          ? "Convite enviado por e-mail."
          : "Usuário atualizado (já existia no Auth).",
      );
    }
    setEmail("");
    setName("");
    setPersonId("");
    setOperationIds([]);
    setRole("member");
    setBusy(false);
    router.refresh();
  }

  return (
    <Card className="mb-6 p-4">
      <div className="flex items-center gap-2 mb-4">
        <MailPlus className="w-5 h-5 text-sage-deep" strokeWidth={1.75} />
        <h3 className="font-display text-base text-ink font-semibold">
          Convidar usuário
        </h3>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="block text-xs font-mono text-mute-soft mb-1">E-mail</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              disabled={busy}
              className="w-full rounded border border-line bg-card px-3 py-2 text-sm text-ink-soft focus:border-line-strong focus:outline-none disabled:opacity-50"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-mono text-mute-soft mb-1">
              Nome no perfil
            </span>
            <input
              type="text"
              required
              autoComplete="name"
              value={name}
              onChange={(ev) => setName(ev.target.value)}
              disabled={busy}
              className="w-full rounded border border-line bg-card px-3 py-2 text-sm text-ink-soft focus:border-line-strong focus:outline-none disabled:opacity-50"
            />
          </label>
        </div>
        <label className="block">
          <span className="block text-xs font-mono text-mute-soft mb-1">
            Pessoa (opcional)
          </span>
          <select
            value={personId}
            onChange={(ev) => setPersonId(ev.target.value)}
            disabled={busy}
            className="w-full rounded border border-line bg-card px-3 py-2 text-sm text-ink-soft focus:border-line-strong focus:outline-none disabled:opacity-50"
          >
            <option value="">— sem vínculo —</option>
            {persons.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.kind === "internal" ? "interna" : "externa"})
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="block text-xs font-mono text-mute-soft mb-1">Papel</span>
            <select
              value={role}
              onChange={(ev) =>
                setRole(ev.target.value === "admin" ? "admin" : "member")
              }
              disabled={busy}
              className="w-full rounded border border-line bg-card px-3 py-2 text-sm text-ink-soft focus:border-line-strong focus:outline-none disabled:opacity-50"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <div className="text-xs text-mute-soft pt-6 sm:pt-0 sm:flex sm:items-end">
            Membro exige ao menos uma Operação. Admins não usam fila por operação.
          </div>
        </div>
        {role === "member" && (
          <div>
            <span className="block text-xs font-mono text-mute-soft mb-1">
              Operações (acesso)
            </span>
            <MultiSelect
              options={opOptions}
              value={operationIds}
              onChange={setOperationIds}
              placeholder="Selecione operações…"
              disabled={busy}
              emptyText="Nenhuma operação ativa."
            />
          </div>
        )}
        <div className="flex flex-wrap gap-3 items-end">
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded bg-oak text-white px-4 py-2 text-sm font-medium hover:opacity-95 disabled:opacity-50"
          >
            {busy ? "Enviando…" : "Convidar ou sincronizar"}
          </button>
        </div>
      </form>
    </Card>
  );
}
