import { Edit2, FileText, Users } from "lucide-react";
import Link from "next/link";
import type { OperationDetail } from "@/lib/db/queries/operations";
import { formatDateBR, relativeFromNow } from "@/lib/utils/date";
import {
  formatMarginPct,
  type MarginResult,
} from "@/lib/utils/margin";
import { formatMoneyBR } from "@/lib/utils/money";
import { formatHours } from "@/lib/utils/sla";
import { statusLabel } from "@/lib/utils/operation-status";

const PRODUCT_LINE_LABEL: Record<OperationDetail["productLine"], string> = {
  core: "Core",
  spark: "Spark",
  studio: "Studio",
};

// classes overrides pra contraste no fundo oak
// Overrides de contraste no fundo oak — local de propósito: são classes de tema
// escuro do hero, não a variante canônica de Pill (essa vem de operation-status).
const STATUS_PILL_DARK: Record<OperationDetail["status"], string> = {
  em_construcao: "bg-white/15 text-bg/90",
  em_operacao: "bg-sage-bg text-sage",
  janela_critica: "bg-warning-bg text-warning",
  concluida: "bg-ok-bg text-ok",
  cancelada: "bg-critical-bg text-critical",
  arquivada: "bg-white/15 text-bg/80",
};

const RECURRENCE_LABEL: Record<
  NonNullable<OperationDetail["recurrence"]>,
  string
> = {
  mensal: "Mensal",
  trimestral: "Trimestral",
  anual: "Anual",
  unica: "Única",
};

type BriefingFreshness = {
  hasBriefing: boolean;
  updatedAt: string | null;
};

export function OperationHero({
  op,
  briefingFreshness,
  isAdmin = false,
  margin,
}: {
  op: OperationDetail;
  briefingFreshness?: BriefingFreshness | undefined;
  isAdmin?: boolean;
  margin?: MarginResult | null;
}) {
  return (
    <section className="relative bg-oak text-bg rounded-lg p-8 overflow-hidden mb-9">
      <div
        className="absolute top-[-50%] right-[-10%] w-3/5 h-[200%] pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(147,181,150,0.20), transparent 60%)",
        }}
      />
      <div className="relative">
        <div className="flex items-start justify-between mb-5">
          <div className="font-mono text-[10px] uppercase tracking-wide opacity-60">
            <Link href="/clients" className="hover:opacity-100">
              clientes
            </Link>
            <span> / </span>
            <Link
              href={`/clients/${op.client.id}`}
              className="hover:opacity-100"
            >
              {op.client.slug}
            </Link>
            <span> / </span>
            <span>operação</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/operations/${op.id}/briefing`}>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded font-medium transition-colors px-3.5 py-2 text-[13px] bg-white/10 hover:bg-white/20 text-bg border border-white/20"
              >
                <FileText className="w-4 h-4" strokeWidth={1.75} />
                Briefing
              </button>
            </Link>
            <Link href={`/operations/${op.id}/edit`}>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded font-medium transition-colors px-3.5 py-2 text-[13px] bg-white/10 hover:bg-white/20 text-bg border border-white/20"
              >
                <Edit2 className="w-4 h-4" strokeWidth={1.75} />
                Editar
              </button>
            </Link>
            {isAdmin && (
              <Link href={`/operations/${op.id}/settings/members`}>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded font-medium transition-colors px-3.5 py-2 text-[13px] bg-white/10 hover:bg-white/20 text-bg border border-white/20"
                >
                  <Users className="w-4 h-4" strokeWidth={1.75} />
                  Membros
                </button>
              </Link>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 font-mono text-[10px] font-medium rounded-pill bg-sage-bg text-sage">
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {PRODUCT_LINE_LABEL[op.productLine]}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 font-mono text-[10px] font-medium rounded-pill ${STATUS_PILL_DARK[op.status]}`}
          >
            {statusLabel(op.status)}
          </span>
          {briefingFreshness &&
            (briefingFreshness.hasBriefing ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 font-mono text-[10px] font-medium rounded-pill bg-sage-bg text-sage">
                Briefing vivo · {relativeFromNow(briefingFreshness.updatedAt)}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 font-mono text-[10px] font-medium rounded-pill bg-warning-bg text-warning">
                Sem briefing
              </span>
            ))}
        </div>

        <h1 className="font-display text-4xl font-semibold leading-tight">
          {op.client.name}
        </h1>
        <p className="font-body text-base opacity-70 mt-1">{op.name}</p>

        <div className="flex flex-wrap gap-x-7 gap-y-3 mt-7">
          {isAdmin && (
            <>
              <MetaChip
                label="Recorrência"
                value={op.recurrence ? RECURRENCE_LABEL[op.recurrence] : "—"}
              />
              <MetaChip
                label="MRR"
                value={formatMoneyBR(op.monthlyRecurringRevenue)}
              />
              {margin && (
                <MarginChip margin={margin} />
              )}
            </>
          )}
          <MetaChip
            label="SLA · Resposta"
            value={formatHours(op.responseHours)}
          />
          <MetaChip
            label="SLA · Resolução"
            value={formatHours(op.resolutionHours)}
          />
          <MetaChip label="Início" value={formatDateBR(op.startDate)} />
          <MetaChip label="Fim" value={formatDateBR(op.endDate)} />
          <MetaChip label="Criado" value={formatDateBR(op.createdAt)} />
        </div>
      </div>
    </section>
  );
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="font-mono text-[10px] uppercase tracking-wide opacity-60">
        {label}
      </span>
      <span className="font-body text-sm font-medium">{value}</span>
    </div>
  );
}

function MarginChip({ margin }: { margin: MarginResult }) {
  const valueLabel = formatMoneyBR(margin.value);
  const pctLabel = formatMarginPct(margin.pct);
  const color =
    margin.level === "positive"
      ? "text-sage"
      : margin.level === "low"
        ? "text-warning"
        : "text-critical";
  return (
    <div className="flex flex-col">
      <span className="font-mono text-[10px] uppercase tracking-wide opacity-60">
        Margem
      </span>
      <span className={`font-body text-sm font-medium ${color}`}>
        {valueLabel}
        <span className="opacity-70 ml-1">({pctLabel})</span>
      </span>
    </div>
  );
}
