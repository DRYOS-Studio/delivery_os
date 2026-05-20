import Link from "next/link";
import { Pill, type PillVariant } from "@/components/ui/Pill";
import { resolveVillainIcon } from "@/lib/constants/villain-icons";
import type { VillainListItem } from "@/lib/db/queries/villains";

const VARIANT_BG: Record<PillVariant, string> = {
  neutral: "bg-surface text-mute",
  oak: "bg-oak-50 text-oak",
  sage: "bg-sage-bg text-sage-deep",
  ok: "bg-ok-bg text-ok",
  warning: "bg-warning-bg text-warning",
  critical: "bg-critical-bg text-critical",
};

export function VillainRow({
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
    <div
      className={`grid items-center gap-3 px-4 py-3 grid-cols-[2rem_1fr_auto] ${
        archived ? "opacity-60" : ""
      }`}
    >
      <div
        className={`w-8 h-8 rounded-sm flex items-center justify-center ${VARIANT_BG[variant]}`}
      >
        <Icon className="w-4 h-4" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex items-center gap-3 flex-wrap">
        <h3 className="font-display text-sm font-semibold text-ink truncate">
          {villain.name}
        </h3>
        <Pill variant="neutral">{villain.slug}</Pill>
        {archived && <Pill variant="warning">Arquivado</Pill>}
        <p className="text-xs text-mute truncate hidden md:block">
          {villain.description}
        </p>
      </div>
      {isAdmin && (
        <Link
          href={`/catalog/villains/${villain.id}/edit`}
          className="font-mono text-xs text-oak hover:underline"
        >
          Editar →
        </Link>
      )}
    </div>
  );
}
