import Link from "next/link";
import { OperationCard } from "@/components/domain/OperationCard";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import type { OperationCardData } from "@/lib/db/queries/operations";

type Props = {
  client: { id: string; name: string; slug: string };
  operations: OperationCardData[];
};

export function PersonClientSection({ client, operations }: Props) {
  return (
    <>
      <section className="mb-7">
        <h2 className="font-display text-lg text-ink font-semibold mb-4">
          Cliente
        </h2>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <Link
                href={`/clients/${client.id}`}
                className="font-display text-xl font-semibold text-ink hover:underline"
              >
                {client.name}
              </Link>
              <p className="font-mono text-[10px] uppercase tracking-wide text-mute mt-1">
                {client.slug}
              </p>
            </div>
            <Link
              href={`/clients/${client.id}`}
              className="text-oak hover:underline text-sm font-medium"
            >
              Abrir cliente →
            </Link>
          </div>
        </Card>
      </section>

      <section className="mb-9">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="font-display text-lg text-ink font-semibold">
            Operações do Cliente
          </h2>
          <Pill variant="neutral">{operations.length}</Pill>
        </div>
        {operations.length === 0 ? (
          <p className="text-sm text-mute">
            Nenhuma Operação ativa pra este Cliente.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {operations.map((op) => (
              <OperationCard key={op.id} data={op} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
