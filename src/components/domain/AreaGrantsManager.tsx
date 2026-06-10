"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/MultiSelect";
import {
  grantClientToAreaAction,
  grantOperationToAreaAction,
  revokeClientFromAreaAction,
  revokeOperationFromAreaAction,
} from "@/lib/actions/area-grants";

type Kind = "client" | "operation";

type Props = {
  areaId: string;
  kind: Kind;
  options: MultiSelectOption[];
  grantedIds: string[];
};

/**
 * Concessões de uma área (clientes OU operações). MultiSelect emite o array
 * inteiro; comparamos com o estado anterior pra conceder os novos e revogar os
 * removidos. Otimista com revert em erro.
 */
export function AreaGrantsManager({
  areaId,
  kind,
  options,
  grantedIds,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [ids, setIds] = useState<string[]>(grantedIds);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const grant =
    kind === "client" ? grantClientToAreaAction : grantOperationToAreaAction;
  const revoke =
    kind === "client"
      ? revokeClientFromAreaAction
      : revokeOperationFromAreaAction;

  function onChange(next: string[]) {
    const prev = ids;
    const added = next.filter((id) => !prev.includes(id));
    const removed = prev.filter((id) => !next.includes(id));
    setIds(next); // otimista
    setError(null);
    startTransition(async () => {
      for (const id of added) {
        const r = await grant(areaId, id);
        if (!r.ok) {
          setIds(prev);
          setError(r.error);
          // Reconcilia UI com o que de fato persistiu (falha parcial num batch).
          router.refresh();
          return;
        }
      }
      for (const id of removed) {
        const r = await revoke(areaId, id);
        if (!r.ok) {
          setIds(prev);
          setError(r.error);
          // Reconcilia UI com o que de fato persistiu (falha parcial num batch).
          router.refresh();
          return;
        }
      }
    });
  }

  return (
    <div className="space-y-1">
      <MultiSelect
        options={options}
        value={ids}
        onChange={onChange}
        disabled={isPending}
        placeholder={
          kind === "client" ? "— nenhum cliente" : "— nenhuma operação"
        }
        emptyText={
          kind === "client"
            ? "Nenhum cliente cadastrado."
            : "Nenhuma operação cadastrada."
        }
      />
      {error && (
        <p className="text-critical text-xs" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
