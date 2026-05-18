import { notFound } from "next/navigation";
import { CostForm } from "@/components/domain/CostForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireAdmin } from "@/lib/auth/server";
import { getOperationCost } from "@/lib/db/queries/operation-costs";
import { getOperation } from "@/lib/db/queries/operations";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; cid: string }>;
}) {
  const { id, cid } = await params;
  const profile = await requireAdmin(`/operations/${id}`);
  const [op, cost] = await Promise.all([
    getOperation(id),
    getOperationCost(cid),
  ]);
  if (!op || !cost || cost.operationId !== id) notFound();

  return (
    <>
      <PageHeader
        title="Editar custo"
        subtitle={`${op.client.name} · ${op.name}`}
      />
      <CostForm
        mode="edit"
        operationId={id}
        initialData={cost}
        isAdmin={profile.role === "admin"}
      />
    </>
  );
}
