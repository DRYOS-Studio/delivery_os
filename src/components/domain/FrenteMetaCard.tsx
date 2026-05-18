import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Pill, type PillVariant } from "@/components/ui/Pill";
import { StalenessPill } from "@/components/ui/StalenessPill";
import type { FrenteDetail } from "@/lib/db/queries/frentes";
import { getInitials } from "@/lib/utils/initials";

const DOMAIN_LABEL: Record<FrenteDetail["domain"], string> = {
  infra: "Infra",
  dados_analiticos: "Dados analíticos",
  dados_tecnicos: "Dados técnicos",
};

const PHASE_LABEL: Record<FrenteDetail["phase"], string> = {
  descoberta: "Descoberta",
  execucao: "Execução",
  entrega: "Entrega",
  encerrada: "Encerrada",
};

const PHASE_VARIANT: Record<FrenteDetail["phase"], PillVariant> = {
  descoberta: "neutral",
  execucao: "oak",
  entrega: "sage",
  encerrada: "neutral",
};

export function FrenteMetaCard({
  frente,
}: {
  frente: FrenteDetail;
}) {
  return (
    <section className="mb-7 bg-card border border-line rounded p-5">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Pill variant="oak">Tipo {frente.cycleType.toUpperCase()}</Pill>
        <Pill variant="neutral">{DOMAIN_LABEL[frente.domain]}</Pill>
        <Pill variant={PHASE_VARIANT[frente.phase]}>
          {PHASE_LABEL[frente.phase]}
        </Pill>
        <div className="ml-auto">
          <Link
            href={`/operations/${frente.operationId}/frentes/${frente.id}/edit`}
            className="text-oak hover:underline text-sm font-medium"
          >
            Editar Frente →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-start">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-wide text-mute mb-1">
            Status acionável
          </p>
          <div className="flex items-start gap-2 flex-wrap">
            <p className="text-sm text-ink leading-relaxed">
              {frente.actionableStatus}
            </p>
            <StalenessPill since={frente.actionableStatusSince} />
          </div>
        </div>

        <div>
          <p className="font-mono text-[10px] uppercase tracking-wide text-mute mb-1">
            Responsável
          </p>
          {frente.responsibleName ? (
            <div className="flex items-center gap-2">
              <Avatar
                size="sm"
                initials={getInitials(frente.responsibleName)}
                color="oak"
                className="cursor-default"
              />
              <span className="text-sm text-ink">{frente.responsibleName}</span>
            </div>
          ) : (
            <span className="text-sm text-mute">—</span>
          )}
        </div>
      </div>
    </section>
  );
}
