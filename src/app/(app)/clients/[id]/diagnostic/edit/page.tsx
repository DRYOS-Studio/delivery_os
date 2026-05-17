import { redirect } from "next/navigation";
import { DiagnosticForm } from "@/components/domain/DiagnosticForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { getClient } from "@/lib/db/queries/clients";
import { getDiagnosticByClient } from "@/lib/db/queries/diagnostics";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) redirect("/clients");

  const [client, diagnostic] = await Promise.all([
    getClient(id),
    getDiagnosticByClient(id),
  ]);
  if (!client) redirect("/clients");

  return (
    <>
      <PageHeader
        title={diagnostic ? "Editar diagnóstico" : "Novo diagnóstico"}
        subtitle={client.name}
      />
      <DiagnosticForm clientId={client.id} initialData={diagnostic} />
    </>
  );
}
