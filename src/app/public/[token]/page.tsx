import { notFound } from "next/navigation";
import { PublicAchievementsList } from "@/components/domain/PublicAchievementsList";
import { PublicAttachmentsList } from "@/components/domain/PublicAttachmentsList";
import { PublicFrentesList } from "@/components/domain/PublicFrentesList";
import { PublicHero } from "@/components/domain/PublicHero";
import { PublicNextMovesList } from "@/components/domain/PublicNextMovesList";
import { PublicReportBanner } from "@/components/domain/PublicReportBanner";
import { PublicReportHero } from "@/components/domain/PublicReportHero";
import { PublicSLAList } from "@/components/domain/PublicSLAList";
import { PublicTeamGrid } from "@/components/domain/PublicTeamGrid";
import { PublicTimeline } from "@/components/domain/PublicTimeline";
import { PublicVillainsList } from "@/components/domain/PublicVillainsList";
import { TabsNav, type TabDef } from "@/components/ui/TabsNav";
import { listPublicIncidents } from "@/lib/db/queries/incidents";
import {
  getOperationPublicView,
  listPublicAttachments,
  listPublicDecisions,
  listPublicMeetings,
} from "@/lib/db/queries/public";
import { getReportContext } from "@/lib/db/queries/public-report";
import {
  getPublicLinkByToken,
  touchPublicLinkAccess,
} from "@/lib/db/queries/publicLinks";
import { getCurrentPeriod } from "@/lib/utils/period";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PublicTabKey = "visao" | "frentes" | "eventos" | "anexos" | "sla";

const VALID_PUBLIC_TABS: ReadonlyArray<PublicTabKey> = [
  "visao",
  "frentes",
  "eventos",
  "anexos",
  "sla",
];

function normalizePublicTab(raw: string | undefined): PublicTabKey {
  return VALID_PUBLIC_TABS.includes(raw as PublicTabKey)
    ? (raw as PublicTabKey)
    : "visao";
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { token } = await params;
  if (!UUID_RE.test(token)) notFound();

  const link = await getPublicLinkByToken(token);
  if (!link) notFound();

  await touchPublicLinkAccess(link.id);

  const period = getCurrentPeriod();

  const [op, meetings, decisions, attachments, incidents, report] =
    await Promise.all([
      getOperationPublicView(link.operationId),
      listPublicMeetings(link.operationId),
      listPublicDecisions(link.operationId),
      listPublicAttachments(link.operationId),
      listPublicIncidents(link.operationId),
      getReportContext(link.operationId, period),
    ]);
  if (!op || !report) notFound();

  const { tab: tabRaw } = await searchParams;
  const tab = normalizePublicTab(tabRaw);

  const tabs: ReadonlyArray<TabDef<PublicTabKey>> = [
    { key: "visao", label: "Visão geral" },
    { key: "frentes", label: "Frentes", count: op.frentes.length },
    {
      key: "eventos",
      label: "Reuniões & Decisões",
      count: meetings.length + decisions.length,
    },
    { key: "anexos", label: "Anexos", count: attachments.length },
    { key: "sla", label: "SLA", count: incidents.length },
  ];

  const periodLabel = `${period.monthLabel} ${period.year}`;

  return (
    <>
      <PublicReportBanner
        clientName={op.clientName}
        periodLabel={periodLabel}
      />

      {tab !== "visao" && <PublicHero op={op} />}

      <TabsNav<PublicTabKey>
        tabs={tabs}
        activeTab={tab}
        basePath={`/public/${token}`}
      />

      {tab === "visao" && (
        <>
          <PublicReportHero data={report.heroData} />
          <PublicVillainsList
            items={report.villains}
            narrativesByVillainId={report.narrativesByVillainId}
          />
          <PublicAchievementsList
            items={report.quickWins}
            headerLabel="Conquistas do mês"
            headerMeta={report.quickWinsHeaderMeta}
            emptyStateText={`Nenhuma conquista registrada em ${period.monthLabel}. As próximas chegam logo.`}
          />
          <PublicNextMovesList items={report.nextMoves} />
          <PublicTeamGrid people={report.team} />
        </>
      )}

      {tab === "frentes" && <PublicFrentesList frentes={op.frentes} />}

      {tab === "eventos" && (
        <PublicTimeline meetings={meetings} decisions={decisions} />
      )}

      {tab === "anexos" && (
        <PublicAttachmentsList attachments={attachments} token={token} />
      )}

      {tab === "sla" && (
        <PublicSLAList
          incidents={incidents}
          op={{
            response_hours: op.responseHours,
            resolution_hours: op.resolutionHours,
          }}
        />
      )}
    </>
  );
}
