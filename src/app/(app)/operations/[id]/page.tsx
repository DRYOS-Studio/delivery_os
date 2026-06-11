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
  countOperationAttachments,
  listAttachmentsByOperation,
} from "@/lib/db/queries/attachments";
import { getBriefingFreshness } from "@/lib/db/queries/briefings";
import {
  countDecisionsByOperation,
  listDecisionsByOperation,
} from "@/lib/db/queries/decisions";
import {
  countOpenIncidents,
  listIncidentsByOperation,
} from "@/lib/db/queries/incidents";
import {
  countMeetingsByOperation,
  listMeetingsByOperation,
} from "@/lib/db/queries/meetings";
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
import {
  countAreaTasksByOperation,
  listAreaTasksByOperation,
} from "@/lib/db/queries/tasks";
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

// Conteúdo pesado por tab — só a tab ativa busca (audit #14). Badges NUNCA
// derivam destas listas (vêm dos counts head:true do shell — listas de
// meetings/decisions têm limit 20 e fariam o badge flip-flopar entre tabs).
type TabContent = {
  meetings: Awaited<ReturnType<typeof listMeetingsByOperation>>;
  decisions: Awaited<ReturnType<typeof listDecisionsByOperation>>;
  meetingAttachmentCounts: Awaited<ReturnType<typeof countAttachmentsByMeeting>>;
  attachments: Awaited<ReturnType<typeof listAttachmentsByOperation>>;
  incidents: Awaited<ReturnType<typeof listIncidentsByOperation>>;
  operationVillains: Awaited<ReturnType<typeof listVillainsByOperation>>;
  availableVillains: Awaited<ReturnType<typeof listAvailableVillains>>;
  quickWins: Awaited<ReturnType<typeof listQuickWinsByOperation>>;
  villainNarratives: Awaited<ReturnType<typeof listVillainNarratives>>;
  quickWinCatalogItems: Awaited<ReturnType<typeof listActiveQuickWinCatalog>>;
  areaTasks: Awaited<ReturnType<typeof listAreaTasksByOperation>>;
  publicLinks: Awaited<ReturnType<typeof listPublicLinksByOperation>>;
  baseUrl: string;
};

function emptyTabContent(): TabContent {
  return {
    meetings: [],
    decisions: [],
    meetingAttachmentCounts: new Map(),
    attachments: [],
    incidents: [],
    operationVillains: [],
    availableVillains: [],
    quickWins: [],
    villainNarratives: {},
    quickWinCatalogItems: [],
    areaTasks: [],
    publicLinks: [],
    baseUrl: "",
  };
}

async function loadTabContent(
  tab: OperationTabKey,
  id: string,
  yyyymm: string,
): Promise<TabContent> {
  const base = emptyTabContent();
  switch (tab) {
    case "visao": {
      const [
        operationVillains,
        availableVillains,
        quickWins,
        villainNarratives,
        quickWinCatalogItems,
      ] = await Promise.all([
        listVillainsByOperation(id),
        listAvailableVillains(id),
        listQuickWinsByOperation(id),
        listVillainNarratives(id, yyyymm),
        listActiveQuickWinCatalog(),
      ]);
      return {
        ...base,
        operationVillains,
        availableVillains,
        quickWins,
        villainNarratives,
        quickWinCatalogItems,
      };
    }
    case "eventos": {
      const [meetings, decisions, meetingAttachmentCounts] = await Promise.all([
        listMeetingsByOperation(id),
        listDecisionsByOperation(id),
        countAttachmentsByMeeting(id),
      ]);
      return { ...base, meetings, decisions, meetingAttachmentCounts };
    }
    case "anexos": {
      const attachments = await listAttachmentsByOperation(id, "none");
      return { ...base, attachments };
    }
    case "sla": {
      const incidents = await listIncidentsByOperation(id);
      return { ...base, incidents };
    }
    case "interno": {
      const areaTasks = await listAreaTasksByOperation(id);
      return { ...base, areaTasks };
    }
    case "publico": {
      const [publicLinks, baseUrl] = await Promise.all([
        listPublicLinksByOperation(id),
        getBaseUrl(),
      ]);
      return { ...base, publicLinks, baseUrl };
    }
    // "frentes" (op.frentes), "briefing" e "custos" (shell) não têm query própria.
    default:
      return base;
  }
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

  const currentPeriod = getCurrentPeriod();

  // Onda 1 — gates: tudo que normalizeTab precisa (isAdmin, showAreaTab) e o
  // notFound cedo. getProfile já era uma onda serial antes; agora ela é
  // paralela e carrega os gates junto (audit #14).
  const [profile, op, canCreateAreaTask, areaTasksCount] = await Promise.all([
    getProfile(),
    getOperation(id),
    canCreateAreaTaskInOperation(id),
    countAreaTasksByOperation(id),
  ]);
  if (!op) notFound();

  const isAdmin = profile?.role === "admin";
  // Aba "Área / Interno" só pra quem tem acesso de área: vê tarefa de área OU
  // pode criar (admin / membro de área com concessão). Some pro resto.
  const showAreaTab = areaTasksCount > 0 || canCreateAreaTask;

  const { tab: tabRaw } = await searchParams;
  const tab = normalizeTab(tabRaw, isAdmin, showAreaTab);

  // Onda 2 — shell (counts de badge + gates de escrita + custos se admin) +
  // conteúdo da tab ativa. Custos NUNCA roda pra member (antes rodava e o
  // resultado era descartado); pra admin roda inteiro em qualquer tab porque
  // alimenta a margin do hero e o badge da tab custos.
  const [
    briefingFreshness,
    canWrite,
    meetingsCount,
    decisionsCount,
    attachmentsCount,
    openIncidentsCount,
    costsBreakdown,
    tabContent,
  ] = await Promise.all([
    getBriefingFreshness(id),
    canWriteOperation(id),
    countMeetingsByOperation(id),
    countDecisionsByOperation(id),
    countOperationAttachments(id),
    countOpenIncidents(id),
    isAdmin ? getOperationMonthlyCosts(id) : Promise.resolve(null),
    loadTabContent(tab, id, currentPeriod.yyyymm),
  ]);

  const {
    meetings,
    decisions,
    meetingAttachmentCounts,
    attachments,
    incidents,
    operationVillains,
    availableVillains,
    quickWins,
    villainNarratives,
    quickWinCatalogItems,
    areaTasks,
    publicLinks,
    baseUrl,
  } = tabContent;

  const margin: MarginResult | null =
    isAdmin && costsBreakdown
      ? computeMargin(op.monthlyRecurringRevenue, costsBreakdown.totalMonthly)
      : null;

  const baseTabs: TabDef<OperationTabKey>[] = [
    { key: "visao", label: "Visão geral" },
    { key: "frentes", label: "Frentes", count: op.frentes.length },
    { key: "briefing", label: "Briefing" },
    {
      key: "eventos",
      label: "Reuniões & Decisões",
      // Counts head:true uncapped — a lista tem limit 20; badge passa a
      // mostrar o total real (antes era capped em 40).
      count: meetingsCount + decisionsCount,
    },
    { key: "anexos", label: "Anexos", count: attachmentsCount },
    { key: "sla", label: "SLA", count: openIncidentsCount },
  ];
  if (showAreaTab) {
    baseTabs.push({
      key: "interno",
      label: "Área / Interno",
      count: areaTasksCount,
    });
  }
  if (isAdmin && costsBreakdown) {
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

      {tab === "custos" && isAdmin && costsBreakdown && (
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
