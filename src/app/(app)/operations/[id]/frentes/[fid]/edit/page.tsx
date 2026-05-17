import { redirect } from "next/navigation";
import { AllocationsSection } from "@/components/domain/AllocationsSection";
import { FrenteForm } from "@/components/domain/FrenteForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { getProfile } from "@/lib/auth/server";
import { listAllocationsByFrente } from "@/lib/db/queries/allocations";
import {
  frenteHasActiveAllocations,
  getFrente,
} from "@/lib/db/queries/frentes";
import { getOperation } from "@/lib/db/queries/operations";
import { listInternalPersons } from "@/lib/db/queries/persons";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; fid: string }>;
}) {
  const { id, fid } = await params;
  if (!UUID_RE.test(id) || !UUID_RE.test(fid)) redirect("/operations");

  const [op, frente, hasAllocs, persons, allocations] = await Promise.all([
    getOperation(id),
    getFrente(fid),
    frenteHasActiveAllocations(fid),
    listInternalPersons(),
    listAllocationsByFrente(fid),
  ]);
  if (!op) redirect("/operations");
  if (!frente) redirect(`/operations/${id}`);
  if (frente.operation_id !== id) redirect(`/operations/${id}`);

  const profile = await getProfile();
  const isAdmin = profile?.role === "admin";

  return (
    <>
      <PageHeader
        title={`Editar Frente — ${frente.name}`}
        subtitle={`${op.client.name} · ${op.name}`}
      />
      <FrenteForm
        mode="edit"
        initialData={frente}
        operationId={id}
        internalPersons={persons}
        canArchive={!hasAllocs}
        isAdmin={isAdmin}
      />
      <AllocationsSection
        allocations={allocations}
        operationId={id}
        frenteId={fid}
      />
    </>
  );
}
