import { Plus } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Pill, type PillVariant } from "@/components/ui/Pill";
import type { FrenteListItem } from "@/lib/db/queries/operations";
import { getInitials } from "@/lib/utils/initials";

const DOMAIN_LABEL: Record<FrenteListItem["domain"], string> = {
  infra: "Infra",
  dados_analiticos: "Dados analíticos",
  dados_tecnicos: "Dados técnicos",
};

const PHASE_LABEL: Record<FrenteListItem["phase"], string> = {
  descoberta: "Descoberta",
  execucao: "Execução",
  entrega: "Entrega",
  encerrada: "Encerrada",
};

const PHASE_VARIANT: Record<FrenteListItem["phase"], PillVariant> = {
  descoberta: "neutral",
  execucao: "oak",
  entrega: "sage",
  encerrada: "neutral",
};

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export function FrentesListSection({
  frentes,
  operationId,
}: {
  frentes: FrenteListItem[];
  operationId: string;
}) {
  return (
    <section className="mb-9">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="font-display text-lg text-ink font-semibold">Frentes</h2>
        <Pill variant="neutral">{frentes.length}</Pill>
        <div className="ml-auto">
          <Link href={`/operations/${operationId}/frentes/new`}>
            <Button variant="sage" size="sm">
              <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
              Nova Frente
            </Button>
          </Link>
        </div>
      </div>

      {frentes.length === 0 ? (
        <div className="bg-card border border-line rounded p-7 text-center">
          <p className="font-body text-sm text-mute mb-4">
            Nenhuma Frente nesta Operação.
          </p>
          <Link href={`/operations/${operationId}/frentes/new`}>
            <Button variant="sage" size="sm">
              <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
              Criar primeira Frente
            </Button>
          </Link>
        </div>
      ) : (
        <div className="bg-card border border-line rounded shadow-sm overflow-hidden">
          <ul>
            {frentes.map((f, idx) => (
              <li
                key={f.id}
                className={`grid grid-cols-12 gap-3 items-center px-4 py-3 ${idx !== frentes.length - 1 ? "border-b border-line" : ""}`}
              >
                <div className="col-span-3 font-medium text-ink">{f.name}</div>
                <div className="col-span-1">
                  <Pill variant="oak">Tipo {f.cycleType.toUpperCase()}</Pill>
                </div>
                <div className="col-span-2">
                  <Pill variant="neutral">{DOMAIN_LABEL[f.domain]}</Pill>
                </div>
                <div className="col-span-1">
                  <Pill variant={PHASE_VARIANT[f.phase]}>
                    {PHASE_LABEL[f.phase]}
                  </Pill>
                </div>
                <div className="col-span-1 flex justify-center">
                  {f.responsibleName ? (
                    <Avatar
                      size="sm"
                      initials={getInitials(f.responsibleName)}
                      color="oak"
                      className="cursor-default"
                    />
                  ) : (
                    <span className="font-mono text-[10px] text-mute-soft">—</span>
                  )}
                </div>
                <div className="col-span-3 font-body text-sm text-ink-soft truncate">
                  {truncate(f.actionableStatus, 70)}
                </div>
                <div className="col-span-1 text-right">
                  <Link
                    href={`/operations/${operationId}/frentes/${f.id}/edit`}
                    className="text-oak hover:underline text-sm font-medium"
                  >
                    Editar →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
