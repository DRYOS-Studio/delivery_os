import { redirect } from "next/navigation";
import { ManagementDiagnosticReport } from "@/components/domain/ManagementDiagnosticReport";
import { PageHeader } from "@/components/layout/PageHeader";
import { getClient } from "@/lib/db/queries/clients";
import { getLatestDiagnosticByClient } from "@/lib/db/queries/diagnostics";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) redirect("/clients");

  const [client, diagnostic] = await Promise.all([
    getClient(id),
    getLatestDiagnosticByClient(id),
  ]);

  if (!client) redirect("/clients");

  if (!diagnostic) {
    redirect(`/clients/${id}/diagnostic/new`);
  }

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title="Diagnóstico de Gestão"
          subtitle={`${client.name} · Avaliação de Maturidade`}
        />
      </div>
      <ManagementDiagnosticReport
        diagnostic={diagnostic}
        clientId={client.id}
        clientName={client.name}
      />
    </>
  );
}
