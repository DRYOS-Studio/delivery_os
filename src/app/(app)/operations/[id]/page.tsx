import Link from "next/link";
import { notFound } from "next/navigation";
import { AttachmentsSection } from "@/components/domain/AttachmentsSection";
import { FinanceCards } from "@/components/domain/FinanceCards";
import { FrentesListSection } from "@/components/domain/FrentesListSection";
import { MeetingsDecisionsTimeline } from "@/components/domain/MeetingsDecisionsTimeline";
import { OperationHero } from "@/components/domain/OperationHero";
import { OperationVillainsSection } from "@/components/domain/OperationVillainsSection";
import { PlaceholderSection } from "@/components/domain/PlaceholderSection";
import { PublicLinksSection } from "@/components/domain/PublicLinksSection";
import { QuickWinsSection } from "@/components/domain/QuickWinsSection";
import { SLASection } from "@/components/domain/SLASection";
import { getProfile } from "@/lib/auth/server";
import {
  countAttachmentsByMeeting,
  listAttachmentsByOperation,
} from "@/lib/db/queries/attachments";
import { getBriefingFreshness } from "@/lib/db/queries/briefings";
import { listDecisionsByOperation } from "@/lib/db/queries/decisions";
import {
  countOpenIncidents,
  listIncidentsByOperation,
} from "@/lib/db/queries/incidents";
import { listMeetingsByOperation } from "@/lib/db/queries/meetings";
import {
  listAvailableVillains,
  listVillainsByOperation,
} from "@/lib/db/queries/operation-villains";
import { getOperation } from "@/lib/db/queries/operations";
import { listPublicLinksByOperation } from "@/lib/db/queries/publicLinks";
import { listQuickWinsByOperation } from "@/lib/db/queries/quick-wins";
import { relativeFromNow } from "@/lib/utils/date";
import { getBaseUrl } from "@/lib/utils/url";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const profile = await getProfile();
  const isAdmin = profile?.role === "admin";

  const [
    op,
    briefingFreshness,
    meetings,
    decisions,
    attachments,
    meetingAttachmentCounts,
    publicLinks,
    baseUrl,
    incidents,
    openIncidentsCount,
    operationVillains,
    availableVillains,
    quickWins,
  ] = await Promise.all([
    getOperation(id),
    getBriefingFreshness(id),
    listMeetingsByOperation(id),
    listDecisionsByOperation(id),
    listAttachmentsByOperation(id, "none"),
    countAttachmentsByMeeting(id),
    listPublicLinksByOperation(id),
    getBaseUrl(),
    listIncidentsByOperation(id),
    countOpenIncidents(id),
    listVillainsByOperation(id),
    listAvailableVillains(id),
    listQuickWinsByOperation(id),
  ]);
  if (!op) notFound();

  return (
    <>
      <OperationHero op={op} briefingFreshness={briefingFreshness} isAdmin={isAdmin} />

      <OperationVillainsSection
        items={operationVillains}
        availableVillains={availableVillains}
        operationId={op.id}
        isAdmin={isAdmin}
      />

      <QuickWinsSection
        quickWins={quickWins}
        operationId={op.id}
        operationVillains={operationVillains}
        operationFrentes={op.frentes.map((f) => ({ id: f.id, name: f.name }))}
        isAdmin={isAdmin}
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

      <AttachmentsSection attachments={attachments} operationId={op.id} isAdmin={isAdmin} />

      <SLASection
        incidents={incidents}
        openCount={openIncidentsCount}
        op={{
          response_hours: op.responseHours,
          resolution_hours: op.resolutionHours,
        }}
        operationId={op.id}
      />

      <PublicLinksSection
        links={publicLinks}
        operationId={op.id}
        baseUrl={baseUrl}
        isAdmin={isAdmin}
      />

      <FinanceCards op={op} isAdmin={isAdmin} />

      <PlaceholderSection
        title="Credenciais"
        subtitle="Referências pro Bitwarden (ou Vaultwarden self-host). Adiada na v2."
        comingIn="v2 (AD-009)"
      />
    </>
  );
}
