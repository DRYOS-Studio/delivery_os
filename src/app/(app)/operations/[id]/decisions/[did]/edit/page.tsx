import { redirect } from "next/navigation";
import { DecisionForm } from "@/components/domain/DecisionForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { getDecision } from "@/lib/db/queries/decisions";
import { listMeetingsByOperation } from "@/lib/db/queries/meetings";
import { getOperation } from "@/lib/db/queries/operations";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; did: string }>;
}) {
  const { id, did } = await params;
  if (!UUID_RE.test(id) || !UUID_RE.test(did)) redirect("/operations");

  const [op, decision, meetings] = await Promise.all([
    getOperation(id),
    getDecision(did),
    listMeetingsByOperation(id, 100),
  ]);
  if (!op) redirect("/operations");
  if (!decision) redirect(`/operations/${id}`);
  if (decision.operation_id !== id) redirect(`/operations/${id}`);

  return (
    <>
      <PageHeader
        title={`Editar decisão — ${decision.title}`}
        subtitle={`${op.client.name} · ${op.name}`}
      />
      <DecisionForm
        mode="edit"
        operationId={op.id}
        initialData={decision}
        meetings={meetings}
      />
    </>
  );
}
