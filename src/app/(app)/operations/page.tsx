import { Plus } from "lucide-react";
import Link from "next/link";
import { OperationsSearch } from "@/components/domain/OperationsSearch";
import { OperationsTable } from "@/components/domain/OperationsTable";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
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
  const [operations, total] = await Promise.all([
    listOperations({ search: q }),
    countActiveOperations(),
  ]);

  const subtitle = `${total} ${total === 1 ? "Operação ativa" : "Operações ativas"}`;

  return (
    <>
      <PageHeader
        title="Operações"
        subtitle={subtitle}
        actions={
          <Link href="/operations/new">
            <Button variant="sage">
              <Plus className="w-4 h-4" strokeWidth={1.75} />
              Nova operação
            </Button>
          </Link>
        }
      />
      <OperationsSearch initialQuery={q ?? ""} />
      <OperationsTable operations={operations} hasSearch={!!q} />
    </>
  );
}
