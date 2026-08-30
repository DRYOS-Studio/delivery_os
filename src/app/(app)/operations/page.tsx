import { Plus } from "lucide-react";
import Link from "next/link";
import { OperationsSearch } from "@/components/domain/OperationsSearch";
import { OperationsTable } from "@/components/domain/OperationsTable";
import { RestoreButton } from "@/components/domain/RestoreButton";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { getProfile } from "@/lib/auth/server";
import {
  countActiveOperations,
  listOperations,
} from "@/lib/db/queries/operations";

type SearchParams = Promise<{ q?: string }>;

export default async function Page({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { q } = await searchParams;
  const [operations, total, profile] = await Promise.all([
    listOperations({ search: q, includeArchived: true }),
    countActiveOperations(),
    getProfile(),
  ]);
  const isAdmin = profile?.role === "admin";
  const active = operations.filter((o) => o.archivedAt === null);
  const archived = operations.filter((o) => o.archivedAt !== null);

  const subtitle = `${total} ${total === 1 ? "Operação ativa" : "Operações ativas"}`;

  return (
    <>
      <PageHeader
        title="Operações"
        subtitle={subtitle}
        actions={
          isAdmin ? (
            <Link href="/operations/new">
              <Button variant="sage">
                <Plus className="w-4 h-4" strokeWidth={1.75} />
                Nova operação
              </Button>
            </Link>
          ) : null
        }
      />
      <OperationsSearch initialQuery={q ?? ""} />
      <OperationsTable
        operations={active}
        hasSearch={!!q}
        isAdmin={isAdmin}
      />

      {isAdmin && archived.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-base text-ink font-semibold mb-3">
            Arquivadas
            <span className="font-mono text-[10px] text-mute uppercase tracking-wide ml-2">
              {archived.length}
            </span>
          </h2>
          <div className="bg-card border border-line rounded divide-y divide-line">
            {archived.map((o) => (
              <div
                key={o.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm text-ink-soft truncate">{o.name}</p>
                  <p className="font-mono text-[10px] text-mute-soft">
                    {o.clientName}
                  </p>
                </div>
                <RestoreButton kind="operation" id={o.id} name={o.name} />
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
