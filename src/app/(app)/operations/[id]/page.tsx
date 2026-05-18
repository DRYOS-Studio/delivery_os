import Link from "next/link";
import { notFound } from "next/navigation";
import { AttachmentsSection } from "@/components/domain/AttachmentsSection";
import { FinanceCards } from "@/components/domain/FinanceCards";
import { FrentesListSection } from "@/components/domain/FrentesListSection";
import { MeetingsDecisionsTimeline } from "@/components/domain/MeetingsDecisionsTimeline";
import { OperationHero } from "@/components/domain/OperationHero";
import { OperationVillainsSection } from "@/components/domain/OperationVillainsSection";
import { PublicLinksSection } from "@/components/domain/PublicLinksSection";
import { QuickWinsSection } from "@/components/domain/QuickWinsSection";
import { SLASection } from "@/components/domain/SLASection";
import { TabsNav, type TabDef } from "@/components/ui/TabsNav";
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

type OperationTabKey =
  | "visao"
  | "frentes"
  | "briefing"
  | "eventos"
  | "anexos"
  | "sla"
  | "publico";

const VALID_TABS: ReadonlyArray<OperationTabKey> = [
  "visao",
  "frentes",
  "briefing",
  "eventos",
  "anexos",
  "sla",
  "publico",
];

function normalizeTab(raw: string | undefined): OperationTabKey {
  return VALID_TABS.includes(raw as OperationTabKey)
    ? (raw as OperationTabKey)
    : "visao";
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
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

  const { tab: tabRaw } = await searchParams;
  const tab = normalizeTab(tabRaw);

  const tabs: ReadonlyArray<TabDef<OperationTabKey>> = [
    { key: "visao", label: "Visão geral" },
    { key: "frentes", label: "Frentes", count: op.frentes.length },
    { key: "briefing", label: "Briefing" },
    {
      key: "eventos",
      label: "Reuniões & Decisões",
      count: meetings.length + decisions.length,
    },
    { key: "anexos", label: "Anexos", count: attachments.length },
    { key: "sla", label: "SLA", count: openIncidentsCount },
    { key: "publico", label: "Acesso público" },
  ];

  return (
    <>
      <OperationHero
        op={op}
        briefingFreshness={briefingFreshness}
        isAdmin={isAdmin}
      />

      <TabsNav<OperationTabKey>
        tabs={tabs}
        activeTab={tab}
        basePath={`/operations/${op.id}`}
      />

      {tab === "visao" && (
        <>
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
            operationFrentes={op.frentes.map((f) => ({
              id: f.id,
              name: f.name,
            }))}
            isAdmin={isAdmin}
          />
          <FinanceCards op={op} isAdmin={isAdmin} />
        </>
      )}

      {tab === "frentes" && (
        <FrentesListSection frentes={op.frentes} operationId={op.id} />
      )}

      {tab === "briefing" && (
        <section className="mb-9">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-lg text-ink font-semibold">
              Briefing vivo
            </h2>
            <Link
              href={`/operations/${op.id}/briefing`}
              className="font-mono text-xs text-oak hover:underline"
            >
              {briefingFreshness.hasBriefing
                ? "Abrir briefing →"
                : "Criar briefing →"}
            </Link>
          </div>
          <p className="text-sm text-mute">
            {briefingFreshness.hasBriefing
              ? `Última atualização ${relativeFromNow(briefingFreshness.updatedAt)}.`
              : "Esta Operação ainda não tem briefing."}
          </p>
        </section>
      )}

      {tab === "eventos" && (
        <MeetingsDecisionsTimeline
          meetings={meetings}
          decisions={decisions}
          operationId={op.id}
          meetingAttachmentCounts={meetingAttachmentCounts}
        />
      )}

      {tab === "anexos" && (
        <AttachmentsSection
          attachments={attachments}
          operationId={op.id}
          isAdmin={isAdmin}
        />
      )}

      {tab === "sla" && (
        <SLASection
          incidents={incidents}
          openCount={openIncidentsCount}
          op={{
            response_hours: op.responseHours,
            resolution_hours: op.resolutionHours,
          }}
          operationId={op.id}
        />
      )}

      {tab === "publico" && (
        <PublicLinksSection
          links={publicLinks}
          operationId={op.id}
          baseUrl={baseUrl}
          isAdmin={isAdmin}
        />
      )}
    </>
  );
}
