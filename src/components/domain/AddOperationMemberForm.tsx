"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { addOperationMemberAction } from "@/lib/actions/operation-members";
import type { AssignableProfile } from "@/lib/db/queries/operation-members";

export function AddOperationMemberForm({
  operationId,
  candidates,
}: {
  operationId: string;
  candidates: AssignableProfile[];
}): React.JSX.Element {
  const [selected, setSelected] = useState<string>(candidates[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData): void {
    setError(null);
    const profileId = formData.get("profile_id");
    if (typeof profileId !== "string" || !profileId) {
      setError("Selecione um membro.");
      return;
    }
    startTransition(async () => {
      const result = await addOperationMemberAction({
        operation_id: operationId,
        profile_id: profileId,
      });
      if (!result.ok) {
        setError(result.error);
      }
    });
  }

  return (
    <form
      action={handleSubmit}
      className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end"
    >
      <div className="flex-1 md:min-w-[240px] space-y-1">
        <label
          htmlFor="profile_id"
          className="block font-mono text-[10px] text-mute uppercase tracking-wide"
        >
          Membro
        </label>
        <select
          id="profile_id"
          name="profile_id"
          required
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          disabled={isPending}
          className="w-full bg-card border border-line rounded px-3 py-2 text-sm text-ink-soft focus:outline-none focus:border-line-strong disabled:opacity-50"
        >
          {candidates.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name ?? "Sem nome"}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" variant="primary" size="sm" disabled={isPending}>
        {isPending ? "Adicionando..." : "Adicionar"}
      </Button>
      {error && (
        <p className="w-full text-critical text-xs" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
