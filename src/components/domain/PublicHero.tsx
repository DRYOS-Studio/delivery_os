import { Pill } from "@/components/ui/Pill";
import type { PublicOperationView } from "@/lib/db/queries/public";
import { formatHours } from "@/lib/utils/sla";
import {
  statusLabel,
  statusPillVariant,
} from "@/lib/utils/operation-status";

const PRODUCT_LABEL = {
  core: "Core",
  spark: "Spark",
  studio: "Studio",
} as const;

export function PublicHero({
  op,
}: {
  op: PublicOperationView;
}): React.JSX.Element {
  return (
    <section className="mb-8">
      <p className="font-mono text-[10px] uppercase tracking-wider text-mute mb-2">
        {op.clientName}
      </p>
      <h1 className="font-display text-3xl font-semibold text-ink leading-tight mb-3">
        {op.name}
      </h1>
      <div className="flex items-center gap-2 flex-wrap">
        <Pill variant="sage" showDot>
          {PRODUCT_LABEL[op.productLine]}
        </Pill>
        <Pill variant={statusPillVariant(op.status)}>
          {statusLabel(op.status)}
        </Pill>
        {(op.responseHours !== null || op.resolutionHours !== null) && (
          <Pill variant="oak">
            SLA: resp {formatHours(op.responseHours)} · res{" "}
            {formatHours(op.resolutionHours)}
          </Pill>
        )}
      </div>
    </section>
  );
}
