import { calendarDateLocalToday } from "@/lib/utils/calendar-date";

const MONEY_EPSILON = 0.009;

export function sumVigenteContractMonthly(
  rows: ReadonlyArray<{ status: string; monthlyValue: number | null }>,
): number | null {
  const vigente = rows.filter((c) => c.status === "vigente");
  if (vigente.length === 0) return null;
  let sum = 0;
  let hasValue = false;
  for (const c of vigente) {
    if (c.monthlyValue !== null && c.monthlyValue !== undefined) {
      sum += Number(c.monthlyValue);
      hasValue = true;
    }
  }
  return hasValue ? sum : null;
}

export function contractMrrMismatch(
  mrrTotal: number,
  contractMonthlyTotal: number | null,
): boolean {
  if (contractMonthlyTotal === null) return false;
  return Math.abs(contractMonthlyTotal - mrrTotal) > MONEY_EPSILON;
}

export function earliestIsoDate(dates: ReadonlyArray<string | null | undefined>): string | null {
  const valid = dates.filter((d): d is string => !!d && /^\d{4}-\d{2}-\d{2}/.test(d));
  if (valid.length === 0) return null;
  return valid.reduce((min, d) => (d.slice(0, 10) < min ? d.slice(0, 10) : min));
}

/** Meses completos desde `start` (data-only) até hoje no fuso local. */
export function monthsSinceCalendarDate(start: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(start);
  if (!m) return null;
  const y0 = Number(m[1]);
  const mo0 = Number(m[2]);
  const today = calendarDateLocalToday();
  const t = /^(\d{4})-(\d{2})-(\d{2})/.exec(today);
  if (!t) return null;
  const y1 = Number(t[1]);
  const mo1 = Number(t[2]);
  return (y1 - y0) * 12 + (mo1 - mo0);
}

export function formatTenureLabel(startDate: string | null): string | null {
  if (!startDate) return null;
  const months = monthsSinceCalendarDate(startDate);
  if (months === null) return null;
  if (months < 1) return "Menos de 1 mês";
  if (months < 12) {
    return `${months} ${months === 1 ? "mês" : "meses"}`;
  }
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (rem === 0) {
    return `${years} ${years === 1 ? "ano" : "anos"}`;
  }
  return `${years} ${years === 1 ? "ano" : "anos"} e ${rem} ${rem === 1 ? "mês" : "meses"}`;
}
