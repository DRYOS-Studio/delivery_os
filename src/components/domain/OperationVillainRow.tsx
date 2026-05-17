"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";
import { EditOperationVillainForm } from "@/components/domain/EditOperationVillainForm";
import { RemoveOperationVillainButton } from "@/components/domain/RemoveOperationVillainButton";
import { VillainProgressBar } from "@/components/domain/VillainProgressBar";
import { Card } from "@/components/ui/Card";
import { Pill, type PillVariant } from "@/components/ui/Pill";
import { resolveVillainIcon } from "@/lib/constants/villain-icons";
import type { OperationVillainListItem } from "@/lib/db/queries/operation-villains";
import {
  progressVariant,
  SEVERITY_LABEL,
  SEVERITY_VARIANT,
} from "@/lib/utils/severity";

const VARIANT_BG: Record<PillVariant, string> = {
  neutral: "bg-surface text-mute",
  oak: "bg-oak-50 text-oak",
  sage: "bg-sage-bg text-sage-deep",
  ok: "bg-ok-bg text-ok",
  warning: "bg-warning-bg text-warning",
  critical: "bg-critical-bg text-critical",
};

export function OperationVillainRow({
  item,
}: {
  item: OperationVillainListItem;
}): React.JSX.Element {
  const [editing, setEditing] = useState(false);
  const Icon = resolveVillainIcon(item.villain.iconName);
  const villainVariant =
    (item.villain.pillVariant as PillVariant) ?? "neutral";
  const archived = item.villain.archivedAt !== null;

  return (
    <li>
      <Card>
        <div className="flex items-start gap-3">
          <div
            className={`flex-shrink-0 w-12 h-12 rounded flex items-center justify-center ${VARIANT_BG[villainVariant]}`}
          >
            <Icon className="w-6 h-6" strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-display text-base font-semibold text-ink">
                    {item.villain.name}
                  </h3>
                  <Pill variant={SEVERITY_VARIANT[item.initialSeverity]}>
                    Severidade {SEVERITY_LABEL[item.initialSeverity]}
                  </Pill>
                  {archived && (
                    <Pill variant="neutral">Vilão arquivado</Pill>
                  )}
                </div>
                <p className="font-body text-xs italic text-mute">
                  “{item.villain.quote}”
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setEditing((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs font-mono text-oak hover:underline px-2 py-1"
                >
                  <Pencil className="w-3 h-3" strokeWidth={1.75} />
                  {editing ? "Fechar" : "Editar"}
                </button>
                <RemoveOperationVillainButton
                  itemId={item.id}
                  villainName={item.villain.name}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Pill variant={progressVariant(item.progressPct)}>
                {item.progressPct}% derrotado
              </Pill>
              <div className="flex-1">
                <VillainProgressBar pct={item.progressPct} />
              </div>
            </div>

            {item.evidence && !editing && (
              <p className="text-sm text-ink-soft whitespace-pre-wrap">
                <span className="font-mono text-[10px] text-mute uppercase tracking-wide">
                  Evidência:
                </span>{" "}
                {item.evidence}
              </p>
            )}

            {editing && (
              <EditOperationVillainForm
                itemId={item.id}
                initialEvidence={item.evidence}
                onClose={() => setEditing(false)}
              />
            )}
          </div>
        </div>
      </Card>
    </li>
  );
}
