import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Pill, type PillVariant } from "@/components/ui/Pill";
import type { PersonAllocationItem } from "@/lib/db/queries/persons";
import { formatCycleTypeShort } from "@/lib/utils/cycle-type";

const ROLE_LABEL: Record<PersonAllocationItem["role"], string> = {
  responsavel: "Responsável",
  executor: "Executor",
  aprovador: "Aprovador",
  plantao: "Plantão",
};

const ROLE_VARIANT: Record<PersonAllocationItem["role"], PillVariant> = {
  responsavel: "oak",
  executor: "neutral",
  aprovador: "sage",
  plantao: "warning",
};

type GroupedOp = {
  operationId: string;
  operationName: string;
  clientName: string;
  items: PersonAllocationItem[];
};

function groupByOperation(items: PersonAllocationItem[]): GroupedOp[] {
  const map = new Map<string, GroupedOp>();
  for (const item of items) {
    const existing = map.get(item.operation.id);
    if (existing) {
      existing.items.push(item);
    } else {
      map.set(item.operation.id, {
        operationId: item.operation.id,
        operationName: item.operation.name,
        clientName: item.operation.clientName,
        items: [item],
      });
    }
  }
  return Array.from(map.values());
}

export function PersonAllocationsSection({
  allocations,
}: {
  allocations: PersonAllocationItem[];
}) {
  if (allocations.length === 0) {
    return (
      <section className="mb-9">
        <h2 className="font-display text-lg text-ink font-semibold mb-4">
          Alocações
        </h2>
        <p className="text-sm text-mute">Sem alocações ativas.</p>
      </section>
    );
  }

  const groups = groupByOperation(allocations);

  return (
    <section className="mb-9">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="font-display text-lg text-ink font-semibold">Alocações</h2>
        <Pill variant="neutral">{allocations.length}</Pill>
      </div>

      <div className="space-y-4">
        {groups.map((g) => (
          <Card key={g.operationId}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <Link
                  href={`/operations/${g.operationId}`}
                  className="font-display text-base font-semibold text-ink hover:underline"
                >
                  {g.operationName}
                </Link>
                <p className="font-mono text-[10px] uppercase tracking-wide text-mute mt-0.5">
                  {g.clientName}
                </p>
              </div>
              <Pill variant="neutral">
                {g.items.length} {g.items.length === 1 ? "frente" : "frentes"}
              </Pill>
            </div>

            <ul className="space-y-2 mt-3">
              {g.items.map((a) => (
                <li
                  key={a.allocationId}
                  className="grid grid-cols-12 gap-3 items-center text-sm border-t border-line pt-2 first:border-t-0 first:pt-0"
                >
                  <div className="col-span-5 text-ink-soft">{a.frente.name}</div>
                  <div className="col-span-2">
                    <Pill variant="oak">
                      {formatCycleTypeShort(a.frente.cycleType)}
                    </Pill>
                  </div>
                  <div className="col-span-3">
                    <Pill variant={ROLE_VARIANT[a.role]}>
                      {ROLE_LABEL[a.role]}
                    </Pill>
                  </div>
                  <div className="col-span-2 text-right font-mono text-xs text-mute">
                    {a.capacityWeeklyPct.toFixed(0)}%
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </section>
  );
}
