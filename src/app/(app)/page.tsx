import { Plus } from "lucide-react";
import Link from "next/link";
import { FrentesAttentionSection } from "@/components/domain/FrentesAttentionSection";
import { HomeKpiStrip } from "@/components/domain/HomeKpiStrip";
import { HomeSidebar } from "@/components/domain/HomeSidebar";
import { HomeStatusTabs } from "@/components/domain/HomeStatusTabs";
import { OperationsGrid } from "@/components/domain/OperationsGrid";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { getProfile } from "@/lib/auth/server";
import {
  getDashboardSummary,
  getTopVillainsByFrequency,
} from "@/lib/db/queries/dashboard";
import {
  countHotCriticalFrentes,
  listFrentesNeedingAttention,
} from "@/lib/db/queries/frentes";
import {
  getActiveOperations,
  type OperationCardData,
} from "@/lib/db/queries/operations";
import { normalizeStatusFilter } from "@/lib/utils/status-filter";

const NAME_OVERRIDES: Record<string, string> = {
  "rafaelemeth@gmail.com": "Rafael",
};

function nameFromEmail(email: string | null | undefined): string {
  if (!email) return "";
  const override = NAME_OVERRIDES[email.toLowerCase()];
  if (override) return override;
  const prefix = email.split("@")[0] ?? "";
  return prefix.charAt(0).toUpperCase() + prefix.slice(1);
}

function greeting(hour: number, name: string): string {
  const period = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  return name ? `${period}, ${name}.` : `${period}.`;
}

function countByStatus(ops: OperationCardData[]) {
  return {
    em_construcao: ops.filter((o) => o.status === "em_construcao").length,
    em_operacao: ops.filter((o) => o.status === "em_operacao").length,
    janela_critica: ops.filter((o) => o.status === "janela_critica").length,
    todas: ops.length,
  };
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusRaw } = await searchParams;
  const status = normalizeStatusFilter(statusRaw);

  const [
    profile,
    summary,
    operations,
    attentionFrentes,
    hotCriticalCount,
    topVillains,
  ] = await Promise.all([
    getProfile(),
    getDashboardSummary(),
    getActiveOperations(),
    listFrentesNeedingAttention(),
    countHotCriticalFrentes(),
    getTopVillainsByFrequency(5),
  ]);

  const isAdmin = profile?.role === "admin";
  const name = nameFromEmail(profile?.user.email);
  const hour = new Date().getHours();
  const counts = countByStatus(operations);
  const activeWord = counts.todas === 1 ? "Operação ativa" : "Operações ativas";
  const criticaSuffix =
    counts.janela_critica > 0
      ? ` e ${counts.janela_critica} em janela crítica`
      : "";
  const subtitle = `${greeting(hour, name)} Você tem ${counts.todas} ${activeWord}${criticaSuffix} essa semana.`;

  const filteredOps =
    status === "todas"
      ? operations
      : operations.filter((o) => o.status === status);

  return (
    <>
      <PageHeader
        title="Painel"
        subtitle={subtitle}
        actions={
          isAdmin ? (
            <Link href="/operations/new">
              <Button variant="sage">
                <Plus className="w-4 h-4" strokeWidth={1.75} />
                Nova operação
              </Button>
            </Link>
          ) : null
        }
      />

      <HomeKpiStrip summary={summary} isAdmin={isAdmin} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-8">
        <div className="xl:col-span-2 flex flex-col gap-7">
          <HomeStatusTabs counts={counts} active={status} />
          <FrentesAttentionSection
            frentes={attentionFrentes}
            hotCriticalCount={hotCriticalCount}
          />
          <OperationsGrid
            operations={filteredOps}
            isAdmin={isAdmin}
            hasFilter={status !== "todas"}
          />
        </div>
        <aside className="xl:col-span-1">
          <HomeSidebar
            isAdmin={isAdmin}
            topVillains={topVillains}
            quickWinsLast30d={summary.quickWinsLast30d}
          />
        </aside>
      </div>
    </>
  );
}
