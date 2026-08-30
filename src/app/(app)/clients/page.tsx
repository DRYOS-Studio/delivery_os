import { Plus } from "lucide-react";
import Link from "next/link";
import { ClientsSearch } from "@/components/domain/ClientsSearch";
import { ClientsTable } from "@/components/domain/ClientsTable";
import { RestoreButton } from "@/components/domain/RestoreButton";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { getProfile } from "@/lib/auth/server";
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
  const [clients, total, profile] = await Promise.all([
    listClients({ search: q, includeArchived: true }),
    countActiveClients(),
    getProfile(),
  ]);
  const isAdmin = profile?.role === "admin";
  // Separado em JS, não no banco: a query traz os dois (padrão de catalog/products).
  const active = clients.filter((c) => c.archivedAt === null);
  const archived = clients.filter((c) => c.archivedAt !== null);

  const subtitle = `${total} ${total === 1 ? "Cliente ativo" : "Clientes ativos"}`;

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle={subtitle}
        actions={
          isAdmin ? (
            <Link href="/clients/new">
              <Button variant="sage">
                <Plus className="w-4 h-4" strokeWidth={1.75} />
                Novo cliente
              </Button>
            </Link>
          ) : null
        }
      />
      <ClientsSearch initialQuery={q ?? ""} />
      <ClientsTable clients={active} hasSearch={!!q} isAdmin={isAdmin} />

      {isAdmin && archived.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-base text-ink font-semibold mb-3">
            Arquivados
            <span className="font-mono text-[10px] text-mute uppercase tracking-wide ml-2">
              {archived.length}
            </span>
          </h2>
          <div className="bg-card border border-line rounded divide-y divide-line">
            {archived.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm text-ink-soft truncate">{c.name}</p>
                  <p className="font-mono text-[10px] text-mute-soft">
                    {c.slug}
                  </p>
                </div>
                <RestoreButton kind="client" id={c.id} name={c.name} />
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
