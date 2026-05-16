import { redirect } from "next/navigation";
import { FrenteForm } from "@/components/domain/FrenteForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { getOperation } from "@/lib/db/queries/operations";
import { listInternalPersons } from "@/lib/db/queries/persons";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) redirect("/operations");

  const [op, persons] = await Promise.all([
    getOperation(id),
    listInternalPersons(),
  ]);
  if (!op) redirect("/operations");

  return (
    <>
      <PageHeader
        title={`Nova Frente — ${op.client.name}`}
        subtitle={op.name}
      />
      <FrenteForm
        mode="create"
        operationId={id}
        internalPersons={persons}
      />
    </>
  );
}
