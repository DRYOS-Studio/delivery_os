import { Plus } from "lucide-react";
import Link from "next/link";
import { ClientsSearch } from "@/components/domain/ClientsSearch";
import { ClientsTable } from "@/components/domain/ClientsTable";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import {
  countActiveClients,
  listClients,
} from "@/lib/db/queries/clients";

type SearchParams = Promise<{ q?: string }>;

export default async function Page({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { q } = await searchParams;
  const [clients, total] = await Promise.all([
    listClients({ search: q }),
    countActiveClients(),
  ]);

  const subtitle = `${total} ${total === 1 ? "Cliente ativo" : "Clientes ativos"}`;

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle={subtitle}
        actions={
          <Link href="/clients/new">
            <Button variant="sage">
              <Plus className="w-4 h-4" strokeWidth={1.75} />
              Novo cliente
            </Button>
          </Link>
        }
      />
      <ClientsSearch initialQuery={q ?? ""} />
      <ClientsTable clients={clients} hasSearch={!!q} />
    </>
  );
}
