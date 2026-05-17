import { redirect } from "next/navigation";
import { AllocationForm } from "@/components/domain/AllocationForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { getFrente } from "@/lib/db/queries/frentes";
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

  const [op, frente, persons] = await Promise.all([
    getOperation(id),
    getFrente(fid),
    listInternalPersons(),
  ]);
  if (!op) redirect("/operations");
  if (!frente) redirect(`/operations/${id}`);
  if (frente.operation_id !== id) redirect(`/operations/${id}`);

  return (
    <>
      <PageHeader
        title="Nova alocação"
        subtitle={`${frente.name} · ${op.name} · ${op.client.name}`}
      />
      <AllocationForm
        mode="create"
        operationId={id}
        frenteId={fid}
        internalPersons={persons}
      />
    </>
  );
}
