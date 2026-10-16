import { redirect } from "next/navigation";
import { ManagementDiagnosticWizard } from "@/components/domain/ManagementDiagnosticWizard";
import { PageHeader } from "@/components/layout/PageHeader";
import { getClient } from "@/lib/db/queries/clients";
import { getDiagnosticById } from "@/lib/db/queries/diagnostics";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; diagnosticId: string }>;
}) {
  const { id, diagnosticId } = await params;
  if (!UUID_RE.test(id) || !UUID_RE.test(diagnosticId)) redirect("/clients");

  const [client, diagnostic] = await Promise.all([
    getClient(id),
    getDiagnosticById(diagnosticId),
  ]);

  if (!client) redirect("/clients");
  if (!diagnostic || diagnostic.client_id !== client.id) {
    redirect(`/clients/${id}`);
  }

  return (
    <>
      <PageHeader
        title="Editar Diagnóstico de Gestão"
        subtitle={`${client.name} · Edição de Respostas`}
      />
      <ManagementDiagnosticWizard
        clientId={client.id}
        clientName={client.name}
        initialDiagnostic={diagnostic}
      />
    </>
  );
}
