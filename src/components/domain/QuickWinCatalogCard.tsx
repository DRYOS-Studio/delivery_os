import { Trophy } from "lucide-react";
import Link from "next/link";
import { ArchiveQuickWinCatalogButton } from "@/components/domain/ArchiveQuickWinCatalogButton";
import { Card } from "@/components/ui/Card";
import { Pill, type PillVariant } from "@/components/ui/Pill";
import { resolveVillainIcon } from "@/lib/constants/villain-icons";
import type { QuickWinCatalogListItem } from "@/lib/db/queries/quick-win-catalog";

export function QuickWinCatalogCard({
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
    <Card {...(archived ? { className: "opacity-60" } : {})}>
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-shrink-0 w-12 h-12 rounded flex items-center justify-center bg-sage-bg text-sage-deep">
            <Trophy className="w-6 h-6" strokeWidth={1.75} />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {item.defaultImpactPct != null && (
              <Pill variant="sage">+{item.defaultImpactPct}%</Pill>
            )}
            {archived && <Pill variant="warning">Arquivado</Pill>}
          </div>
        </div>

        <div className="space-y-1">
          <h3 className="font-display text-lg font-semibold text-ink leading-tight">
            {item.title}
          </h3>
          {villain && VillainIcon && villainName && (
            <Pill variant={villainVariant}>
              <VillainIcon className="w-3 h-3" strokeWidth={1.75} />
              {villainName}
            </Pill>
          )}
        </div>

        {item.description && (
          <p className="text-sm text-ink-soft line-clamp-3">
            {item.description}
          </p>
        )}

        {isAdmin && (
          <div className="flex items-center gap-2 pt-2 border-t border-line">
            <Link
              href={`/catalog/quick-wins/${item.id}/edit`}
              className="font-mono text-xs text-oak hover:underline"
            >
              Editar →
            </Link>
            <div className="ml-auto">
              <ArchiveQuickWinCatalogButton
                itemId={item.id}
                itemTitle={item.title}
                archivedAt={item.archivedAt}
              />
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
