import Link from "next/link";
import { notFound } from "next/navigation";
import { AreaTasksSection } from "@/components/domain/AreaTasksSection";
import { AttachmentsSection } from "@/components/domain/AttachmentsSection";
import { CostsTab } from "@/components/domain/CostsTab";
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
import { getOperationMonthlyCosts } from "@/lib/db/queries/operation-costs";
import { computeMargin, type MarginResult } from "@/lib/utils/margin";
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
import { canWriteOperation } from "@/lib/db/queries/operation-members";
import { getOperation } from "@/lib/db/queries/operations";
import { listPublicLinksByOperation } from "@/lib/db/queries/publicLinks";
import { canCreateAreaTaskInOperation } from "@/lib/db/queries/areas";
import { listActiveQuickWinCatalog } from "@/lib/db/queries/quick-win-catalog";
import { listQuickWinsByOperation } from "@/lib/db/queries/quick-wins";
import { listAreaTasksByOperation } from "@/lib/db/queries/tasks";
import { listVillainNarratives } from "@/lib/db/queries/villain-narratives";
import { relativeFromNow } from "@/lib/utils/date";
import { getCurrentPeriod } from "@/lib/utils/period";
import { getBaseUrl } from "@/lib/utils/url";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type OperationTabKey =
  | "visao"
  | "frentes"
  | "briefing"
  | "eventos"
  | "anexos"
  | "sla"
  | "interno"
  | "custos"
  | "publico";

// "interno" NÃO entra aqui — é condicional a ter acesso de área (showAreaTab).
const PUBLIC_TABS: ReadonlyArray<OperationTabKey> = [
  "visao",
  "frentes",
  "briefing",
  "eventos",
  "anexos",
  "sla",
  "publico",
];

function normalizeTab(
  raw: string | undefined,
  isAdmin: boolean,
  showAreaTab: boolean,
): OperationTabKey {
  const allowed: ReadonlyArray<OperationTabKey> = [
    ...PUBLIC_TABS,
    ...(showAreaTab ? (["interno"] as const) : []),
    ...(isAdmin ? (["custos"] as const) : []),
  ];
  return allowed.includes(raw as OperationTabKey)
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

  const currentPeriod = getCurrentPeriod();
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
    costsBreakdown,
    villainNarratives,
    quickWinCatalogItems,
    areaTasks,
    canWrite,
    canCreateAreaTask,
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
    getOperationMonthlyCosts(id),
    listVillainNarratives(id, currentPeriod.yyyymm),
    listActiveQuickWinCatalog(),
    listAreaTasksByOperation(id),
    canWriteOperation(id),
    canCreateAreaTaskInOperation(id),
  ]);
  if (!op) notFound();

  // Aba "Área / Interno" só pra quem tem acesso de área: vê tarefa de área OU
  // pode criar (admin / membro de área com concessão). Some pro resto.
  const showAreaTab = areaTasks.length > 0 || canCreateAreaTask;

  const { tab: tabRaw } = await searchParams;
  const tab = normalizeTab(tabRaw, isAdmin, showAreaTab);

  const margin: MarginResult | null = isAdmin
    ? computeMargin(op.monthlyRecurringRevenue, costsBreakdown.totalMonthly)
    : null;

  const baseTabs: TabDef<OperationTabKey>[] = [
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
  ];
  if (showAreaTab) {
    baseTabs.push({
      key: "interno",
      label: "Área / Interno",
      count: areaTasks.length,
    });
  }
  if (isAdmin) {
    baseTabs.push({
      key: "custos",
      label: "Custos",
      count: costsBreakdown.adHocItems.length,
    });
  }
  baseTabs.push({ key: "publico", label: "Acesso público" });
  const tabs: ReadonlyArray<TabDef<OperationTabKey>> = baseTabs;

  return (
    <>
      <OperationHero
        op={op}
        briefingFreshness={briefingFreshness}
        isAdmin={isAdmin}
        margin={margin}
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
            currentPeriodYyyymm={currentPeriod.yyyymm}
            currentPeriodLabel={`${currentPeriod.monthLabel} ${currentPeriod.year}`}
            narrativesByVillainId={villainNarratives}
          />
          <QuickWinsSection
            quickWins={quickWins}
            operationId={op.id}
            operationVillains={operationVillains}
            operationFrentes={op.frentes.map((f) => ({
              id: f.id,
              name: f.name,
            }))}
            catalogItems={quickWinCatalogItems}
            isAdmin={isAdmin}
          />
          <FinanceCards op={op} isAdmin={isAdmin} />
        </>
      )}

      {tab === "frentes" && (
        <FrentesListSection
          frentes={op.frentes}
          operationId={op.id}
          canWrite={canWrite}
        />
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
          canWrite={canWrite}
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
          canWrite={canWrite}
        />
      )}

      {tab === "interno" && showAreaTab && (
        <AreaTasksSection
          tasks={areaTasks}
          operationId={op.id}
          isAdmin={isAdmin}
          canCreate={canCreateAreaTask}
        />
      )}

      {tab === "custos" && isAdmin && (
        <CostsTab operationId={op.id} breakdown={costsBreakdown} />
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
