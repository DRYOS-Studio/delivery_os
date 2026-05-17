import { redirect } from "next/navigation";
import { AttachmentsSection } from "@/components/domain/AttachmentsSection";
import { MeetingForm } from "@/components/domain/MeetingForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { getProfile } from "@/lib/auth/server";
import { listAttachmentsByMeeting } from "@/lib/db/queries/attachments";
import {
  getMeeting,
  listAttendeeCandidates,
} from "@/lib/db/queries/meetings";
import { getOperation } from "@/lib/db/queries/operations";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; mid: string }>;
}) {
  const { id, mid } = await params;
  if (!UUID_RE.test(id) || !UUID_RE.test(mid)) redirect("/operations");

  const [op, meeting] = await Promise.all([
    getOperation(id),
    getMeeting(mid),
  ]);
  if (!op) redirect("/operations");
  if (!meeting) redirect(`/operations/${id}`);
  if (meeting.operation_id !== id) redirect(`/operations/${id}`);

  const [attendeeCandidates, attachments] = await Promise.all([
    listAttendeeCandidates(op.client.id),
    listAttachmentsByMeeting(mid),
  ]);

  const profile = await getProfile();
  const isAdmin = profile?.role === "admin";

  return (
    <>
      <PageHeader
        title={`Editar reunião — ${meeting.title}`}
        subtitle={`${op.client.name} · ${op.name}`}
      />
      <MeetingForm
        mode="edit"
        operationId={op.id}
        clientName={op.client.name}
        initialData={meeting}
        attendeeCandidates={attendeeCandidates}
        isAdmin={isAdmin}
      />
      <div className="mt-9">
        <AttachmentsSection
          attachments={attachments}
          operationId={op.id}
          meetingId={mid}
          isAdmin={isAdmin}
        />
      </div>
    </>
  );
}
