import Link from "next/link";
import { notFound } from "next/navigation";
import { AttachmentsSection } from "@/components/domain/AttachmentsSection";
import { FinanceCards } from "@/components/domain/FinanceCards";
import { FrentesListSection } from "@/components/domain/FrentesListSection";
import { MeetingsDecisionsTimeline } from "@/components/domain/MeetingsDecisionsTimeline";
import { OperationHero } from "@/components/domain/OperationHero";
import { PlaceholderSection } from "@/components/domain/PlaceholderSection";
import {
  countAttachmentsByMeeting,
  listAttachmentsByOperation,
} from "@/lib/db/queries/attachments";
import { getBriefingFreshness } from "@/lib/db/queries/briefings";
import { listDecisionsByOperation } from "@/lib/db/queries/decisions";
import { listMeetingsByOperation } from "@/lib/db/queries/meetings";
import { getOperation } from "@/lib/db/queries/operations";
import { relativeFromNow } from "@/lib/utils/date";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const [
    op,
    briefingFreshness,
    meetings,
    decisions,
    attachments,
    meetingAttachmentCounts,
  ] = await Promise.all([
    getOperation(id),
    getBriefingFreshness(id),
    listMeetingsByOperation(id),
    listDecisionsByOperation(id),
    listAttachmentsByOperation(id, "none"),
    countAttachmentsByMeeting(id),
  ]);
  if (!op) notFound();

  return (
    <>
      <OperationHero op={op} briefingFreshness={briefingFreshness} />

      <PlaceholderSection
        title="Vilões em luta"
        subtitle="Quando o Diagnóstico estiver pronto, os vilões da Operação aparecem aqui com progresso e quick wins."
        comingIn="sem 04"
      />

      <FrentesListSection frentes={op.frentes} operationId={op.id} />

      <section className="mb-9">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg text-ink font-semibold">
            Briefing vivo
          </h2>
          <Link
            href={`/operations/${op.id}/briefing`}
            className="font-mono text-xs text-oak hover:underline"
          >
            {briefingFreshness.hasBriefing ? "Abrir briefing →" : "Criar briefing →"}
          </Link>
        </div>
        <p className="text-sm text-mute">
          {briefingFreshness.hasBriefing
            ? `Última atualização ${relativeFromNow(briefingFreshness.updatedAt)}.`
            : "Esta Operação ainda não tem briefing."}
        </p>
      </section>

      <MeetingsDecisionsTimeline
        meetings={meetings}
        decisions={decisions}
        operationId={op.id}
        meetingAttachmentCounts={meetingAttachmentCounts}
      />

      <AttachmentsSection attachments={attachments} operationId={op.id} />

      <FinanceCards op={op} />

      <PlaceholderSection
        title="Credenciais"
        subtitle="Referências pro Bitwarden (ou Vaultwarden self-host). Adiada na v2."
        comingIn="v2 (AD-009)"
      />
    </>
  );
}
