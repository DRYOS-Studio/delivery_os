import { redirect } from "next/navigation";
import { DecisionForm } from "@/components/domain/DecisionForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { listMeetingsByOperation } from "@/lib/db/queries/meetings";
import { getOperation } from "@/lib/db/queries/operations";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) redirect("/operations");

  const [op, meetings] = await Promise.all([
    getOperation(id),
    listMeetingsByOperation(id, 100),
  ]);
  if (!op) redirect("/operations");
  if (op.status === "arquivada") redirect(`/operations/${id}`);

  return (
    <>
      <PageHeader
        title="Nova decisão"
        subtitle={`${op.client.name} · ${op.name}`}
      />
      <DecisionForm mode="create" operationId={op.id} meetings={meetings} />
    </>
  );
}
