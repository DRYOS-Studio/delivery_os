import { redirect } from "next/navigation";
import { OperationForm } from "@/components/domain/OperationForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { getProfile } from "@/lib/auth/server";
import { listClients } from "@/lib/db/queries/clients";
import { listDiagnosticsForSelect } from "@/lib/db/queries/diagnostics";
import {
  getOperation,
  operationHasActiveFrentes,
} from "@/lib/db/queries/operations";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) redirect("/operations");

  const [op, hasFrentes, clients, diagnosticsByClient] = await Promise.all([
    getOperation(id),
    operationHasActiveFrentes(id),
    listClients(),
    listDiagnosticsForSelect(),
  ]);
  if (!op) redirect("/operations");

  const profile = await getProfile();
  const isAdmin = profile?.role === "admin";

  const clientsForSelect = clients.map((c) => ({ id: c.id, name: c.name }));

  return (
    <>
      <PageHeader title={`Editar — ${op.client.name}`} subtitle={op.name} />
      <OperationForm
        mode="edit"
        initialData={op}
        clientsForSelect={clientsForSelect}
        canArchive={!hasFrentes}
        diagnosticsByClient={diagnosticsByClient}
        isAdmin={isAdmin}
      />
    </>
  );
}
