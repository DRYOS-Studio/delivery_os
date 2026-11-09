"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pill } from "@/components/ui/Pill";
import {
  cancelRegistrationInvitationAction,
  copyRegistrationInvitationLinkAction,
  regenerateRegistrationInvitationTokenAction,
} from "@/lib/actions/client-registration";
import type { RegistrationInvitationListItem } from "@/lib/db/queries/client-registration-invitations";
import { formatDateBR } from "@/lib/utils/date";
import { Button } from "@/components/ui/Button";

const STATUS_PILL: Record<
  RegistrationInvitationListItem["status"],
  { label: string; variant: "neutral" | "warning" | "ok" | "critical" | "sage" }
> = {
  enviado: { label: "Enviado", variant: "neutral" },
  preenchido: { label: "Preenchido", variant: "warning" },
  aprovado: { label: "Aprovado", variant: "ok" },
  expirado: { label: "Expirado", variant: "critical" },
  cancelado: { label: "Cancelado", variant: "critical" },
};

type Props = {
  items: RegistrationInvitationListItem[];
};

export function RegistrationInvitesTable({ items }: Props): React.JSX.Element {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function runAction(
    id: string,
    action: "copy" | "cancel" | "regenerate",
  ): Promise<void> {
    setBusyId(id);
    setMessage(null);
    if (action === "copy") {
      const result = await copyRegistrationInvitationLinkAction(id);
      if (result.ok) {
        await navigator.clipboard.writeText(result.data.registrationUrl);
        setMessage("Link copiado.");
      } else {
        setMessage(result.error);
      }
    } else if (action === "cancel") {
      if (!window.confirm("Cancelar este convite?")) {
        setBusyId(null);
        return;
      }
      const result = await cancelRegistrationInvitationAction(id);
      if (!result.ok) setMessage(result.error);
      else router.refresh();
    } else {
      const result = await regenerateRegistrationInvitationTokenAction(id);
      if (result.ok) {
        await navigator.clipboard.writeText(result.data.registrationUrl);
        setMessage("Novo link gerado e copiado.");
        router.refresh();
      } else {
        setMessage(result.error);
      }
    }
    setBusyId(null);
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-mute py-8 text-center">
        Nenhum convite de cadastro ainda.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {message && (
        <p className="text-sm text-mute font-mono text-[11px]">{message}</p>
      )}
      <ul className="bg-card border border-line rounded shadow-sm divide-y divide-line">
        {items.map((item) => {
          const pill = STATUS_PILL[item.status];
          const busy = busyId === item.id;
          return (
            <li
              key={item.id}
              className="px-4 py-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/clients/registration-invites/${item.id}`}
                    className="text-sm font-medium text-ink hover:text-oak"
                  >
                    {item.prefillContactName}
                  </Link>
                  <Pill variant={pill.variant}>{pill.label}</Pill>
                </div>
                <p className="font-mono text-[10px] text-mute mt-1">
                  {item.prefillContactPhone} · expira{" "}
                  {formatDateBR(item.expiresAt)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy || item.status === "aprovado" || item.status === "cancelado"}
                  onClick={() => void runAction(item.id, "copy")}
                >
                  Copiar link
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy || item.status === "aprovado"}
                  onClick={() => void runAction(item.id, "regenerate")}
                >
                  Regerar
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy || item.status === "aprovado" || item.status === "cancelado"}
                  onClick={() => void runAction(item.id, "cancel")}
                >
                  Cancelar
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
