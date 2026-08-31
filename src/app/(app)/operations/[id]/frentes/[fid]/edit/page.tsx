import { redirect } from "next/navigation";
import { AllocationsSection } from "@/components/domain/AllocationsSection";
import { FrenteForm } from "@/components/domain/FrenteForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { getProfile } from "@/lib/auth/server";
import { listAllocationsByFrente } from "@/lib/db/queries/allocations";
import { getFrente } from "@/lib/db/queries/frentes";
import { getOperation } from "@/lib/db/queries/operations";
import { listInternalPersons } from "@/lib/db/queries/persons";
import { listActiveServiceProducts } from "@/lib/db/queries/service-products";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; fid: string }>;
}) {
  const { id, fid } = await params;
  if (!UUID_RE.test(id) || !UUID_RE.test(fid)) redirect("/operations");

  const [op, frente, persons, allocations, products] =
    await Promise.all([
      getOperation(id),
      getFrente(fid),
      listInternalPersons(),
      listAllocationsByFrente(fid),
      listActiveServiceProducts(),
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
        products={products}
        canArchive={true}
        archiveBlockedReason={null}
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
