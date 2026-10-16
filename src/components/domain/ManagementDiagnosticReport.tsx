"use client";

import { AlertTriangle, ArrowLeft, CheckCircle2, Download, Printer } from "lucide-react";
import Link from "next/link";
import { DeleteDiagnosticButton } from "@/components/domain/DeleteDiagnosticButton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Pill, type PillVariant } from "@/components/ui/Pill";
import { DIMS, LEVELS, TXT } from "@/lib/constants/management-diagnostic";
import type { DiagnosticDetail } from "@/lib/db/queries/diagnostics";
import { formatDateBR } from "@/lib/utils/date";
import type { DimensionScore } from "@/lib/utils/management-diagnostic";

type Props = {
  diagnostic: DiagnosticDetail;
  clientId: string;
  clientName: string;
};

const LEVEL_PILL_VARIANT: Record<number, PillVariant> = {
  1: "critical",
  2: "warning",
  3: "neutral",
  4: "sage",
  5: "ok",
};

export function ManagementDiagnosticReport({
  diagnostic,
  clientId,
  clientName,
}: Props): React.JSX.Element {
  const scores = diagnostic.computedScores;
  const profile = diagnostic.profileData;
  const flags = diagnostic.flagsList;
  const plan = diagnostic.actionPlanData;

  const validDims = (scores?.dims ?? []).filter(
    (d): d is DimensionScore & { score: number } => d.score !== null,
  );
  const sorted = validDims.slice().sort((a, b) => b.score - a.score);
  const strengths = sorted.slice(0, 3);
  const gaps = sorted.slice().reverse().slice(0, 3);

  const levelInfo = scores?.level ? LEVELS[scores.level - 1] : null;

  function handlePrint() {
    window.print();
  }

  function handleExportJSON() {
    const data = {
      ferramenta: "Diagnóstico de Gestão · dryos studio",
      versao: diagnostic.version,
      exportadoEm: new Date().toISOString(),
      cliente: clientName,
      perfil: profile,
      respostas: diagnostic.answersMap,
      naRespostas: diagnostic.naAnswersMap,
      resultado: scores,
      alertas: flags,
      planoAcao: plan,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    const safeName = (clientName || "cliente")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/gi, "-")
      .toLowerCase();
    a.href = URL.createObjectURL(blob);
    a.download = `diagnostico-${safeName}-${diagnostic.conducted_at || "resultado"}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Barra de Ações (oculta na impressão) */}
      <div className="flex items-center justify-between gap-3 flex-wrap print:hidden">
        <Link href={`/clients/${clientId}`}>
          <Button variant="ghost" className="inline-flex items-center gap-1.5">
            <ArrowLeft className="w-4 h-4" />
            Voltar ao Cliente
          </Button>
        </Link>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/clients/${clientId}/diagnostic/${diagnostic.id}/edit`}>
            <Button variant="ghost">Editar Respostas</Button>
          </Link>
          <Button variant="ghost" onClick={handleExportJSON} className="inline-flex items-center gap-1.5">
            <Download className="w-4 h-4" />
            Exportar JSON
          </Button>
          <Button variant="primary" onClick={handlePrint} className="inline-flex items-center gap-1.5">
            <Printer className="w-4 h-4" />
            Imprimir / Salvar PDF
          </Button>
          <DeleteDiagnosticButton
            diagnosticId={diagnostic.id}
            clientId={clientId}
            label="Excluir Diagnóstico"
            variant="ghost-critical"
          />
        </div>
      </div>

      {/* Cabeçalho do Relatório */}
      <Card className="p-6 md:p-8 border-line-strong bg-card">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-6 border-b border-line">
          <div>
            <span className="font-mono text-xs uppercase tracking-wider text-oak-light">
              dryos studio · Ops &amp; Finance
            </span>
            <h1 className="font-display text-2xl md:text-3xl text-ink font-bold mt-1">
              Diagnóstico de Gestão
            </h1>
            <p className="text-sm text-mute mt-1">
              Relatório consolidado de maturidade de gestão e processos
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs font-mono text-ink-soft bg-surface p-3.5 rounded-lg border border-line">
            <div>
              <span className="text-mute block">Empresa:</span>
              <strong className="text-ink">{profile.empresa || clientName}</strong>
            </div>
            <div>
              <span className="text-mute block">Setor:</span>
              <span>{profile.setor || "—"}</span>
            </div>
            <div>
              <span className="text-mute block">Respondente:</span>
              <span>{profile.respondente || "—"} {profile.cargo ? `(${profile.cargo})` : ""}</span>
            </div>
            <div>
              <span className="text-mute block">Data:</span>
              <span>{diagnostic.conducted_at ? formatDateBR(diagnostic.conducted_at) : "—"}</span>
            </div>
            <div>
              <span className="text-mute block">Porte / Equipe:</span>
              <span>{profile.pessoas || "—"}</span>
            </div>
            <div>
              <span className="text-mute block">Consultor:</span>
              <span>{profile.consultor || "Rafael Carvalho"}</span>
            </div>
          </div>
        </div>

        {/* Resumo Executivo & Gauge */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 items-center">
          <div className="flex flex-col items-center justify-center p-6 bg-surface rounded-xl border border-line text-center">
            <span className="font-mono text-xs uppercase text-mute tracking-wide">
              Índice de Maturidade
            </span>
            <div className="font-display text-5xl md:text-6xl font-bold text-ink mt-2">
              {scores?.overall ?? "—"}
              <span className="text-xl text-mute-soft font-normal">/100</span>
            </div>
            <div className="mt-3">
              {scores?.level && (
                <Pill variant={LEVEL_PILL_VARIANT[scores.level] ?? "neutral"}>
                  Nível {scores.level} · {levelInfo?.name ?? ""}
                </Pill>
              )}
            </div>
          </div>

          <div className="md:col-span-2 space-y-3">
            <h3 className="font-display text-base font-semibold text-ink">
              Resumo Executivo
            </h3>
            <p className="text-sm text-ink-soft leading-relaxed">
              <strong>{profile.empresa || clientName}</strong> apresenta índice geral de maturidade de{" "}
              <strong>{scores?.overall}/100</strong>, enquadrando-se no{" "}
              <strong>Nível {scores?.level} ({levelInfo?.name})</strong>:{" "}
              {levelInfo?.desc}
            </p>
            <p className="text-sm text-ink-soft leading-relaxed">
              As dimensões mais desenvolvidas são{" "}
              <strong>{strengths.map((s) => s.name).join(", ")}</strong>. Já as principais lacunas
              prioritárias concentram-se em{" "}
              <strong>{gaps.map((g) => g.name).join(", ")}</strong>.
              {flags.length > 0 && (
                <> Foram identificados <strong>{flags.length} sinais de alerta</strong> necessitando atenção preventiva.</>
              )}
            </p>
          </div>
        </div>

        {/* Dores e Objetivos */}
        {(profile.dores || profile.objetivos) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t border-line text-sm">
            {profile.dores && (
              <div className="p-4 rounded-lg bg-surface border border-line">
                <span className="font-mono text-[11px] uppercase tracking-wider text-mute block mb-1">
                  Principais dores relatadas
                </span>
                <p className="text-ink-soft whitespace-pre-wrap">{profile.dores}</p>
              </div>
            )}
            {profile.objetivos && (
              <div className="p-4 rounded-lg bg-surface border border-line">
                <span className="font-mono text-[11px] uppercase tracking-wider text-mute block mb-1">
                  Objetivos para o projeto
                </span>
                <p className="text-ink-soft whitespace-pre-wrap">{profile.objetivos}</p>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Gráfico Radar e Tabela de Dimensões */}
      <Card className="p-6 md:p-8 border-line-strong bg-card">
        <h2 className="font-display text-xl font-bold text-ink mb-6">
          Maturidade por Dimensão
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          {/* Radar SVG responsivo */}
          <div className="flex justify-center items-center p-2">
            <RadarChartSVG dims={scores?.dims ?? []} />
          </div>

          {/* Tabela de Notas */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-line text-left font-mono text-xs text-mute uppercase">
                  <th className="py-2 pr-3">Dimensão</th>
                  <th className="py-2 px-2 text-center w-14">Nota</th>
                  <th className="py-2 px-2 w-32">Nível</th>
                  <th className="py-2 pl-2 w-28 text-right">Maturidade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(scores?.dims ?? []).map((dim) => {
                  const scoreVal = dim.score ?? 0;
                  return (
                    <tr key={dim.id} className="hover:bg-surface/50">
                      <td className="py-2.5 pr-3 font-medium text-ink">
                        {dim.name}
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono font-bold text-ink">
                        {dim.score !== null ? dim.score : "—"}
                      </td>
                      <td className="py-2.5 px-2">
                        <div className="w-full bg-surface rounded-full h-2 overflow-hidden border border-line">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${scoreVal}%`,
                              backgroundColor:
                                scoreVal < 40
                                  ? "var(--critical)"
                                  : scoreVal < 60
                                  ? "var(--warning)"
                                  : "var(--ok)",
                            }}
                          />
                        </div>
                      </td>
                      <td className="py-2.5 pl-2 text-right">
                        {dim.level && (
                          <Pill
                            variant={LEVEL_PILL_VARIANT[dim.level] ?? "neutral"}
                            className="text-[10px]"
                          >
                            N{dim.level} · {LEVELS[dim.level - 1]?.name}
                          </Pill>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {/* Top Pontos Fortes e Lacunas Críticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 border-line-strong bg-card border-t-4 border-t-ok">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-5 h-5 text-ok" />
            <h3 className="font-display text-lg font-bold text-ink">
              Top 3 Pontos Fortes
            </h3>
          </div>
          <ol className="space-y-4 text-sm">
            {strengths.map((s, idx) => (
              <li key={s.id} className="p-3 bg-surface rounded-lg border border-line">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink">
                    {idx + 1}. {s.name}
                  </span>
                  <span className="font-mono font-bold text-ok">{s.score}/100</span>
                </div>
                {s.strongKeys.length > 0 && (
                  <p className="text-xs text-mute mt-1">
                    Destaques positivos: {s.strongKeys.slice(0, 3).join("; ")}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </Card>

        <Card className="p-6 border-line-strong bg-card border-t-4 border-t-critical">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-critical" />
            <h3 className="font-display text-lg font-bold text-ink">
              Top 3 Lacunas Críticas
            </h3>
          </div>
          <ol className="space-y-4 text-sm">
            {gaps.map((g, idx) => (
              <li key={g.id} className="p-3 bg-surface rounded-lg border border-line">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink">
                    {idx + 1}. {g.name}
                  </span>
                  <span className="font-mono font-bold text-critical">{g.score}/100</span>
                </div>
                {g.weakKeys.length > 0 && (
                  <p className="text-xs text-mute mt-1">
                    Pontos de atenção: {g.weakKeys.slice(0, 3).join("; ")}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </Card>
      </div>

      {/* Sinais de Alerta */}
      {flags.length > 0 && (
        <Card className="p-6 border-line-strong bg-card">
          <h2 className="font-display text-xl font-bold text-ink mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning" />
            Sinais de Alerta Identificados ({flags.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {flags.map((flag, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-lg border text-sm ${
                  flag.sev === "alta"
                    ? "bg-critical-bg border-critical/30 text-ink"
                    : "bg-warning-bg border-warning/30 text-ink"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <strong className="font-semibold">{flag.title}</strong>
                  <Pill variant={flag.sev === "alta" ? "critical" : "warning"} className="text-[10px]">
                    Severidade {flag.sev}
                  </Pill>
                </div>
                <p className="text-xs text-ink-soft leading-relaxed">{flag.desc}</p>
                <span className="inline-block mt-2 font-mono text-[10px] text-mute uppercase">
                  {flag.dimName}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Plano de Ação Priorizado */}
      {plan && (plan.qw.length > 0 || plan.d90.length > 0 || plan.m12.length > 0) && (
        <Card className="p-6 md:p-8 border-line-strong bg-card">
          <h2 className="font-display text-xl font-bold text-ink mb-2">
            Plano de Ação Priorizado
          </h2>
          <p className="text-xs text-mute mb-6 font-mono">
            Derivado das dimensões com menor índice de maturidade.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Quick wins 30d */}
            <div className="rounded-xl border border-line bg-surface overflow-hidden flex flex-col">
              <div className="bg-sage px-4 py-3 text-ink font-semibold text-sm">
                Quick Wins · 30 dias
              </div>
              <ul className="p-4 space-y-3 text-xs text-ink-soft flex-1">
                {plan.qw.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-sage-bg text-sage-deep font-mono font-bold text-[10px] shrink-0">
                      {item.dim}
                    </span>
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Estruturação 90d */}
            <div className="rounded-xl border border-line bg-surface overflow-hidden flex flex-col">
              <div className="bg-oak-light px-4 py-3 text-white font-semibold text-sm">
                Estruturação · 90 dias
              </div>
              <ul className="p-4 space-y-3 text-xs text-ink-soft flex-1">
                {plan.d90.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-oak-50 text-oak font-mono font-bold text-[10px] shrink-0">
                      {item.dim}
                    </span>
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Consolidação 6-12m */}
            <div className="rounded-xl border border-line bg-surface overflow-hidden flex flex-col">
              <div className="bg-oak px-4 py-3 text-white font-semibold text-sm">
                Consolidação · 6 a 12 meses
              </div>
              <ul className="p-4 space-y-3 text-xs text-ink-soft flex-1">
                {plan.m12.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-surface text-ink font-mono font-bold text-[10px] border border-line shrink-0">
                      {item.dim}
                    </span>
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* Diagnóstico Textual por Dimensão */}
      <Card className="p-6 md:p-8 border-line-strong bg-card">
        <h2 className="font-display text-xl font-bold text-ink mb-6">
          Diagnóstico Detalhado por Dimensão
        </h2>
        <div className="space-y-6">
          {(scores?.dims ?? []).map((dim) => {
            const band = (dim.level ?? 1) <= 2 ? 0 : dim.level === 3 ? 1 : 2;
            const textDesc = TXT[dim.id]?.[band] ?? "";
            return (
              <div
                key={dim.id}
                className="p-5 rounded-xl border border-line bg-surface space-y-2.5"
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <h3 className="font-display text-base font-bold text-ink">
                    {dim.name} · {dim.score !== null ? `${dim.score}/100` : "Sem dados"}
                  </h3>
                  {dim.level && (
                    <Pill variant={LEVEL_PILL_VARIANT[dim.level] ?? "neutral"}>
                      Nível {dim.level} · {LEVELS[dim.level - 1]?.name}
                    </Pill>
                  )}
                </div>
                <p className="text-sm text-ink-soft leading-relaxed">{textDesc}</p>
                {dim.weakKeys.length > 0 && (
                  <p className="text-xs text-mute font-mono">
                    <strong className="text-critical">Pontos de atenção:</strong>{" "}
                    {dim.weakKeys.join("; ")}.
                  </p>
                )}
                {dim.strongKeys.length > 0 && (
                  <p className="text-xs text-mute font-mono">
                    <strong className="text-ok">Pontos positivos:</strong>{" "}
                    {dim.strongKeys.join("; ")}.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function RadarChartSVG({ dims }: { dims: DimensionScore[] }): React.JSX.Element {
  const W = 520;
  const H = 460;
  const cx = W / 2;
  const cy = H / 2 + 5;
  const R = 150;
  const n = dims.length || 13;

  const pt = (i: number, r: number): [number, number] => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };

  const f = (v: number) => v.toFixed(1);

  const circles = [100, 80, 60, 40, 20];

  const polygonPoints = dims
    .map((x, i) => pt(i, (R * (x.score ?? 0)) / 100).map(f).join(","))
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full max-w-[480px] h-auto select-none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Círculos concêntricos de referência */}
      {circles.map((v) => {
        const poly = dims
          .map((_, i) => pt(i, (R * v) / 100).map(f).join(","))
          .join(" ");
        return (
          <polygon
            key={v}
            points={poly}
            fill={v === 100 ? "var(--surface)" : "none"}
            stroke="var(--line-strong)"
            strokeWidth="1"
          />
        );
      })}

      {/* Linhas radiais */}
      {dims.map((_, i) => {
        const [x, y] = pt(i, R);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={f(x)}
            y2={f(y)}
            stroke="var(--line)"
            strokeWidth="1"
          />
        );
      })}

      {/* Valores de escala nos eixos */}
      {circles.map((v) => (
        <text
          key={v}
          x={cx + 4}
          y={f(cy - (R * v) / 100 - 2)}
          fontSize="9"
          fill="var(--mute)"
          fontFamily="monospace"
        >
          {v}
        </text>
      ))}

      {/* Polígono preenchido dos scores */}
      <polygon
        points={polygonPoints}
        fill="rgba(147, 181, 150, 0.35)"
        stroke="var(--oak)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />

      {/* Pontos e Rótulos */}
      {dims.map((x, i) => {
        const [px, py] = pt(i, (R * (x.score ?? 0)) / 100);
        const [lx, ly] = pt(i, R + 24);
        const anchor =
          Math.abs(lx - cx) < 14 ? "middle" : lx > cx ? "start" : "end";
        const dy = ly < cy - R + 5 ? -6 : 0;

        return (
          <g key={i}>
            <circle
              cx={f(px)}
              cy={f(py)}
              r="4"
              fill={x.score === null ? "var(--mute)" : "var(--oak)"}
            />
            <text
              x={f(lx)}
              y={f(ly + dy)}
              fontSize="11.5"
              fontWeight="600"
              fill="var(--ink)"
              textAnchor={anchor}
              dominantBaseline="middle"
            >
              {x.short}
            </text>
            <text
              x={f(lx)}
              y={f(ly + dy + 13)}
              fontSize="10"
              fontWeight="700"
              fill="var(--sage-deep)"
              textAnchor={anchor}
              dominantBaseline="middle"
              fontFamily="monospace"
            >
              {x.score !== null ? x.score : "—"}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
