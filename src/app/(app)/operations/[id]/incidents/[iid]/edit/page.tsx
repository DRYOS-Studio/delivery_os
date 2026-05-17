import { redirect } from "next/navigation";
import { IncidentForm } from "@/components/domain/IncidentForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { getProfile } from "@/lib/auth/server";
import { getIncident } from "@/lib/db/queries/incidents";
import { getOperation } from "@/lib/db/queries/operations";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; iid: string }>;
}) {
  const { id, iid } = await params;
  if (!UUID_RE.test(id) || !UUID_RE.test(iid)) redirect("/operations");

  const [op, incident] = await Promise.all([
    getOperation(id),
    getIncident(iid),
  ]);
  if (!op) redirect("/operations");
  if (!incident) redirect(`/operations/${id}`);
  if (incident.operation_id !== id) redirect(`/operations/${id}`);

  const profile = await getProfile();
  const isAdmin = profile?.role === "admin";

  return (
    <>
      <PageHeader
        title={`Editar incidente — ${incident.title}`}
        subtitle={`${op.client.name} · ${op.name}`}
      />
      <IncidentForm mode="edit" operationId={op.id} initialData={incident} isAdmin={isAdmin} />
    </>
  );
}
