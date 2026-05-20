import { Trophy } from "lucide-react";
import Link from "next/link";
import { ArchiveQuickWinCatalogButton } from "@/components/domain/ArchiveQuickWinCatalogButton";
import { Pill, type PillVariant } from "@/components/ui/Pill";
import { resolveVillainIcon } from "@/lib/constants/villain-icons";
import type { QuickWinCatalogListItem } from "@/lib/db/queries/quick-win-catalog";

export function QuickWinCatalogRow({
  item,
  isAdmin = false,
}: {
  item: QuickWinCatalogListItem;
  isAdmin?: boolean;
}): React.JSX.Element {
  const archived = item.archivedAt !== null;
  const villain = item.suggestedVillain;
  const VillainIcon = villain ? resolveVillainIcon(villain.iconName) : null;
  const villainVariant: PillVariant =
    (villain?.pillVariant as PillVariant | undefined) ?? "neutral";
  const villainName = villain
    ? `${villain.name}${villain.archivedAt ? " (arquivado)" : ""}`
    : null;

  return (
    <div
      className={`grid items-center gap-3 px-4 py-3 grid-cols-[2rem_1fr_auto] ${
        archived ? "opacity-60" : ""
      }`}
    >
      <div className="w-8 h-8 rounded-sm flex items-center justify-center bg-sage-bg text-sage-deep">
        <Trophy className="w-4 h-4" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex items-center gap-3 flex-wrap">
        <h3 className="font-display text-sm font-semibold text-ink truncate">
          {item.title}
        </h3>
        {villain && VillainIcon && villainName && (
          <Pill variant={villainVariant}>
            <VillainIcon className="w-3 h-3" strokeWidth={1.75} />
            {villainName}
          </Pill>
        )}
        {item.defaultImpactPct != null && (
          <Pill variant="sage">+{item.defaultImpactPct}%</Pill>
        )}
        {archived && <Pill variant="warning">Arquivado</Pill>}
      </div>
      {isAdmin && (
        <div className="flex items-center gap-2">
          <Link
            href={`/catalog/quick-wins/${item.id}/edit`}
            className="font-mono text-xs text-oak hover:underline"
          >
            Editar →
          </Link>
          <ArchiveQuickWinCatalogButton
            itemId={item.id}
            itemTitle={item.title}
            archivedAt={item.archivedAt}
          />
        </div>
      )}
    </div>
  );
}
