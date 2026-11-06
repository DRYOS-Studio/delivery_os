"use client";

import { Link2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { setProfilePersonLinkAction } from "@/lib/actions/admin-users";
import type { PersonPickItem } from "@/lib/db/queries/admin-directory";

type Props = {
  profileId: string;
  persons: PersonPickItem[];
  currentPersonId: string | null;
};

export function ProfilePersonLinkControl({
  profileId,
  persons,
  currentPersonId,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [personId, setPersonId] = useState(currentPersonId ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPersonId(currentPersonId ?? "");
  }, [currentPersonId]);

  async function handleSave() {
    setBusy(true);
    const fd = new FormData();
    fd.set("profile_id", profileId);
    if (personId) fd.set("person_id", personId);
    const result = await setProfilePersonLinkAction(fd);
    if (!result.ok) {
      window.alert(`Erro: ${result.error}`);
      setBusy(false);
      return;
    }
    setBusy(false);
    router.refresh();
  }

  const dirty =
    (personId === "" ? null : personId) !==
    (currentPersonId ?? null);

  return (
    <div className="flex flex-col gap-1 min-w-[12rem] shrink-0">
      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-mute-soft">
        <Link2 className="w-3 h-3" strokeWidth={1.75} />
        Pessoa
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={personId}
          onChange={(e) => setPersonId(e.target.value)}
          disabled={busy}
          className="max-w-[200px] rounded border border-line bg-card px-2 py-1 text-xs text-ink-soft focus:border-line-strong focus:outline-none disabled:opacity-50"
        >
          <option value="">— nenhum —</option>
          {persons.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.kind === "internal" ? "int." : "ext."})
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={busy || !dirty}
          onClick={() => void handleSave()}
          className="text-xs font-mono px-2 py-1 rounded border border-line text-ink-soft hover:bg-surface disabled:opacity-40"
        >
          {busy ? "…" : "Salvar vínculo"}
        </button>
      </div>
    </div>
  );
}
