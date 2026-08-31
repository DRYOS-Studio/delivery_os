import { Edit2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientDiagnosticSection } from "@/components/domain/ClientDiagnosticSection";
import { ClientIdentitySection } from "@/components/domain/ClientIdentitySection";
import { ClientSummarySection } from "@/components/domain/ClientSummarySection";
import { ExternalPersonsList } from "@/components/domain/ExternalPersonsList";
import { OperationCard } from "@/components/domain/OperationCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { getProfile } from "@/lib/auth/server";
import { getClient, getClientSummary } from "@/lib/db/queries/clients";
import { getDiagnosticByClient } from "@/lib/db/queries/diagnostics";
import { getActiveOperations } from "@/lib/db/queries/operations";
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

  const [operations, persons, diagnostic, summary, profile] = await Promise.all([
    getActiveOperations({ clientId: id, scope: "visivel" }),
    getExternalPersonsByClient(id),
    getDiagnosticByClient(id),
    getClientSummary(id),
    getProfile(),
  ]);
  const isAdmin = profile?.role === "admin";

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

      {client.notes && (
        <div className="bg-sage-bg border-l-2 border-sage-deep px-4 py-3 mb-7 rounded-sm">
          <p className="font-body text-sm text-ink-soft whitespace-pre-wrap">
            {client.notes}
          </p>
        </div>
      )}

      <ClientSummarySection summary={summary} isAdmin={isAdmin} />
      <ClientIdentitySection client={client} />

      <ClientDiagnosticSection diagnostic={diagnostic} clientId={client.id} />

      <section className="mb-9">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="font-display text-lg text-ink font-semibold">
            Operações
          </h2>
          <Pill variant="neutral">{operations.length}</Pill>
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
