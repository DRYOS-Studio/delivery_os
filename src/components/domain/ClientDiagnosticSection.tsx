import {
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  Edit,
  FileSearch,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Pill, type PillVariant } from "@/components/ui/Pill";
import { LEVELS } from "@/lib/constants/management-diagnostic";
import type { DiagnosticDetail } from "@/lib/db/queries/diagnostics";
import { formatDateBR } from "@/lib/utils/date";

const PRODUCT_LABEL: Record<"core" | "spark" | "studio", string> = {
  core: "Core",
  spark: "Spark",
  studio: "Studio",
};

const PRODUCT_VARIANT: Record<"core" | "spark" | "studio", PillVariant> = {
  core: "oak",
  spark: "sage",
  studio: "ok",
};

const LEVEL_PILL_VARIANT: Record<number, PillVariant> = {
  1: "critical",
  2: "warning",
  3: "neutral",
  4: "sage",
  5: "ok",
};

export function ClientDiagnosticSection({
  diagnostic,
  clientId,
}: {
  diagnostic: DiagnosticDetail | null;
  clientId: string;
}): React.JSX.Element {
  const scores = diagnostic?.computedScores;
  const isManagementDiag = !!scores && scores.overall !== null;
  const isDraft = diagnostic?.status === "draft";

  return (
    <section className="mb-9">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display text-lg text-ink font-semibold">
            Diagnóstico de Gestão
          </h2>
          <p className="text-xs text-mute">
            Maturidade em 13 dimensões estratégicas e operacionais
          </p>
        </div>
        <div className="flex items-center gap-2">
          {diagnostic ? (
            <>
              <Link
                href={`/clients/${clientId}/diagnostic/${diagnostic.id}/edit`}
                className="inline-flex items-center gap-1.5 rounded font-medium px-2.5 py-1.5 text-xs bg-surface text-ink hover:bg-line transition-colors"
              >
                <Edit className="w-3 h-3" strokeWidth={1.75} />
                Editar
              </Link>
              <Link
                href={`/clients/${clientId}/diagnostic/new`}
                className="inline-flex items-center gap-1.5 rounded font-medium px-2.5 py-1.5 text-xs bg-sage-bg text-sage-deep hover:bg-sage hover:text-bg transition-colors"
              >
                <Plus className="w-3 h-3" strokeWidth={1.75} />
                Novo
              </Link>
            </>
          ) : (
            <Link
              href={`/clients/${clientId}/diagnostic/new`}
              className="inline-flex items-center gap-1.5 rounded font-medium px-2.5 py-1.5 text-xs bg-sage-bg text-sage-deep hover:bg-sage hover:text-bg transition-colors"
            >
              <Plus className="w-3 h-3" strokeWidth={1.75} />
              Iniciar Diagnóstico
            </Link>
          )}
        </div>
      </div>

      {diagnostic && isManagementDiag ? (
        <Card className="p-5 border-line-strong bg-card space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-surface border border-line flex flex-col items-center justify-center font-display">
                <span className="text-xs text-mute font-mono leading-none">Score</span>
                <span className="text-lg font-bold text-ink leading-tight">
                  {scores.overall}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  {scores.level && (
                    <Pill variant={LEVEL_PILL_VARIANT[scores.level] ?? "neutral"}>
                      Nível {scores.level} · {LEVELS[scores.level - 1]?.name}
                    </Pill>
                  )}
                  {isDraft && <Pill variant="warning">Rascunho</Pill>}
                  {diagnostic.recommended_product && (
                    <Pill
                      variant={PRODUCT_VARIANT[diagnostic.recommended_product]}
                    >
                      {PRODUCT_LABEL[diagnostic.recommended_product]}
                    </Pill>
                  )}
                </div>
                <p className="text-xs text-mute font-mono mt-1">
                  {diagnostic.conducted_at
                    ? `Conduzido em ${formatDateBR(diagnostic.conducted_at)}`
                    : "Em andamento"}
                  {diagnostic.profileData?.respondente &&
                    ` · Respondido por ${diagnostic.profileData.respondente}`}
                </p>
              </div>
            </div>

            <Link href={`/clients/${clientId}/diagnostic`}>
              <Button
                variant="primary"
                className="w-full sm:w-auto text-xs h-8 px-3 inline-flex items-center gap-1.5"
              >
                Ver Relatório Completo
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>

          {/* Destaques rápidos */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-surface rounded-lg border border-line">
              <span className="font-mono text-[10px] text-mute uppercase block">
                Dimensões Avaliadas
              </span>
              <span className="font-bold text-ink text-sm">
                {scores.validCount} de 13 dimensões
              </span>
            </div>
            <div className="p-3 bg-surface rounded-lg border border-line">
              <span className="font-mono text-[10px] text-mute uppercase block">
                Sinais de Alerta
              </span>
              <span className="font-bold text-ink text-sm flex items-center gap-1.5">
                {diagnostic.flagsList.length > 0 ? (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                    {diagnostic.flagsList.length} alertas detectados
                  </>
                ) : (
                  "Nenhum alerta crítico"
                )}
              </span>
            </div>
            <div className="p-3 bg-surface rounded-lg border border-line">
              <span className="font-mono text-[10px] text-mute uppercase block">
                Cobertura
              </span>
              <span className="font-bold text-ink text-sm">
                {Math.round((scores.answeredQ / scores.totalQ) * 100)}% das perguntas
              </span>
            </div>
          </div>
        </Card>
      ) : diagnostic && isDraft ? (
        <Card className="p-5 border-line-strong bg-card">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <ClipboardList className="w-5 h-5 text-warning" />
              <div>
                <h3 className="font-semibold text-sm text-ink">
                  Diagnóstico em Rascunho
                </h3>
                <p className="text-xs text-mute mt-0.5">
                  Preenchimento iniciado em{" "}
                  {diagnostic.conducted_at
                    ? formatDateBR(diagnostic.conducted_at)
                    : "data recente"}
                  . Continue para gerar o relatório final.
                </p>
              </div>
            </div>
            <Link
              href={`/clients/${clientId}/diagnostic/${diagnostic.id}/edit`}
            >
              <Button variant="primary" className="text-xs h-8">
                Continuar Preenchimento
              </Button>
            </Link>
          </div>
        </Card>
      ) : diagnostic && diagnostic.notes ? (
        <Card>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <FileSearch
                className="w-5 h-5 text-mute flex-shrink-0 mt-0.5"
                strokeWidth={1.75}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-ink-soft whitespace-pre-wrap">
                  {diagnostic.notes}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap pl-8 font-mono text-[10px] text-mute">
              {diagnostic.recommended_product && (
                <Pill
                  variant={PRODUCT_VARIANT[diagnostic.recommended_product]}
                >
                  Produto recomendado:{" "}
                  {PRODUCT_LABEL[diagnostic.recommended_product]}
                </Pill>
              )}
              {diagnostic.conducted_at && (
                <span>Conduzido em {formatDateBR(diagnostic.conducted_at)}</span>
              )}
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="text-center py-4 space-y-2">
            <p className="text-sm text-mute">
              Nenhum diagnóstico de gestão registrado para este cliente.
            </p>
            <div>
              <Link href={`/clients/${clientId}/diagnostic/new`}>
                <Button variant="ghost" className="text-xs">
                  + Iniciar Diagnóstico de 13 Dimensões
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      )}
    </section>
  );
}
