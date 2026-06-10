"use client";

import { Archive, ArchiveRestore, Plus, Settings2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { archiveAreaAction, createAreaAction } from "@/lib/actions/areas";

export type AreaCatalogItem = {
  id: string;
  name: string;
  archivedAt: string | null;
  memberCount: number;
};

export function AreaCatalog({
  areas,
}: {
  areas: AreaCatalogItem[];
}): React.JSX.Element {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function create() {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("Mínimo 2 caracteres.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await createAreaAction(trimmed);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setName("");
      router.refresh();
    });
  }

  function toggleArchive(id: string, archived: boolean) {
    startTransition(async () => {
      const r = await archiveAreaAction(id, archived);
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[200px] space-y-1">
          <label
            htmlFor="new-area"
            className="block font-mono text-[10px] text-mute uppercase tracking-wide"
          >
            Nova área
          </label>
          <input
            id="new-area"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                create();
              }
            }}
            disabled={isPending}
            placeholder="ex: Tráfego, Design, Copy"
            className="w-full bg-card border border-line rounded px-3 py-2 text-sm text-ink-soft placeholder:text-mute-soft focus:outline-none focus:border-line-strong disabled:opacity-50"
          />
        </div>
        <Button
          type="button"
          variant="sage"
          onClick={create}
          disabled={isPending}
        >
          <Plus className="w-4 h-4" strokeWidth={1.75} />
          Criar área
        </Button>
      </div>
      {error && (
        <p className="text-critical text-xs" role="alert">
          {error}
        </p>
      )}

      <div className="bg-card border border-line rounded shadow-sm overflow-hidden">
        <ul className="divide-y divide-line">
          {areas.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-medium text-ink truncate">{a.name}</span>
                {a.archivedAt && <Pill variant="neutral">Arquivada</Pill>}
                <span className="font-mono text-[10px] text-mute-soft">
                  {a.memberCount} membro{a.memberCount === 1 ? "" : "s"}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Link href={`/admin/areas/${a.id}`}>
                  <Button type="button" variant="ghost" size="sm">
                    <Settings2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                    Gerir
                  </Button>
                </Link>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isPending}
                  onClick={() => toggleArchive(a.id, a.archivedAt === null)}
                >
                  {a.archivedAt ? (
                    <ArchiveRestore className="w-3.5 h-3.5" strokeWidth={1.75} />
                  ) : (
                    <Archive className="w-3.5 h-3.5" strokeWidth={1.75} />
                  )}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
