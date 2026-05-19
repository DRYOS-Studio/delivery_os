import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import type { PublicOperationView } from "@/lib/db/queries/public";
import { formatCycleTypeShort } from "@/lib/utils/cycle-type";
import { relativeFromNow } from "@/lib/utils/date";

const DOMAIN_LABEL = {
  infra: "Infra",
  dados_analiticos: "Dados Analíticos",
  dados_tecnicos: "Dados Técnicos",
} as const;

const PHASE_LABEL = {
  descoberta: "Descoberta",
  execucao: "Execução",
  entrega: "Entrega",
  encerrada: "Encerrada",
} as const;

const PHASE_VARIANT = {
  descoberta: "neutral",
  execucao: "oak",
  entrega: "sage",
  encerrada: "neutral",
} as const;

export function PublicFrentesList({
  frentes,
}: {
  frentes: PublicOperationView["frentes"];
}): React.JSX.Element {
  return (
    <section className="mb-9">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="font-display text-lg text-ink font-semibold">Frentes</h2>
        <Pill variant="neutral">{frentes.length}</Pill>
      </div>

      {frentes.length === 0 ? (
        <Card>
          <p className="text-sm text-mute text-center py-2">
            Nenhuma Frente ativa nesta Operação.
          </p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {frentes.map((f) => (
            <li key={f.id}>
              <Card>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-display text-base font-semibold text-ink">
                      {f.name}
                    </span>
                    <Pill variant="oak">
                      {formatCycleTypeShort(f.cycleType)}
                    </Pill>
                    <Pill variant="neutral">{DOMAIN_LABEL[f.domain]}</Pill>
                    <Pill variant={PHASE_VARIANT[f.phase]}>
                      {PHASE_LABEL[f.phase]}
                    </Pill>
                  </div>
                  <p className="text-sm text-ink-soft whitespace-pre-wrap">
                    {f.actionableStatus}
                  </p>
                  <p className="font-mono text-[10px] text-mute-soft">
                    Atualizado {relativeFromNow(f.actionableStatusSince)}
                  </p>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
