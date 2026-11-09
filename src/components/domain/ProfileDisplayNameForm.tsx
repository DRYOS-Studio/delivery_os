"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { setProfileDisplayNameAction } from "@/lib/actions/profile-display-name";
import { Button } from "@/components/ui/Button";

type Props = {
  profileId: string;
  initialName: string | null;
  resolvedLabel: string | null;
  email: string | null;
  canEdit: boolean;
  compact?: boolean;
};

export function ProfileDisplayNameForm({
  profileId,
  initialName,
  resolvedLabel,
  email,
  canEdit,
  compact = false,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [name, setName] = useState(initialName ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setName(initialName ?? "");
  }, [initialName]);

  const dirty = (name.trim() === "" ? null : name.trim()) !== (initialName?.trim() ?? null);

  async function handleSave() {
    setBusy(true);
    setMessage(null);
    const result = await setProfileDisplayNameAction(profileId, name);
    if (!result.ok) {
      setMessage(result.error);
      setBusy(false);
      return;
    }
    setBusy(false);
    setMessage("Salvo.");
    router.refresh();
  }

  if (!canEdit) {
    return (
      <p className={compact ? "text-xs text-ink-soft" : "text-sm text-ink"}>
        {resolvedLabel ?? email ?? "—"}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {!compact && resolvedLabel && (
        <p className="text-xs text-mute">
          Exibido hoje como{" "}
          <span className="text-ink-soft font-medium">{resolvedLabel}</span>
          {!initialName?.trim() ? " (derivado de pessoa/e-mail)" : ""}
        </p>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 flex-1 min-w-[12rem]">
          <span className="text-[10px] font-mono text-mute-soft">
            Nome de exibição (profiles.name)
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
            placeholder={resolvedLabel ?? "Seu nome"}
            className="w-full rounded border border-line bg-card px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none disabled:opacity-50"
          />
        </label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy || !dirty}
          onClick={() => void handleSave()}
        >
          {busy ? "Salvando…" : "Salvar nome"}
        </Button>
      </div>
      {message && (
        <p className="text-xs font-mono text-sage-deep">{message}</p>
      )}
    </div>
  );
}
