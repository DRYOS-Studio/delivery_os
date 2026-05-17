import { redirect } from "next/navigation";
import { IncidentForm } from "@/components/domain/IncidentForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { getOperation } from "@/lib/db/queries/operations";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) redirect("/operations");

  const op = await getOperation(id);
  if (!op) redirect("/operations");

  return (
    <>
      <PageHeader
        title="Novo incidente"
        subtitle={`${op.client.name} · ${op.name}`}
      />
      <IncidentForm mode="create" operationId={op.id} />
    </>
  );
}
