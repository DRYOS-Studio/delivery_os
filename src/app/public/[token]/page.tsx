import { notFound } from "next/navigation";
import { PublicAchievementsList } from "@/components/domain/PublicAchievementsList";
import { PublicAttachmentsList } from "@/components/domain/PublicAttachmentsList";
import { PublicFrentesList } from "@/components/domain/PublicFrentesList";
import { PublicHero } from "@/components/domain/PublicHero";
import { PublicSLAList } from "@/components/domain/PublicSLAList";
import { PublicTimeline } from "@/components/domain/PublicTimeline";
import { PublicVillainsList } from "@/components/domain/PublicVillainsList";
import { TabsNav, type TabDef } from "@/components/ui/TabsNav";
import { listPublicIncidents } from "@/lib/db/queries/incidents";
import { listPublicVillains } from "@/lib/db/queries/operation-villains";
import { listPublicQuickWins } from "@/lib/db/queries/quick-wins";
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
  if (!link || link.revokedAt !== null) notFound();

  await touchPublicLinkAccess(link.id);

  const [op, meetings, decisions, attachments, incidents, villains, quickWins] =
    await Promise.all([
      getOperationPublicView(link.operationId),
      listPublicMeetings(link.operationId),
      listPublicDecisions(link.operationId),
      listPublicAttachments(link.operationId),
      listPublicIncidents(link.operationId),
      listPublicVillains(link.operationId),
      listPublicQuickWins(link.operationId),
    ]);
  if (!op) notFound();

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

  return (
    <>
      <PublicHero op={op} />

      <TabsNav<PublicTabKey>
        tabs={tabs}
        activeTab={tab}
        basePath={`/public/${token}`}
      />

      {tab === "visao" && (
        <>
          <PublicVillainsList items={villains} />
          <PublicAchievementsList items={quickWins} />
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
