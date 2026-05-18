import { notFound } from "next/navigation";
import { CostForm } from "@/components/domain/CostForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireAdmin } from "@/lib/auth/server";
import { getOperation } from "@/lib/db/queries/operations";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireAdmin(`/operations/${(await params).id}`);
  const { id } = await params;
  const op = await getOperation(id);
  if (!op) notFound();

  return (
    <>
      <PageHeader
        title="Novo custo"
        subtitle={`${op.client.name} · ${op.name}`}
      />
      <CostForm
        mode="create"
        operationId={id}
        isAdmin={profile.role === "admin"}
      />
    </>
  );
}
