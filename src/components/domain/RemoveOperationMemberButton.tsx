"use client";

import { useTransition } from "react";
import { removeOperationMemberAction } from "@/lib/actions/operation-members";

export function RemoveOperationMemberButton({
  operationId,
  profileId,
  name,
}: {
  operationId: string;
  profileId: string;
  name: string;
}): React.JSX.Element {
  const [isPending, startTransition] = useTransition();

  function handleClick(): void {
    const ok = window.confirm(`Remover ${name} desta Operação?`);
    if (!ok) return;
    startTransition(async () => {
      const result = await removeOperationMemberAction({
        operation_id: operationId,
        profile_id: profileId,
      });
      if (!result.ok) {
        window.alert(result.error);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="font-mono text-xs text-critical hover:underline disabled:opacity-50"
    >
      {isPending ? "Removendo..." : "Remover"}
    </button>
  );
}
