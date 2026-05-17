"use client";

import { Pencil, Trophy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { QuickWinForm } from "@/components/domain/QuickWinForm";
import { RemoveQuickWinButton } from "@/components/domain/RemoveQuickWinButton";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { resolveVillainIcon } from "@/lib/constants/villain-icons";
import type { OperationVillainListItem } from "@/lib/db/queries/operation-villains";
import type { QuickWinListItem } from "@/lib/db/queries/quick-wins";
import { formatDateBR } from "@/lib/utils/date";

export function QuickWinRow({
  qw,
  operationId,
  operationVillains,
  operationFrentes,
  isAdmin = false,
}: {
  qw: QuickWinListItem;
  operationId: string;
  operationVillains: OperationVillainListItem[];
  operationFrentes: Array<{ id: string; name: string }>;
  isAdmin?: boolean;
}): React.JSX.Element {
  const [editing, setEditing] = useState(false);

  return (
    <li>
      <Card>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded bg-sage-bg flex items-center justify-center text-sage-deep">
            <Trophy className="w-5 h-5" strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="space-y-0.5">
                <h3 className="font-display text-base font-semibold text-ink">
                  {qw.title}
                </h3>
                <p className="font-mono text-[11px] text-mute">
                  {formatDateBR(qw.happenedAt)}
                  {qw.frenteName && <> · {qw.frenteName}</>}
                  {qw.executorEmail && <> · {qw.executorEmail}</>}
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
                {isAdmin && (
                  <RemoveQuickWinButton qwId={qw.id} title={qw.title} />
                )}
              </div>
            </div>

            {qw.description && !editing && (
              <p className="text-sm text-ink-soft whitespace-pre-wrap">
                {qw.description}
              </p>
            )}

            {qw.impacts.length > 0 && !editing && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {qw.impacts.map((imp) => {
                  const Icon = resolveVillainIcon(imp.villain.iconName);
                  return (
                    <Pill key={imp.id} variant="sage">
                      <Icon className="w-3 h-3" strokeWidth={1.75} />
                      {imp.villain.name} +{imp.impactPct}%
                    </Pill>
                  );
                })}
              </div>
            )}

            {editing && (
              <QuickWinForm
                mode="edit"
                operationId={operationId}
                initialData={qw}
                operationVillains={operationVillains}
                operationFrentes={operationFrentes}
                onClose={() => setEditing(false)}
              />
            )}
          </div>
        </div>
      </Card>
    </li>
  );
}
