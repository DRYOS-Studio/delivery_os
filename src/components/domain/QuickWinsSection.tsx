"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { QuickWinForm } from "@/components/domain/QuickWinForm";
import { QuickWinRow } from "@/components/domain/QuickWinRow";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import type { OperationVillainListItem } from "@/lib/db/queries/operation-villains";
import type { QuickWinListItem } from "@/lib/db/queries/quick-wins";

type Props = {
  quickWins: QuickWinListItem[];
  operationId: string;
  operationVillains: OperationVillainListItem[];
  operationFrentes: Array<{ id: string; name: string }>;
  isAdmin?: boolean;
};

export function QuickWinsSection({
  quickWins,
  operationId,
  operationVillains,
  operationFrentes,
  isAdmin = false,
}: Props): React.JSX.Element {
  const [creating, setCreating] = useState(false);

  return (
    <section className="mb-9">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-lg text-ink font-semibold">
            Quick Wins
          </h2>
          <Pill variant="neutral">{quickWins.length}</Pill>
        </div>
        {!creating && (
          <Button
            type="button"
            variant="sage"
            size="sm"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
            Registrar conquista
          </Button>
        )}
      </div>

      {creating && (
        <div className="mb-4">
          <QuickWinForm
            mode="create"
            operationId={operationId}
            operationVillains={operationVillains}
            operationFrentes={operationFrentes}
            onClose={() => setCreating(false)}
          />
        </div>
      )}

      {quickWins.length === 0 && !creating ? (
        <Card>
          <p className="text-sm text-mute text-center py-2">
            Nenhuma conquista registrada. Registre a primeira pra começar a
            derrotar vilões.
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {quickWins.map((qw) => (
            <QuickWinRow
              key={qw.id}
              qw={qw}
              operationId={operationId}
              operationVillains={operationVillains}
              operationFrentes={operationFrentes}
              isAdmin={isAdmin}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
