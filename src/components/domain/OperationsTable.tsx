import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { MobileListItem } from "@/components/ui/MobileListItem";
import { Pill, type PillVariant } from "@/components/ui/Pill";
import type { OperationListItem } from "@/lib/db/queries/operations";
import { formatDateBR } from "@/lib/utils/date";
import { formatMoneyBR } from "@/lib/utils/money";
import {
  statusLabel,
  statusPillVariant,
} from "@/lib/utils/operation-status";

const PRODUCT_LINE_LABEL: Record<OperationListItem["productLine"], string> = {
  core: "Core",
  spark: "Spark",
  studio: "Studio",
};
export function OperationsTable({
  operations,
  hasSearch,
  isAdmin = true,
}: {
  operations: OperationListItem[];
  hasSearch: boolean;
  isAdmin?: boolean;
}) {
  if (operations.length === 0) {
    return (
      <div className="text-center py-14 border border-line rounded bg-card">
        {hasSearch ? (
          <>
            <p className="font-display text-lg text-mute">
              Nenhuma Operação para essa busca.
            </p>
            <Link
              href="/operations"
              className="inline-block mt-3 font-mono text-xs text-oak hover:underline"
            >
              limpar busca
            </Link>
          </>
        ) : isAdmin ? (
          <>
            <p className="font-display text-lg text-mute">
              Nenhuma Operação cadastrada.
            </p>
            <Link href="/operations/new" className="inline-block mt-4">
              <Button variant="sage">Nova operação</Button>
            </Link>
          </>
        ) : (
          <>
            <p className="font-display text-lg text-mute">
              Você ainda não foi atribuído a nenhuma Operação.
            </p>
            <p className="font-mono text-xs text-mute mt-2">
              Peça pra um admin te adicionar.
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Mobile: card list */}
      <ul className="md:hidden bg-card border border-line rounded shadow-sm overflow-hidden">
        {operations.map((op) => (
          <MobileListItem
            key={op.id}
            href={`/operations/${op.id}`}
            title={op.name}
            subtitle={`${op.clientName} · ${op.clientSlug}`}
            pills={
              <>
                <Pill variant="oak" showDot>
                  {PRODUCT_LINE_LABEL[op.productLine]}
                </Pill>
                <Pill variant={statusPillVariant(op.status)}>
                  {statusLabel(op.status)}
                </Pill>
              </>
            }
            meta={`${op.activeFrentes} ${op.activeFrentes === 1 ? "frente" : "frentes"} · ${formatDateBR(op.createdAt)}`}
            {...(isAdmin
              ? { trailingValue: formatMoneyBR(op.monthlyRecurringRevenue) }
              : {})}
          />
        ))}
      </ul>

      {/* Desktop: table */}
      <div className="hidden md:block bg-card border border-line rounded shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line">
            <Th>Cliente</Th>
            <Th>Operação</Th>
            <Th>Linha</Th>
            <Th>Status</Th>
            {isAdmin && <Th>MRR</Th>}
            <Th>Frentes</Th>
            <Th>Criado em</Th>
            <Th className="text-right">Ações</Th>
          </tr>
        </thead>
        <tbody>
          {operations.map((op) => (
            <tr
              key={op.id}
              className="border-b border-line last:border-b-0 hover:bg-surface transition-colors"
            >
              <Td>
                <div className="font-medium text-ink">{op.clientName}</div>
                <div className="font-mono text-[10px] text-mute">
                  {op.clientSlug}
                </div>
              </Td>
              <Td className="text-ink-soft">{op.name}</Td>
              <Td>
                <Pill variant="oak" showDot>
                  {PRODUCT_LINE_LABEL[op.productLine]}
                </Pill>
              </Td>
              <Td>
                <Pill variant={statusPillVariant(op.status)}>
                  {statusLabel(op.status)}
                </Pill>
              </Td>
              {isAdmin && (
                <Td className="font-mono text-xs text-mute">
                  {formatMoneyBR(op.monthlyRecurringRevenue)}
                </Td>
              )}
              <Td>
                <Pill variant="neutral">{op.activeFrentes}</Pill>
              </Td>
              <Td className="font-mono text-xs text-mute">
                {formatDateBR(op.createdAt)}
              </Td>
              <Td className="text-right">
                <Link
                  href={`/operations/${op.id}`}
                  className="text-oak hover:underline text-sm font-medium"
                >
                  Abrir →
                </Link>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </>
  );
}

function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`font-mono text-[10px] uppercase tracking-wide text-mute font-medium px-4 py-3 text-left ${className ?? ""}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 ${className ?? ""}`}>{children}</td>;
}
