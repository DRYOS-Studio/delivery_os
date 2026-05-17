import { redirect } from "next/navigation";
import { AllocationForm } from "@/components/domain/AllocationForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { getAllocation } from "@/lib/db/queries/allocations";
import { getFrente } from "@/lib/db/queries/frentes";
import { getOperation } from "@/lib/db/queries/operations";
import { listInternalPersons } from "@/lib/db/queries/persons";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; fid: string; aid: string }>;
}) {
  const { id, fid, aid } = await params;
  if (!UUID_RE.test(id) || !UUID_RE.test(fid) || !UUID_RE.test(aid)) {
    redirect("/operations");
  }

  const [op, frente, allocation, persons] = await Promise.all([
    getOperation(id),
    getFrente(fid),
    getAllocation(aid),
    listInternalPersons(),
  ]);
  if (!op) redirect("/operations");
  if (!frente) redirect(`/operations/${id}`);
  if (frente.operation_id !== id) redirect(`/operations/${id}`);
  if (!allocation) redirect(`/operations/${id}/frentes/${fid}/edit`);
  if (allocation.frente_id !== fid)
    redirect(`/operations/${id}/frentes/${fid}/edit`);

  return (
    <>
      <PageHeader
        title="Editar alocação"
        subtitle={`${frente.name} · ${op.name} · ${op.client.name}`}
      />
      <AllocationForm
        mode="edit"
        initialData={allocation}
        operationId={id}
        frenteId={fid}
        internalPersons={persons}
      />
    </>
  );
}
