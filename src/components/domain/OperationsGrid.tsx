import Link from "next/link";
import { OperationCard } from "@/components/domain/OperationCard";
import type { OperationCardData } from "@/lib/db/queries/operations";

type Props = {
  operations: OperationCardData[];
  isAdmin: boolean;
  hasFilter?: boolean;
};

export function OperationsGrid({
  operations,
  isAdmin,
  hasFilter = false,
}: Props) {
  if (operations.length === 0) {
    return (
      <div className="text-center py-14 border border-line rounded bg-card">
        {hasFilter ? (
          <>
            <p className="font-display text-lg text-mute">
              Nenhuma Operação nesse status.
            </p>
            <Link
              href="/"
              className="inline-block mt-3 font-mono text-xs text-oak hover:underline"
            >
              ver todas
            </Link>
          </>
        ) : isAdmin ? (
          <>
            <p className="font-display text-lg text-mute">
              Nenhuma Operação ativa.
            </p>
            <p className="font-body text-sm text-mute mt-2">
              Abra uma nova quando estiver pronto.
            </p>
          </>
        ) : (
          <>
            <p className="font-display text-lg text-mute">
              Você ainda não foi atribuído a nenhuma Operação.
            </p>
            <p className="font-body text-sm text-mute mt-2">
              Peça pra um admin te adicionar.
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
      {operations.map((op) => (
        <OperationCard key={op.id} data={op} />
      ))}
    </div>
  );
}
