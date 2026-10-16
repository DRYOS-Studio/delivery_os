import { redirect } from "next/navigation";
import { ManagementDiagnosticWizard } from "@/components/domain/ManagementDiagnosticWizard";
import { PageHeader } from "@/components/layout/PageHeader";
import { getClient } from "@/lib/db/queries/clients";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) redirect("/clients");

  const client = await getClient(id);
  if (!client) redirect("/clients");

  return (
    <>
      <PageHeader
        title="Novo Diagnóstico de Gestão"
        subtitle={`${client.name} · Preenchimento em 13 Dimensões`}
      />
      <ManagementDiagnosticWizard
        clientId={client.id}
        clientName={client.name}
      />
    </>
  );
}
