import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Pill, type PillVariant } from "@/components/ui/Pill";
import type { RiskBlockerListItem } from "@/lib/db/queries/operation-risk-blockers";

const STATUS_LABEL = {
  open: "Aberto",
  mitigated: "Mitigado",
  resolved: "Resolvido",
} as const;

const STATUS_VARIANT: Record<keyof typeof STATUS_LABEL, PillVariant> = {
  open: "warning",
  mitigated: "oak",
  resolved: "sage",
};

const KIND_LABEL = { risk: "Risco", blocker: "Bloqueio" } as const;

type Props = {
  items: RiskBlockerListItem[];
  openCount: number;
  operationId: string;
  canWrite?: boolean;
};

export function OperationRiskBlockersSection({
  items,
  openCount,
  operationId,
  canWrite = true,
}: Props): React.JSX.Element {
  return (
    <section className="mb-9">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-lg text-ink font-semibold">
            Riscos e bloqueios
          </h2>
          {openCount > 0 ? (
            <Pill variant="warning">{openCount} abertos</Pill>
          ) : (
            <Pill variant="neutral">{items.length}</Pill>
          )}
        </div>
        {canWrite && (
          <span className="font-mono text-[10px] text-mute">
            CRUD via MCP ou em breve no formulário web
          </span>
        )}
      </div>
      <Card className="mb-3">
        <p className="text-sm text-ink-soft">
          Problemas de entrega fora do SLA Dryos (ex.: instabilidade de software do
          cliente ou fornecedor). Não entram em incidentes de SLA da operação.
        </p>
      </Card>
      {items.length === 0 ? (
        <Card>
          <p className="text-sm text-mute py-4 text-center">Nenhum registro.</p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <Card>
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-mute mt-0.5" strokeWidth={1.75} />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="font-medium text-sm">{item.title}</span>
                      <Pill variant="neutral">{KIND_LABEL[item.kind]}</Pill>
                      <Pill variant={STATUS_VARIANT[item.status]}>
                        {STATUS_LABEL[item.status]}
                      </Pill>
                    </div>
                    {item.description && (
                      <p className="text-sm text-mute mt-1 line-clamp-2">
                        {item.description}
                      </p>
                    )}
                    <p className="font-mono text-[10px] text-mute mt-1">
                      Origem {item.origin}
                      {item.responsible ? ` · ${item.responsible.name}` : ""}
                      {item.meeting_id && (
                        <>
                          {" · "}
                          <Link
                            href={`/operations/${operationId}/meetings/${item.meeting_id}`}
                            className="text-oak hover:underline"
                          >
                            reunião
                          </Link>
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
