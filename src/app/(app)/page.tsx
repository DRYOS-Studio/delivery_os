import { Plus } from "lucide-react";
import Link from "next/link";
import { FrentesAttentionSection } from "@/components/domain/FrentesAttentionSection";
import { OperationCard } from "@/components/domain/OperationCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { getProfile } from "@/lib/auth/server";
import {
  countHotCriticalFrentes,
  listFrentesNeedingAttention,
} from "@/lib/db/queries/frentes";
import {
  getActiveOperations,
  type OperationCardData,
} from "@/lib/db/queries/operations";
import { cn } from "@/lib/utils/cn";

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
  const period =
    hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
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

type Tab = {
  key: keyof ReturnType<typeof countByStatus>;
  label: string;
  active: boolean;
};

export default async function Page() {
  const [profile, operations, attentionFrentes, hotCriticalCount] =
    await Promise.all([
      getProfile(),
      getActiveOperations(),
      listFrentesNeedingAttention(),
      countHotCriticalFrentes(),
    ]);
  const user = profile?.user ?? null;
  const isAdmin = profile?.role === "admin";

  const name = nameFromEmail(user?.email);
  const hour = new Date().getHours();
  const greetingLine = greeting(hour, name);
  const counts = countByStatus(operations);
  const activeWord = counts.todas === 1 ? "Operação ativa" : "Operações ativas";
  const criticaSuffix =
    counts.janela_critica > 0
      ? ` e ${counts.janela_critica} em janela crítica`
      : "";
  const title = "Operações";
  const subtitle = `${greetingLine} Você tem ${counts.todas} ${activeWord}${criticaSuffix} essa semana.`;

  const tabs: readonly Tab[] = [
    { key: "em_construcao", label: "Em construção", active: false },
    { key: "em_operacao", label: "Em operação", active: true },
    { key: "janela_critica", label: "Janela crítica", active: false },
    { key: "todas", label: "Todas", active: false },
  ];

  return (
    <>
      <PageHeader
        title={title}
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

      <div className="flex gap-2 mb-7">
        {tabs.map((tab) => (
          <div
            key={tab.key}
            className={cn(
              "inline-flex items-center gap-2 px-3 py-1.5 rounded-pill text-sm font-medium transition-colors",
              tab.active
                ? "bg-card text-ink border border-line-strong"
                : "bg-transparent text-mute",
            )}
          >
            <span>{tab.label}</span>
            <Pill variant="neutral">{counts[tab.key]}</Pill>
          </div>
        ))}
      </div>

      <FrentesAttentionSection
        frentes={attentionFrentes}
        hotCriticalCount={hotCriticalCount}
      />

      {operations.length === 0 ? (
        <div className="text-center py-14">
          <p className="font-display text-xl text-mute">
            {isAdmin
              ? "Nenhuma Operação ativa."
              : "Você ainda não foi atribuído a nenhuma Operação."}
          </p>
          <p className="font-body text-sm text-mute mt-2">
            {isAdmin
              ? "Abra uma nova quando estiver pronto."
              : "Peça pra um admin te adicionar."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {operations.map((op) => (
            <OperationCard key={op.id} data={op} />
          ))}
        </div>
      )}
    </>
  );
}
