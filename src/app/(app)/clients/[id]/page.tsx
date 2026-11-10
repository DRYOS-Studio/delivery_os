import { Edit2, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientJourneyPanel } from "@/components/domain/ClientJourneyPanel";
import { ClientDiagnosticSection } from "@/components/domain/ClientDiagnosticSection";
import { ClientChargesSection } from "@/components/domain/ClientChargesSection";
import { ClientContractsSection } from "@/components/domain/ClientContractsSection";
import { ClientHubTasksSection } from "@/components/domain/ClientHubTasksSection";
import { ClientIdentitySection } from "@/components/domain/ClientIdentitySection";
import { ClientSummarySection } from "@/components/domain/ClientSummarySection";
import { ClientToolingSection } from "@/components/domain/ClientToolingSection";
import { ExternalPersonsList } from "@/components/domain/ExternalPersonsList";
import { OperationCard } from "@/components/domain/OperationCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { getProfile } from "@/lib/auth/server";
import { getClient, getClientSummary } from "@/lib/db/queries/clients";
import { listClientCharges } from "@/lib/db/queries/client-charges";
import { listClientContracts } from "@/lib/db/queries/client-contracts";
import { listOpenTasksForClient } from "@/lib/db/queries/client-hub";
import { getDiagnosticByClient } from "@/lib/db/queries/diagnostics";
import { getActiveOperations, getClientOperationsMrrSum } from "@/lib/db/queries/operations";
import {
  listClientSoftwareItems,
  listClientTechItems,
} from "@/lib/db/queries/client-tooling";
import { listRepositoryLinksForClient } from "@/lib/db/queries/repository-links";
import { getExternalPersonsByClient } from "@/lib/db/queries/persons";
import { formatDateBR } from "@/lib/utils/date";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const client = await getClient(id);
  if (!client) notFound();

  const [
    operations,
    persons,
    diagnostic,
    summary,
    profile,
    openTasks,
    repoLinks,
    techItems,
    softwareItems,
  ] = await Promise.all([
    getActiveOperations({ clientId: id, scope: "visivel" }),
    getExternalPersonsByClient(id),
    getDiagnosticByClient(id),
    getClientSummary(id),
    getProfile(),
    listOpenTasksForClient(id),
    listRepositoryLinksForClient(id),
    listClientTechItems(id),
    listClientSoftwareItems(id),
  ]);
  const isAdmin = profile?.role === "admin";
  let contracts: Awaited<ReturnType<typeof listClientContracts>> = [];
  let charges: Awaited<ReturnType<typeof listClientCharges>> = [];
  let registeredMrr = 0;
  if (isAdmin) {
    [contracts, charges, registeredMrr] = await Promise.all([
      listClientContracts(id),
      listClientCharges(id, { limit: 80 }),
      getClientOperationsMrrSum(id),
    ]);
  }

  return (
    <>
      <PageHeader
        title={client.name}
        subtitle={
          <>
            <span className="font-mono">{client.slug}</span>
            <span className="mx-2">·</span>
            criado em {formatDateBR(client.created_at)}
          </>
        }
        actions={
          <Link href={`/clients/${client.id}/edit`}>
            <Button variant="ghost">
              <Edit2 className="w-4 h-4" strokeWidth={1.75} />
              Editar
            </Button>
          </Link>
        }
      />

      <ClientJourneyPanel
        client={client}
        operations={operations}
        isAdmin={isAdmin}
      />

      {client.notes && (
        <div className="bg-sage-bg border-l-2 border-sage-deep px-4 py-3 mb-7 rounded-sm">
          <p className="font-body text-sm text-ink-soft whitespace-pre-wrap">
            {client.notes}
          </p>
        </div>
      )}

      <ClientSummarySection summary={summary} isAdmin={isAdmin} />

      {isAdmin && <ClientContractsSection clientId={client.id} contracts={contracts} />}
      {isAdmin && (
        <ClientChargesSection
          clientId={client.id}
          charges={charges}
          contracts={contracts}
          registeredMrr={registeredMrr}
        />
      )}
      <ClientIdentitySection client={client} />

      <ClientToolingSection
        clientId={client.id}
        isAdmin={isAdmin}
        repoLinks={repoLinks}
        techItems={techItems}
        softwareItems={softwareItems}
      />

      <ClientDiagnosticSection diagnostic={diagnostic} clientId={client.id} />

      <ClientHubTasksSection tasks={openTasks} />

      <section className="mb-9">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg text-ink font-semibold">
              Operações
            </h2>
            <Pill variant="neutral">{operations.length}</Pill>
          </div>
          {isAdmin && (
            <Link
              href={`/operations/new?clientId=${encodeURIComponent(client.id)}&returnTo=${encodeURIComponent(`/clients/${client.id}`)}`}
            >
              <Button variant="sage" className="min-h-[44px]">
                <Plus className="w-4 h-4" strokeWidth={1.75} />
                Nova operação
              </Button>
            </Link>
          )}
        </div>
        {operations.length === 0 ? (
          <p className="text-sm text-mute">
            Nenhuma Operação pra este Cliente.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {operations.map((op) => (
              <OperationCard key={op.id} data={op} />
            ))}
          </div>
        )}
      </section>

      <section className="mb-9">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="font-display text-lg text-ink font-semibold">
            Pessoas externas
          </h2>
          <Pill variant="neutral">{persons.length}</Pill>
        </div>
        <ExternalPersonsList persons={persons} />
      </section>
    </>
  );
}
