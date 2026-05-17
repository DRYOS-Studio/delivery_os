import { Plus } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Pill, type PillVariant } from "@/components/ui/Pill";
import type { AllocationListItem } from "@/lib/db/queries/allocations";
import { formatDateShortBR } from "@/lib/utils/date";
import { getInitials } from "@/lib/utils/initials";

const ROLE_LABEL: Record<AllocationListItem["role"], string> = {
  responsavel: "Responsável",
  executor: "Executor",
  aprovador: "Aprovador",
  plantao: "Plantão",
};

const ROLE_VARIANT: Record<AllocationListItem["role"], PillVariant> = {
  responsavel: "oak",
  executor: "neutral",
  aprovador: "sage",
  plantao: "warning",
};

export function AllocationsSection({
  allocations,
  operationId,
  frenteId,
}: {
  allocations: AllocationListItem[];
  operationId: string;
  frenteId: string;
}) {
  const newHref = `/operations/${operationId}/frentes/${frenteId}/allocations/new`;

  return (
    <section className="mt-9 mb-9">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="font-display text-lg text-ink font-semibold">
          Alocações
        </h2>
        <Pill variant="neutral">{allocations.length}</Pill>
        <div className="ml-auto">
          <Link href={newHref}>
            <Button variant="sage" size="sm">
              <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
              Nova alocação
            </Button>
          </Link>
        </div>
      </div>

      {allocations.length === 0 ? (
        <div className="bg-card border border-line rounded p-7 text-center">
          <p className="font-body text-sm text-mute mb-4">
            Nenhuma alocação nesta Frente.
          </p>
          <Link href={newHref}>
            <Button variant="sage" size="sm">
              <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
              Criar primeira alocação
            </Button>
          </Link>
        </div>
      ) : (
        <div className="bg-card border border-line rounded shadow-sm overflow-hidden">
          <ul>
            {allocations.map((a, idx) => (
              <li
                key={a.id}
                className={`grid grid-cols-12 gap-3 items-center px-4 py-3 ${idx !== allocations.length - 1 ? "border-b border-line" : ""}`}
              >
                <div className="col-span-1 flex justify-center">
                  <Avatar
                    size="sm"
                    initials={getInitials(a.person.name)}
                    color="oak"
                  />
                </div>
                <div className="col-span-3">
                  <Link
                    href={`/persons/${a.person.id}`}
                    className="font-medium text-ink hover:underline"
                  >
                    {a.person.name}
                  </Link>
                </div>
                <div className="col-span-2">
                  <Pill variant={ROLE_VARIANT[a.role]}>
                    {ROLE_LABEL[a.role]}
                  </Pill>
                </div>
                <div className="col-span-2 font-mono text-xs text-mute">
                  {a.capacityWeeklyPct.toFixed(0)}% / sem
                </div>
                <div className="col-span-3 font-mono text-xs text-mute">
                  {formatDateShortBR(a.startDate)}
                  {a.endDate ? ` → ${formatDateShortBR(a.endDate)}` : " → aberto"}
                </div>
                <div className="col-span-1 text-right">
                  <Link
                    href={`/operations/${operationId}/frentes/${frenteId}/allocations/${a.id}/edit`}
                    className="text-oak hover:underline text-sm font-medium"
                  >
                    Editar →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
