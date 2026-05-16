import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Pill, type PillVariant } from "@/components/ui/Pill";
import type { OperationCardData } from "@/lib/db/queries/operations";
import { formatDateShortBR } from "@/lib/utils/date";

const PRODUCT_LINE_LABEL: Record<OperationCardData["productLine"], string> = {
  core: "Core",
  spark: "Spark",
  studio: "Studio",
};

const STATUS_LABEL: Record<OperationCardData["status"], string> = {
  em_construcao: "Em construção",
  em_operacao: "Em operação",
  janela_critica: "Janela crítica",
  arquivada: "Arquivada",
};

const STATUS_VARIANT: Record<OperationCardData["status"], PillVariant> = {
  em_construcao: "neutral",
  em_operacao: "sage",
  janela_critica: "warning",
  arquivada: "neutral",
};

export function OperationCard({ data }: { data: OperationCardData }) {
  const { firstFrente, teamSize } = data;

  return (
    <Link href={`/operations/${data.id}`} className="block">
      <Card interactive>
        <div className="flex items-center justify-between mb-4">
          <Pill variant="oak" showDot>
            {PRODUCT_LINE_LABEL[data.productLine]}
          </Pill>
          <Pill variant={STATUS_VARIANT[data.status]}>
            {STATUS_LABEL[data.status]}
          </Pill>
        </div>

        <h3 className="font-display text-xl font-semibold text-ink leading-tight">
          {data.clientName}
        </h3>
        <p className="font-body text-sm text-mute mt-0.5">
          {data.operationName}
        </p>

        {firstFrente ? (
          <p className="font-body text-sm text-ink-soft mt-4 leading-relaxed">
            {firstFrente.actionable_status}
            <span className="font-mono text-xs text-mute"> — desde {formatDateShortBR(firstFrente.actionable_status_since)}</span>
          </p>
        ) : (
          <p className="font-mono text-xs text-mute-soft mt-4">
            — sem Frente ativa
          </p>
        )}

        <div className="flex items-center justify-between mt-5 pt-4 border-t border-line">
          <span className="font-mono text-xs text-mute">
            {teamSize} {teamSize === 1 ? "pessoa alocada" : "pessoas alocadas"}
          </span>
          {firstFrente && (
            <Pill variant="neutral">
              Tipo {firstFrente.cycle_type.toUpperCase()}
            </Pill>
          )}
        </div>
      </Card>
    </Link>
  );
}
