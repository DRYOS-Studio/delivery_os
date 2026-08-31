import { redirect } from "next/navigation";
import { MeetingForm } from "@/components/domain/MeetingForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { listAttendeeCandidates } from "@/lib/db/queries/meetings";
import { getOperation } from "@/lib/db/queries/operations";
import { isActiveStatus } from "@/lib/utils/operation-status";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) redirect("/operations");

  const op = await getOperation(id);
  if (!op) redirect("/operations");
  // Barra qualquer status terminal, não só o legado `arquivada`: contrato
  // encerrado não recebe registro novo.
  if (!isActiveStatus(op.status)) redirect(`/operations/${id}`);

  const attendeeCandidates = await listAttendeeCandidates(op.client.id);

  return (
    <>
      <PageHeader
        title="Nova reunião"
        subtitle={`${op.client.name} · ${op.name}`}
      />
      <MeetingForm
        mode="create"
        operationId={op.id}
        clientName={op.client.name}
        attendeeCandidates={attendeeCandidates}
      />
    </>
  );
}
