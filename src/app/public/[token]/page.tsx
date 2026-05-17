import { notFound } from "next/navigation";
import { PublicAttachmentsList } from "@/components/domain/PublicAttachmentsList";
import { PublicFrentesList } from "@/components/domain/PublicFrentesList";
import { PublicHero } from "@/components/domain/PublicHero";
import { PublicSLAList } from "@/components/domain/PublicSLAList";
import { PublicTimeline } from "@/components/domain/PublicTimeline";
import { listPublicIncidents } from "@/lib/db/queries/incidents";
import {
  getOperationPublicView,
  listPublicAttachments,
  listPublicDecisions,
  listPublicMeetings,
} from "@/lib/db/queries/public";
import {
  getPublicLinkByToken,
  touchPublicLinkAccess,
} from "@/lib/db/queries/publicLinks";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!UUID_RE.test(token)) notFound();

  const link = await getPublicLinkByToken(token);
  if (!link || link.revokedAt !== null) notFound();

  // Fire-and-forget; sem await crítico
  await touchPublicLinkAccess(link.id);

  const [op, meetings, decisions, attachments, incidents] = await Promise.all([
    getOperationPublicView(link.operationId),
    listPublicMeetings(link.operationId),
    listPublicDecisions(link.operationId),
    listPublicAttachments(link.operationId),
    listPublicIncidents(link.operationId),
  ]);
  if (!op) notFound();

  return (
    <>
      <PublicHero op={op} />
      <PublicFrentesList frentes={op.frentes} />
      <PublicTimeline meetings={meetings} decisions={decisions} />
      <PublicAttachmentsList attachments={attachments} token={token} />
      <PublicSLAList
        incidents={incidents}
        op={{
          response_hours: op.responseHours,
          resolution_hours: op.resolutionHours,
        }}
      />
    </>
  );
}
