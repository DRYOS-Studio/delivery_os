import { Edit2, FileText } from "lucide-react";
import Link from "next/link";
import type { OperationDetail } from "@/lib/db/queries/operations";
import { formatDateBR, relativeFromNow } from "@/lib/utils/date";
import { formatMoneyBR } from "@/lib/utils/money";
import { formatHours } from "@/lib/utils/sla";

const PRODUCT_LINE_LABEL: Record<OperationDetail["productLine"], string> = {
  core: "Core",
  spark: "Spark",
  studio: "Studio",
};

const STATUS_LABEL: Record<OperationDetail["status"], string> = {
  em_construcao: "Em construção",
  em_operacao: "Em operação",
  janela_critica: "Janela crítica",
  arquivada: "Arquivada",
};

// classes overrides pra contraste no fundo oak
const STATUS_PILL_DARK: Record<OperationDetail["status"], string> = {
  em_construcao: "bg-white/15 text-bg/90",
  em_operacao: "bg-sage-bg text-sage",
  janela_critica: "bg-warning-bg text-warning",
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
}: {
  op: OperationDetail;
  briefingFreshness?: BriefingFreshness | undefined;
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
            {STATUS_LABEL[op.status]}
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
          <MetaChip
            label="Recorrência"
            value={op.recurrence ? RECURRENCE_LABEL[op.recurrence] : "—"}
          />
          <MetaChip label="MRR" value={formatMoneyBR(op.monthlyRecurringRevenue)} />
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
