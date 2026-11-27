import type { Database } from "@/lib/db/types";

type MeetingKind = Database["public"]["Enums"]["meeting_kind"];

export type MeetingCalendarContext = {
  title: string;
  scheduledAt: string;
  endedAt: string | null;
  notes: string | null;
  kind: MeetingKind;
  clientName: string;
  operationName: string;
  operationId: string;
  agendaTitles: string[];
};

const FINANCIAL_PATTERN =
  /\b(mrr|margem|custo|preço|preco|faturamento|receita|cac|ltv|comiss[aã]o|taxa|valor|R\$\s*[\d.,]+)\b/i;

function stripFinancialLines(text: string): string {
  return text
    .split(/\r?\n/)
    .filter((line) => !FINANCIAL_PATTERN.test(line))
    .join("\n")
    .trim();
}

export function buildMeetingCalendarDescription(
  ctx: MeetingCalendarContext,
): string {
  const kindLabel = ctx.kind === "onboarding" ? "Onboarding" : "Reunião";
  const lines: string[] = [
    `${kindLabel} · ${ctx.clientName} · ${ctx.operationName}`,
    "",
    `Operação: ${ctx.operationName}`,
    `Cliente: ${ctx.clientName}`,
    `Tipo: ${kindLabel}`,
  ];
  if (ctx.agendaTitles.length > 0) {
    lines.push("", "Pauta:");
    for (const t of ctx.agendaTitles) {
      lines.push(`• ${t}`);
    }
  }
  if (ctx.notes?.trim()) {
    const safe = stripFinancialLines(ctx.notes.trim());
    if (safe) {
      lines.push("", "Notas:", safe);
    }
  }
  lines.push(
    "",
    `Registro no DRYOS Studio (operação ${ctx.operationId.slice(0, 8)}…).`,
  );
  return lines.join("\n").slice(0, 8000);
}

export function defaultMeetingEndIso(
  scheduledAt: string,
  endedAt: string | null,
): string {
  if (endedAt?.trim()) return endedAt;
  const start = new Date(scheduledAt);
  if (Number.isNaN(start.getTime())) {
    const fallback = new Date();
    fallback.setHours(fallback.getHours() + 1);
    return fallback.toISOString();
  }
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return end.toISOString();
}