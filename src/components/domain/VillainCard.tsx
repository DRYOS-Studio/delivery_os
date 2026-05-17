import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Pill, type PillVariant } from "@/components/ui/Pill";
import type { VillainListItem } from "@/lib/db/queries/villains";
import { resolveVillainIcon } from "@/lib/constants/villain-icons";

const VARIANT_BG: Record<PillVariant, string> = {
  neutral: "bg-surface text-mute",
  oak: "bg-oak-50 text-oak",
  sage: "bg-sage-bg text-sage-deep",
  ok: "bg-ok-bg text-ok",
  warning: "bg-warning-bg text-warning",
  critical: "bg-critical-bg text-critical",
};

export function VillainCard({
  villain,
  isAdmin = false,
}: {
  villain: VillainListItem;
  isAdmin?: boolean;
}): React.JSX.Element {
  const Icon = resolveVillainIcon(villain.iconName);
  const variant = (villain.pillVariant as PillVariant) ?? "neutral";
  const archived = villain.archivedAt !== null;

  return (
    <Card {...(archived ? { className: "opacity-60" } : {})}>
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div
            className={`flex-shrink-0 w-12 h-12 rounded flex items-center justify-center ${VARIANT_BG[variant]}`}
          >
            <Icon className="w-6 h-6" strokeWidth={1.75} />
          </div>
          <div className="flex items-center gap-2">
            <Pill variant="neutral">{villain.slug}</Pill>
            {archived && <Pill variant="warning">Arquivado</Pill>}
          </div>
        </div>

        <div className="space-y-1">
          <h3 className="font-display text-lg font-semibold text-ink">
            {villain.name}
          </h3>
          <p className="font-body text-sm italic text-mute">
            “{villain.quote}”
          </p>
        </div>

        <p className="text-sm text-ink-soft line-clamp-3">
          {villain.description}
        </p>

        {isAdmin && (
          <Link
            href={`/catalog/villains/${villain.id}/edit`}
            className="font-mono text-xs text-oak hover:underline inline-block"
          >
            Editar →
          </Link>
        )}
      </div>
    </Card>
  );
}
